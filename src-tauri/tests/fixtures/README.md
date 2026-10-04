# 缩略图测试图片

这三张图片由程序生成，不包含外部照片。原始像素为 800 × 400，左半红色 RGB(210, 45, 60)，右半蓝色 RGB(35, 90, 210)。

- `landscape.heic`：使用 macOS ImageIO 编码，EXIF orientation = 1。
- `rotated.heic`：使用 macOS ImageIO 编码，相同原始像素，EXIF orientation = 6（顺时针旋转 90°）。
- `landscape.avif`：使用 FFmpeg 的 libaom-av1 编码。

最大边长 384 的缩略图应为 384 × 192；旋转图片应为 192 × 384，红色在上、蓝色在下。生成工具仅用于制作测试文件，应用运行时无需安装这些工具。AVIF 测试同时验证当前 macOS ImageIO 的格式支持能力。
