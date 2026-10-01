# PopView

PopView 是一款本地图片查看器，用来浏览电脑中的图片、查看细节，以及把多张图片放在一起对比。选择一个文件夹，就可以开始使用。

## 主要功能

- **浏览文件夹**：通过目录树和路径导航，在不同文件夹之间切换。
- **查找图片**：按文件名搜索当前文件夹中的图片，支持网格和列表两种浏览方式。
- **查看细节**：打开单张图片，放大、缩小、拖动查看，并快速切换前后图片。
- **自由画板**：将多张图片放到同一画板上，自由移动、缩放，方便比较构图、配色和细节。

## 打包应用

先安装 Node.js（含 npm）、Rust，以及当前系统所需的构建工具。macOS 需要 Xcode Command Line Tools，尚未安装时可运行：

```bash
xcode-select --install
```

在项目根目录执行：

```bash
npm ci
npm run tauri -- build
```

打包命令会自动构建前端和桌面应用，无需提前运行 `npm run build`。默认产物位于 `src-tauri/target/release/bundle/`。

在 macOS 上，`macos/` 目录包含 `.app` 应用，`dmg/` 目录包含 `.dmg` 安装包。默认按当前电脑架构构建；正式对外分发时，还需要配置应用签名和公证。

如果只需要生成 macOS 应用，不生成安装包，可以运行：

```bash
npm run tauri -- build --bundles app
```
