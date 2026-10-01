# PopView 界面规则

桌面图片工具，采用 Operate 模式。保留奶油白、薄荷绿、柔粉、黄色和蓝色文件夹的现有视觉语言。

## 变量入口

公共变量定义在 `src/styles/tokens.css`，由 `src/style.css` 引入。组件通过语义变量表达用途；插画内部的渐变、照片边框和局部几何尺寸保留在组件内。

## 色彩职责

| 用途 | 变量 | 规则 |
| --- | --- | --- |
| 内容背景 | `--surface`、`--surface-subtle` | 奶油白与轻暖灰承载图片 |
| 目录导航 | `--mint`、`--nav-hover`、`--nav-ink`、`--nav-muted`、`--nav-line` | 薄荷底；悬停加深同色相；连接线弱于图标和文字 |
| 选中与焦点 | `--accent-soft`、`--accent` | 柔粉表达选中，深玫瑰表达焦点和选中图标 |
| 主要按钮 | `--yellow`、`--action-line`、`--action-hover`、`--action-pressed` | 黄色背景和黄褐边框，悬停与按下沿黄色加深 |
| 内容反馈 | `--content-hover`、`--content-pressed` | 淡暖黄悬停和按下，不借用粉色选中态 |
| 图片预览与画板 | `--viewer-*` | 炭灰画布、稍亮工具栏、柔玫瑰选中描边 |
| 错误 | `--error-surface`、`--error-ink` | 柔粉底和深红文字 |

多彩通过职责和面积建立层级。蓝色保留在文件夹插画，不扩散到通用控件。文字、占位符与焦点均需维持可读性。

## 空间与尺寸

- 品牌栏 `--titlebar-height: 56px`；内容工具栏和侧栏标题共用 `--toolbar-height: 72px`。
- 侧栏 `--sidebar-width: 252px`；窗口宽度不超过 1000px 时为 240px。
- 侧栏起始线 `--sidebar-inset: 16px`；面包屑、网格、列表共用 `--content-inset: 24px`。
- 网格 `--grid-min: 180px`、`--grid-gap: 24px`；窄窗口分别为 150px 和 16px。
- 图片预览使用 `--preview-ratio: 1.25`。文件夹插画与名称居中成组，`--folder-art-width: 136px`，展示区高度随插画尺寸确定，不随网格列宽拉高。
- 文件夹卡片内边距为上下 12px、左右 8px，插画与名称相隔 8px；长名称保持单行省略。
- 图片到名称 8px，名称到元信息 4px；文件夹区域与图片区域间隔 32px。
- 小控件 `--radius-control: 8px`；预览和文件夹悬停区域 `--radius-media: 12px`。
- 当前目录标题 16px，名称 13px，元信息 12px；选中目录字重 600。

## 调整边界

这些变量用于视觉细化。功能入口、控件数量、文案、图片展示模式及目录操作遵循现有实现。欢迎插画与蓝色文件夹保留；现有动效和减少动态效果支持继续使用。
