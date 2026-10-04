use image::{DynamicImage, ImageDecoder, ImageError, ImageFormat, ImageReader, Limits};
use std::{fmt, io, io::Cursor, path::Path};

const MAX_DIMENSION: u32 = 20000;
const MAX_ALLOCATION: u64 = 256 * 1024 * 1024;

#[derive(Debug)]
pub enum ThumbnailError {
    Unsupported,
    Read(io::Error),
    Decode(String),
    Limits(String),
}

impl fmt::Display for ThumbnailError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unsupported => write!(formatter, "当前系统不支持此图片格式"),
            Self::Read(error) => write!(formatter, "无法读取图片：{error}"),
            Self::Decode(error) => write!(formatter, "图片解码或缩略图生成失败：{error}"),
            Self::Limits(error) => write!(formatter, "图片超过缩略图处理限制：{error}"),
        }
    }
}

impl std::error::Error for ThumbnailError {}

impl From<ImageError> for ThumbnailError {
    fn from(error: ImageError) -> Self {
        match error {
            ImageError::Unsupported(_) => Self::Unsupported,
            ImageError::IoError(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::UnexpectedEof | io::ErrorKind::InvalidData
                ) =>
            {
                Self::Decode(error.to_string())
            }
            ImageError::IoError(error) => Self::Read(error),
            ImageError::Limits(error) => Self::Limits(error.to_string()),
            error => Self::Decode(error.to_string()),
        }
    }
}

pub fn generate(path: &Path, max_edge: u32) -> Result<Vec<u8>, ThumbnailError> {
    if max_edge == 0 {
        return Err(ThumbnailError::Limits("缩略图尺寸必须大于零".into()));
    }
    match rust_thumbnail(path, max_edge) {
        #[cfg(target_os = "macos")]
        Err(ImageError::Unsupported(_)) => macos::generate(path, max_edge),
        result => result.map_err(ThumbnailError::from),
    }
}

fn rust_thumbnail(path: &Path, max_edge: u32) -> Result<Vec<u8>, ImageError> {
    let mut reader = ImageReader::open(path)?.with_guessed_format()?;
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_DIMENSION);
    limits.max_image_height = Some(MAX_DIMENSION);
    limits.max_alloc = Some(MAX_ALLOCATION);
    reader.limits(limits);
    let mut decoder = reader.into_decoder()?;
    let orientation = decoder.orientation()?;
    let mut image = DynamicImage::from_decoder(decoder)?;
    image.apply_orientation(orientation);
    let mut bytes = Cursor::new(Vec::new());
    image
        .thumbnail(max_edge.min(image.width()), max_edge.min(image.height()))
        .write_to(&mut bytes, ImageFormat::Png)?;
    Ok(bytes.into_inner())
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use objc2_core_foundation::{
        CFBoolean, CFDictionary, CFMutableData, CFNumber, CFString, CFType, CFURL,
    };
    use objc2_image_io::{
        kCGImagePropertyPixelHeight, kCGImagePropertyPixelWidth,
        kCGImageSourceCreateThumbnailFromImageAlways, kCGImageSourceCreateThumbnailWithTransform,
        kCGImageSourceShouldCache, kCGImageSourceThumbnailMaxPixelSize, CGImageDestination,
        CGImageSource,
    };
    use std::io::Read;

    pub(super) fn supports_type(identifier: &str) -> bool {
        // SAFETY: ImageIO documents this array as containing CFString type identifiers.
        let identifiers = unsafe { CGImageSource::type_identifiers() };
        let identifiers = unsafe { identifiers.cast_unchecked::<CFString>() };
        let identifier = CFString::from_str(identifier);
        identifiers.iter().any(|value| *value == *identifier)
    }

    pub(super) fn generate(path: &Path, max_edge: u32) -> Result<Vec<u8>, ThumbnailError> {
        let mut header = Vec::new();
        std::fs::File::open(path)
            .map_err(ThumbnailError::Read)?
            .take(12)
            .read_to_end(&mut header)
            .map_err(ThumbnailError::Read)?;
        let native_type = if header.get(4..8) == Some(b"ftyp") {
            match header.get(8..12) {
                Some(b"avif" | b"avis") => Some("public.avif"),
                Some(b"heic" | b"heix" | b"hevc" | b"hevx") => Some("public.heic"),
                Some(b"mif1" | b"msf1") => Some("public.heif"),
                _ => None,
            }
        } else {
            None
        };
        if native_type.is_some_and(|identifier| !supports_type(identifier)) {
            return Err(ThumbnailError::Unsupported);
        }
        let url = CFURL::from_file_path(path)
            .ok_or_else(|| ThumbnailError::Decode("无效的文件路径".into()))?;
        // SAFETY: ImageIO receives retained CF objects, documented CFString keys and
        // correctly typed CFBoolean/CFNumber values. All image indices refer to frame 0.
        unsafe {
            let no_cache = CFDictionary::<CFString, CFType>::from_slices(
                &[kCGImageSourceShouldCache],
                &[CFBoolean::new(false).as_ref()],
            );
            let source =
                CGImageSource::with_url(&url, Some(no_cache.as_opaque())).ok_or_else(|| {
                    match native_type {
                        Some(_) => ThumbnailError::Decode("无法读取图片，文件可能已损坏".into()),
                        None => ThumbnailError::Unsupported,
                    }
                })?;
            if source.r#type().is_none() {
                return Err(match native_type {
                    Some(_) => ThumbnailError::Decode("无法识别图片内容，文件可能已损坏".into()),
                    None => ThumbnailError::Unsupported,
                });
            }
            let properties = source
                .properties_at_index(0, Some(no_cache.as_opaque()))
                .ok_or_else(|| ThumbnailError::Decode("无法读取图片尺寸，文件可能已损坏".into()))?;
            let properties = properties.cast_unchecked::<CFString, CFType>();
            let dimension = |key| {
                properties
                    .get(key)
                    .and_then(|value| value.downcast::<CFNumber>().ok())
                    .and_then(|number| number.as_i64())
                    .filter(|value| *value > 0)
                    .ok_or_else(|| ThumbnailError::Decode("无效的图片尺寸".into()))
            };
            let width = dimension(kCGImagePropertyPixelWidth)? as u64;
            let height = dimension(kCGImagePropertyPixelHeight)? as u64;
            if width > u64::from(MAX_DIMENSION)
                || height > u64::from(MAX_DIMENSION)
                || width * height * 4 > MAX_ALLOCATION
            {
                return Err(ThumbnailError::Limits("尺寸或解码内存超出限制".into()));
            }
            let edge = CFNumber::new_i64(i64::from(max_edge).min(width.max(height) as i64));
            let options = CFDictionary::<CFString, CFType>::from_slices(
                &[
                    kCGImageSourceCreateThumbnailFromImageAlways,
                    kCGImageSourceCreateThumbnailWithTransform,
                    kCGImageSourceThumbnailMaxPixelSize,
                    kCGImageSourceShouldCache,
                ],
                &[
                    CFBoolean::new(true).as_ref(),
                    CFBoolean::new(true).as_ref(),
                    edge.as_ref(),
                    CFBoolean::new(false).as_ref(),
                ],
            );
            let image = source
                .thumbnail_at_index(0, Some(options.as_opaque()))
                .ok_or_else(|| ThumbnailError::Decode("系统无法解码图片，文件可能已损坏".into()))?;
            let bytes = CFMutableData::new(None, 0)
                .ok_or_else(|| ThumbnailError::Decode("无法分配缩略图缓冲区".into()))?;
            let destination =
                CGImageDestination::with_data(&bytes, &CFString::from_str("public.png"), 1, None)
                    .ok_or_else(|| ThumbnailError::Decode("无法创建 PNG 编码器".into()))?;
            destination.add_image(&image, None);
            if !destination.finalize() {
                return Err(ThumbnailError::Decode("PNG 编码失败".into()));
            }
            Ok(bytes.to_vec())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    #[test]
    fn standard_images_preserve_transparency_and_are_not_enlarged() {
        let temporary = tempfile::tempdir().unwrap();
        let path = temporary.path().join("small.png");
        RgbaImage::from_pixel(20, 10, Rgba([100, 150, 200, 0]))
            .save(&path)
            .unwrap();
        let decoded = image::load_from_memory(&generate(&path, 384).unwrap()).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (20, 10));
        assert_eq!(decoded.to_rgba8().get_pixel(10, 5).0[3], 0);
    }

    #[test]
    fn read_unsupported_and_corrupt_errors_are_distinct() {
        let temporary = tempfile::tempdir().unwrap();
        let path = temporary.path().join("unknown.bin");
        assert!(matches!(generate(&path, 384), Err(ThumbnailError::Read(_))));
        std::fs::write(&path, b"not an image").unwrap();
        assert!(matches!(
            generate(&path, 384),
            Err(ThumbnailError::Unsupported)
        ));
        std::fs::write(&path, b"\x89PNG\r\n\x1a\n").unwrap();
        assert!(matches!(
            generate(&path, 384),
            Err(ThumbnailError::Decode(_))
        ));
        assert!(matches!(generate(&path, 0), Err(ThumbnailError::Limits(_))));
    }

    #[test]
    fn oversized_images_are_rejected_before_decoding() {
        let temporary = tempfile::tempdir().unwrap();
        let path = temporary.path().join("wide.png");
        RgbaImage::new(MAX_DIMENSION + 1, 1).save(&path).unwrap();
        assert!(matches!(
            generate(&path, 384),
            Err(ThumbnailError::Limits(_))
        ));
        #[cfg(target_os = "macos")]
        assert!(matches!(
            macos::generate(&path, 384),
            Err(ThumbnailError::Limits(_))
        ));
    }

    #[cfg(target_os = "macos")]
    fn fixture(name: &str) -> std::path::PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures")
            .join(name)
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn heic_and_avif_produce_proportional_png_thumbnails() {
        for (name, identifier) in [
            ("landscape.heic", "public.heic"),
            ("landscape.avif", "public.avif"),
        ] {
            let result = generate(&fixture(name), 384);
            if !macos::supports_type(identifier) {
                assert!(matches!(result, Err(ThumbnailError::Unsupported)));
                eprintln!("{name}: ImageIO does not support {identifier} on this macOS version");
                continue;
            }
            let bytes = result.unwrap();
            assert_eq!(image::guess_format(&bytes).unwrap(), ImageFormat::Png);
            let decoded = image::load_from_memory(&bytes).unwrap();
            assert_eq!((decoded.width(), decoded.height()), (384, 192));
            let pixels = decoded.to_rgb8();
            assert!(pixels.get_pixel(96, 96)[0] > 180);
            assert!(pixels.get_pixel(288, 96)[2] > 180);
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn native_thumbnails_apply_exif_orientation_and_do_not_upscale() {
        let decoded =
            image::load_from_memory(&generate(&fixture("rotated.heic"), 384).unwrap()).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (192, 384));
        let pixels = decoded.to_rgb8();
        assert!(pixels.get_pixel(96, 96)[0] > 180);
        assert!(pixels.get_pixel(96, 288)[2] > 180);
        let decoded =
            image::load_from_memory(&generate(&fixture("landscape.heic"), 1600).unwrap()).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (800, 400));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn corrupt_heic_reports_decode_failure() {
        let temporary = tempfile::tempdir().unwrap();
        let path = temporary.path().join("corrupt.heic");
        let bytes = std::fs::read(fixture("landscape.heic")).unwrap();
        std::fs::write(&path, &bytes[..24]).unwrap();
        assert!(matches!(
            generate(&path, 384),
            Err(ThumbnailError::Decode(_))
        ));
    }
}
