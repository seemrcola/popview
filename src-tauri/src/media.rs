use crate::directories::is_image;
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader, Limits};
use percent_encoding::percent_decode_str;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Cursor, Read},
    path::{Component, Path, PathBuf},
    sync::{atomic::AtomicBool, Arc, Mutex},
    time::UNIX_EPOCH,
};
use tauri::{
    http::{Request, Response},
    AppHandle, Manager,
};
use tokio::sync::Semaphore;

const CACHE_LIMIT: u64 = 256 * 1024 * 1024;
const FILE_LIMIT: u64 = 128 * 1024 * 1024;
const THUMBNAIL_SIZE: u32 = 384;

pub struct BrowserState {
    current: Mutex<(u64, Option<PathBuf>)>,
    pub choosing: AtomicBool,
    pub original_requests: Arc<Semaphore>,
    pub thumbnail_requests: Arc<Semaphore>,
    thumbnail_lock: Mutex<()>,
}

impl Default for BrowserState {
    fn default() -> Self {
        Self {
            current: Mutex::new((0, None)),
            choosing: AtomicBool::new(false),
            original_requests: Arc::new(Semaphore::new(2)),
            thumbnail_requests: Arc::new(Semaphore::new(2)),
            thumbnail_lock: Mutex::new(()),
        }
    }
}

impl BrowserState {
    pub fn commit_root(&self, root: PathBuf) -> Result<u64, String> {
        let mut current = self.current.lock().map_err(|error| error.to_string())?;
        current.0 += 1;
        current.1 = Some(root);
        Ok(current.0)
    }

    pub fn root(&self, session: u64) -> Result<PathBuf, String> {
        let current = self.current.lock().map_err(|error| error.to_string())?;
        if session != current.0 {
            return Err("目录会话已失效".into());
        }
        current.1.clone().ok_or_else(|| "请先选择文件夹".into())
    }
}

pub fn authorize(root: &Path, path: &str) -> Result<PathBuf, String> {
    let requested = Path::new(path);
    if !requested.is_absolute()
        || requested
            .components()
            .any(|part| part == Component::ParentDir)
    {
        return Err("不允许读取此路径".into());
    }
    let canonical = requested
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !canonical.starts_with(root) {
        return Err("路径不在当前选中的文件夹内".into());
    }
    let relative = requested
        .strip_prefix(root)
        .map_err(|_| "路径不在当前选中的文件夹内")?;
    let mut ancestor = root.to_path_buf();
    for part in relative.components() {
        ancestor.push(part);
        if fs::symlink_metadata(&ancestor)
            .map_err(|error| error.to_string())?
            .file_type()
            .is_symlink()
        {
            return Err("不允许通过符号链接读取文件".into());
        }
    }
    Ok(canonical)
}

fn cache_path(path: &Path, cache: &Path) -> Result<PathBuf, String> {
    let metadata = path.metadata().map_err(|error| error.to_string())?;
    let modified = metadata
        .modified()
        .map_err(|error| error.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let key = format!(
        "v1:{}:{}:{modified}:{THUMBNAIL_SIZE}",
        path.to_string_lossy(),
        metadata.len()
    );
    Ok(cache.join(format!("{:x}.png", Sha256::digest(key.as_bytes()))))
}

fn prune_cache(cache: &Path, incoming: u64) -> Result<(), String> {
    let mut entries = fs::read_dir(cache)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            (metadata.is_file()
                && entry
                    .path()
                    .extension()
                    .is_some_and(|extension| extension == "png"))
            .then(|| {
                (
                    metadata.modified().unwrap_or(UNIX_EPOCH),
                    entry.path(),
                    metadata.len(),
                )
            })
        })
        .collect::<Vec<_>>();
    let mut total = entries.iter().map(|entry| entry.2).sum::<u64>() + incoming;
    entries.sort_by_key(|entry| entry.0);
    for (_, path, size) in entries {
        if total <= CACHE_LIMIT {
            break;
        }
        fs::remove_file(path).map_err(|error| error.to_string())?;
        total -= size;
    }
    Ok(())
}

fn thumbnail(path: &Path, cache: &Path) -> Result<Vec<u8>, String> {
    fs::create_dir_all(cache).map_err(|error| error.to_string())?;
    let target = cache_path(path, cache)?;
    if let Ok(bytes) = fs::read(&target) {
        return Ok(bytes);
    }
    let mut reader = ImageReader::open(path)
        .map_err(|error| error.to_string())?
        .with_guessed_format()
        .map_err(|error| error.to_string())?;
    let mut limits = Limits::default();
    limits.max_image_width = Some(20000);
    limits.max_image_height = Some(20000);
    limits.max_alloc = Some(256 * 1024 * 1024);
    reader.limits(limits);
    let mut decoder = reader.into_decoder().map_err(|error| error.to_string())?;
    let orientation = decoder.orientation().map_err(|error| error.to_string())?;
    let mut image = DynamicImage::from_decoder(decoder).map_err(|error| error.to_string())?;
    image.apply_orientation(orientation);
    let mut bytes = Cursor::new(Vec::new());
    image
        .thumbnail(
            THUMBNAIL_SIZE.min(image.width()),
            THUMBNAIL_SIZE.min(image.height()),
        )
        .write_to(&mut bytes, ImageFormat::Png)
        .map_err(|error| error.to_string())?;
    let bytes = bytes.into_inner();
    prune_cache(cache, bytes.len() as u64)?;
    if cache_path(path, cache)? != target {
        return Err("图片已变化，请重试".into());
    }
    let temporary = target.with_extension("tmp");
    fs::write(&temporary, &bytes).map_err(|error| error.to_string())?;
    fs::rename(temporary, target).map_err(|error| error.to_string())?;
    Ok(bytes)
}

fn content_type(bytes: &[u8]) -> Result<&'static str, String> {
    let mime = match image::guess_format(bytes) {
        Ok(ImageFormat::Jpeg) => "image/jpeg",
        Ok(ImageFormat::Png) => "image/png",
        Ok(ImageFormat::Gif) => "image/gif",
        Ok(ImageFormat::WebP) => "image/webp",
        Ok(ImageFormat::Bmp) => "image/bmp",
        Ok(ImageFormat::Avif) => "image/avif",
        _ if bytes.get(4..8) == Some(b"ftyp") => match bytes.get(8..12) {
            Some(b"heic" | b"heix" | b"hevc" | b"hevx") => "image/heic",
            Some(b"mif1" | b"msf1") => "image/heif",
            _ => return Err("无法识别的图片格式".into()),
        },
        _ => return Err("无法识别的图片格式".into()),
    };
    Ok(mime)
}

fn read_media(
    state: &BrowserState,
    cache: &Path,
    request: &Request<Vec<u8>>,
) -> Result<(Vec<u8>, &'static str), String> {
    if request.method() != "GET" {
        return Err("不支持的请求".into());
    }
    let query = request
        .uri()
        .query()
        .unwrap_or("")
        .split('&')
        .filter_map(|part| part.split_once('='))
        .collect::<std::collections::HashMap<_, _>>();
    let session = query
        .get("session")
        .and_then(|value| value.parse::<u64>().ok())
        .ok_or("缺少目录会话")?;
    let root = state.root(session)?;
    let encoded = request.uri().path().strip_prefix('/').ok_or("无效路径")?;
    let path = percent_decode_str(encoded)
        .decode_utf8()
        .map_err(|error| error.to_string())?;
    let path = authorize(&root, &path)?;
    if !is_image(&path) || !path.is_file() {
        return Err("只允许读取图片文件".into());
    }
    if path.metadata().map_err(|error| error.to_string())?.len() > FILE_LIMIT {
        return Err("图片超过 128 MB 限制".into());
    }
    if query.get("thumbnail") == Some(&"1") {
        let _guard = state
            .thumbnail_lock
            .lock()
            .map_err(|error| error.to_string())?;
        return thumbnail(&path, cache).map(|bytes| (bytes, "image/png"));
    }
    let mut bytes = Vec::new();
    fs::File::open(&path)
        .map_err(|error| error.to_string())?
        .take(FILE_LIMIT + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    if bytes.len() as u64 > FILE_LIMIT {
        return Err("图片超过 128 MB 限制".into());
    }
    let mime = content_type(&bytes)?;
    Ok((bytes, mime))
}

pub fn error_response() -> Response<Vec<u8>> {
    Response::builder()
        .status(403)
        .header("Content-Type", "text/plain")
        .header("Cache-Control", "no-store")
        .body(b"Image unavailable".to_vec())
        .unwrap()
}

pub fn serve(app: &AppHandle, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let result = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())
        .and_then(|cache| {
            read_media(
                &app.state::<BrowserState>(),
                &cache.join("thumbnails"),
                &request,
            )
        });
    match result {
        Ok((bytes, mime)) => Response::builder()
            .header("Content-Type", mime)
            .header("Cache-Control", "no-store")
            .header("X-Content-Type-Options", "nosniff")
            .body(bytes)
            .unwrap(),
        Err(_) => error_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};
    use std::time::Duration;

    #[test]
    fn selected_root_is_required_and_old_sessions_are_revoked() {
        let state = BrowserState::default();
        assert!(state.root(0).is_err());
        let first = state.commit_root(PathBuf::from("/first")).unwrap();
        assert_eq!(state.root(first).unwrap(), PathBuf::from("/first"));
        let second = state.commit_root(PathBuf::from("/second")).unwrap();
        assert!(state.root(first).is_err());
        assert_eq!(state.root(second).unwrap(), PathBuf::from("/second"));
    }

    #[test]
    fn original_images_do_not_wait_for_the_thumbnail_queue() {
        let state = BrowserState::default();
        let _thumbnails = state.thumbnail_requests.try_acquire_many(2).unwrap();
        assert!(state.thumbnail_requests.try_acquire().is_err());
        assert!(state.original_requests.try_acquire_many(2).is_ok());
    }

    #[test]
    fn authorization_rejects_outside_relative_and_traversal_paths() {
        let temporary = tempfile::tempdir().unwrap();
        let parent = temporary.path().canonicalize().unwrap();
        let root = parent.join("photos");
        fs::create_dir(&root).unwrap();
        let image = root.join("inside.png");
        fs::write(&image, b"image").unwrap();
        let sibling = parent.join("photos-other");
        fs::create_dir(&sibling).unwrap();
        assert_eq!(authorize(&root, image.to_str().unwrap()).unwrap(), image);
        assert!(authorize(&root, sibling.to_str().unwrap()).is_err());
        assert!(authorize(&root, "inside.png").is_err());
        assert!(authorize(&root, root.join("../photos/inside.png").to_str().unwrap()).is_err());
        assert!(authorize(&root, root.join("missing.png").to_str().unwrap()).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn authorization_rejects_symlinks_even_when_the_target_is_inside() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path().canonicalize().unwrap();
        let image = root.join("inside.png");
        fs::write(&image, b"image").unwrap();
        let link = root.join("link.png");
        std::os::unix::fs::symlink(&image, &link).unwrap();
        assert!(authorize(&root, link.to_str().unwrap()).is_err());
        let outside = root.join("outside");
        std::os::unix::fs::symlink(root.parent().unwrap(), &outside).unwrap();
        assert!(authorize(&root, outside.to_str().unwrap()).is_err());
    }

    #[test]
    fn thumbnail_is_bounded_cached_and_invalidated_when_file_changes() {
        let temporary = tempfile::tempdir().unwrap();
        let original = temporary.path().join("image.png");
        let cache = temporary.path().join("cache");
        RgbaImage::from_pixel(1000, 500, Rgba([100, 150, 200, 255]))
            .save(&original)
            .unwrap();
        let first = thumbnail(&original, &cache).unwrap();
        let decoded = image::load_from_memory(&first).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (384, 192));
        assert_eq!(thumbnail(&original, &cache).unwrap(), first);
        assert_eq!(fs::read_dir(&cache).unwrap().count(), 1);
        let old_key = cache_path(&original, &cache).unwrap();
        let modified = original.metadata().unwrap().modified().unwrap();
        fs::File::options()
            .write(true)
            .open(&original)
            .unwrap()
            .set_modified(modified + Duration::from_secs(1))
            .unwrap();
        assert_ne!(cache_path(&original, &cache).unwrap(), old_key);
        thumbnail(&original, &cache).unwrap();
        assert_eq!(fs::read_dir(&cache).unwrap().count(), 2);
    }

    #[test]
    fn small_images_are_not_enlarged_and_invalid_images_do_not_poison_cache() {
        let temporary = tempfile::tempdir().unwrap();
        let original = temporary.path().join("small.png");
        let cache = temporary.path().join("cache");
        RgbaImage::from_pixel(20, 10, Rgba([0, 0, 0, 0]))
            .save(&original)
            .unwrap();
        let decoded = image::load_from_memory(&thumbnail(&original, &cache).unwrap()).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (20, 10));
        let invalid = temporary.path().join("invalid.png");
        fs::write(&invalid, b"not an image").unwrap();
        assert!(thumbnail(&invalid, &cache).is_err());
        assert_eq!(fs::read_dir(&cache).unwrap().count(), 1);
    }

    #[test]
    fn disk_cache_eviction_respects_the_size_budget() {
        let temporary = tempfile::tempdir().unwrap();
        let cache = temporary.path();
        let oversized = cache.join("old.png");
        fs::File::create(&oversized)
            .unwrap()
            .set_len(CACHE_LIMIT)
            .unwrap();
        prune_cache(cache, 100).unwrap();
        assert!(!oversized.exists());
    }

    #[test]
    fn media_protocol_decodes_paths_and_separates_originals_from_thumbnails() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path().canonicalize().unwrap();
        let original = root.join("空 格#?.png");
        RgbaImage::from_pixel(800, 400, Rgba([100, 150, 200, 255]))
            .save(&original)
            .unwrap();
        let state = BrowserState::default();
        let session = state.commit_root(root.clone()).unwrap();
        let encoded = percent_encoding::utf8_percent_encode(
            original.to_str().unwrap(),
            percent_encoding::NON_ALPHANUMERIC,
        );
        let url = format!("media://localhost/{encoded}?session={session}&revision=1");
        let request = Request::builder().uri(&url).body(Vec::new()).unwrap();
        let cache = root.join("cache");
        let (bytes, mime) = read_media(&state, &cache, &request).unwrap();
        assert_eq!(bytes, fs::read(&original).unwrap());
        assert_eq!(mime, "image/png");
        let request = Request::builder()
            .uri(format!("{url}&thumbnail=1"))
            .body(Vec::new())
            .unwrap();
        let (bytes, _) = read_media(&state, &cache, &request).unwrap();
        assert_eq!(image::load_from_memory(&bytes).unwrap().width(), 384);
        state.commit_root(root).unwrap();
        assert!(read_media(&state, &cache, &request).is_err());
    }

    #[test]
    fn media_protocol_rejects_missing_sessions_non_images_and_oversized_files() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path().canonicalize().unwrap();
        let state = BrowserState::default();
        let session = state.commit_root(root.clone()).unwrap();
        let cache = root.join("cache");
        for (name, length) in [("secret.txt", 10), ("huge.png", FILE_LIMIT + 1)] {
            let path = root.join(name);
            fs::File::create(&path).unwrap().set_len(length).unwrap();
            let encoded = percent_encoding::utf8_percent_encode(
                path.to_str().unwrap(),
                percent_encoding::NON_ALPHANUMERIC,
            );
            let url = format!("media://localhost/{encoded}");
            let missing_session = Request::builder().uri(&url).body(Vec::new()).unwrap();
            assert!(read_media(&state, &cache, &missing_session).is_err());
            let request = Request::builder()
                .uri(format!("{url}?session={session}"))
                .body(Vec::new())
                .unwrap();
            assert!(read_media(&state, &cache, &request).is_err());
        }
        assert!(content_type(b"text disguised as an image").is_err());
        assert!(content_type(b"<svg onload='alert(1)'></svg>").is_err());
        let post = Request::builder()
            .method("POST")
            .uri("media://localhost/")
            .body(Vec::new())
            .unwrap();
        assert!(read_media(&state, &cache, &post).is_err());
    }
}
