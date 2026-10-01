use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct DirectoryEntry {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct PreviewEntry {
    pub path: String,
    pub name: String,
}

pub fn is_image(path: &Path) -> bool {
    let Some(extension) = path.extension() else {
        return false;
    };
    matches!(
        extension.to_string_lossy().to_lowercase().as_str(),
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "avif" | "heic" | "heif"
    )
}

fn modified_seconds(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_secs())
}

const PREVIEW_SCAN_LIMIT: usize = 256;
const PREVIEW_IMAGE_LIMIT: usize = 3;

pub fn sample_images(path: &Path) -> Result<Vec<PreviewEntry>, String> {
    let mut images = Vec::new();
    for item in fs::read_dir(path)
        .map_err(|error| error.to_string())?
        .take(PREVIEW_SCAN_LIMIT)
    {
        let Ok(item) = item else { continue };
        let item_path = item.path();
        if !is_image(&item_path) {
            continue;
        }
        let Ok(file_type) = item.file_type() else {
            continue;
        };
        if !file_type.is_file() || file_type.is_symlink() {
            continue;
        }
        images.push(PreviewEntry {
            path: item_path.to_string_lossy().into_owned(),
            name: item.file_name().to_string_lossy().into_owned(),
        });
        if images.len() == PREVIEW_IMAGE_LIMIT {
            break;
        }
    }
    Ok(images)
}

pub fn read_directory(root: &Path) -> Result<Vec<DirectoryEntry>, String> {
    if !root.is_dir() {
        return Err("选择的路径不是文件夹".into());
    }

    let mut entries = Vec::new();
    for item in fs::read_dir(root).map_err(|error| error.to_string())? {
        let Ok(item) = item else { continue };
        let item_path = item.path();
        let Ok(file_type) = item.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            entries.push(DirectoryEntry {
                path: item_path.to_string_lossy().into_owned(),
                name: item.file_name().to_string_lossy().into_owned(),
                is_dir: true,
                size: 0,
                modified: None,
            });
            continue;
        }
        if !file_type.is_file() {
            continue;
        }
        if !is_image(&item_path) {
            continue;
        }
        let Ok(metadata) = item.metadata() else {
            continue;
        };
        entries.push(DirectoryEntry {
            path: item_path.to_string_lossy().into_owned(),
            name: item.file_name().to_string_lossy().into_owned(),
            is_dir: false,
            size: metadata.len(),
            modified: modified_seconds(&metadata),
        });
    }
    entries.sort_by_cached_key(|entry| (!entry.is_dir, entry.name.to_lowercase()));
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn directory_listing_is_shallow_filtered_and_sorted() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path();
        fs::create_dir(root.join("child")).unwrap();
        fs::write(root.join("child/hidden.png"), b"image").unwrap();
        for name in ["B.JPG", "a.png", "ignored.txt"] {
            fs::write(root.join(name), b"image").unwrap();
        }
        let entries = read_directory(root).unwrap();
        assert_eq!(
            entries
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            vec!["child", "a.png", "B.JPG"]
        );
        assert!(entries[0].is_dir);
        assert!(!entries[1].is_dir);
    }

    #[test]
    fn sampling_is_shallow_and_capped_at_three_images() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path();
        fs::create_dir(root.join("nested")).unwrap();
        fs::write(root.join("nested/hidden.png"), b"image").unwrap();
        assert!(sample_images(root).unwrap().is_empty());
        for index in 0..10 {
            fs::write(root.join(format!("{index}.png")), b"image").unwrap();
        }
        assert_eq!(sample_images(root).unwrap().len(), 3);
    }

    #[cfg(unix)]
    #[test]
    fn listing_and_sampling_skip_symlinks() {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path();
        fs::write(root.join("real.png"), b"image").unwrap();
        std::os::unix::fs::symlink(root.join("real.png"), root.join("link.png")).unwrap();
        assert_eq!(read_directory(root).unwrap().len(), 1);
        assert_eq!(sample_images(root).unwrap().len(), 1);
    }
}
