# Sonavi 双平台设计映射

更新日期：2026-09-14

## 共用视觉来源

`Sonavi_UI_v0.1/` 是视觉参考包。共享 renderer 从 `tokens.css` 复用石色画布、白色抬升面、深色侧栏、琥珀强调、圆角和间距，并在 `src/renderer/src/styles/tokens.css` 增加跨平台中英文字体回退。Tailwind CSS theme 映射这些 Sonavi tokens，shadcn-vue 组件源码按相同视觉调整。连接页继续复用既有 CSS；P03 专辑/播放器增量使用 Tailwind 与 shadcn-vue Button，不复制平台页面。

| 参考内容 | 共享实现 | 平台差异 |
| --- | --- | --- |
| 石色/琥珀 tokens | renderer CSS 变量 | 无 |
| 左导航、内容区、底部播放器 | 单一 App.vue 外壳 | 无 |
| 连接表单 | 单一 ConnectPanel.vue | 设备名称由 preload 提供 |
| P03 专辑列表/详情 | 单一 LibraryPanel.vue；每页 30 张并显式加载更多 | 无；结果按平台分别截图验收 |
| P04 播放器 | 单一 PlayerBar.vue / AudioEngine；前后切歌、随机/循环、进度与音量 | 系统媒体集成留到 P09 |
| P04 播放队列 | 共用深石色浮层；重复项、删除、清空、上移/下移 | 无；键盘与外观按平台分别验收 |
| P05 首页/专辑 | 共用 LibraryPanel、专辑卡片与详情；首页最近添加，专辑页字母序分页 | 无；滚动与替代字体分别验收 |
| P05 艺术家 | 共用窗口化列表、圆形封面/字母占位与艺术家详情 | 无；超长列表性能分别验收 |
| P05 搜索 | 共用输入、艺术家/专辑/歌曲结果与加载/空/错误状态 | Ctrl/Cmd 只在未来快捷键入口适配，查询逻辑无平台分叉 |
| P05 设置 | 共用服务器/协议展示和断开/忘记操作 | 平台名称与后续系统集成由 preload/平台适配提供 |
| 账号退出 | 同一断开/忘记账号逻辑 | 文案不假设某一系统；系统凭据由 main 删除 |
| 设置快捷键提示 | 同一文案槽位 | Windows Ctrl；macOS Cmd |
| 标题栏 | 不在 renderer 绘制 | 使用各自原生边框与按钮 |
| 字体 | 同一 fallback 列表 | Windows 优先 Segoe UI/微软雅黑；macOS 优先苹方/冬青黑体 |

## 桌面外观规则

- 不渲染假的 macOS 红黄绿按钮，不隐藏原生 Windows 控件。
- 不使用持续背景动画或重度毛玻璃。
- 长中文、英文 URL 与系统替代字体不得造成表单横向溢出；连接内容使用可收缩网格与明确最小宽度。
- 默认 BrowserWindow 为 1240×800，最小尺寸 960×640；P05 页面使用可收缩网格、文本截断与内容区独立滚动，960×640 自动化确认无应用级横向溢出。

## 分平台验证记录入口

实际截图与人工结果只写入 `docs/TEST-REPORT.md`：

- Windows 11 x64：必须在 Windows 实机单独启动并截图；macOS 截图不能代替。
- macOS Intel x64：必须在 Intel Mac 单独启动并截图。
- macOS Apple Silicon arm64：必须在 Apple Silicon Mac 单独启动 arm64 包并截图。

当前主机的 P05 截图位于 `artifacts/screenshots/p05-current-platform.png` 与 `p05-macos-x64-package.png`。macOS Intel 已检查 960×640 下的共享导航、中文搜索输入、艺术家/专辑/歌曲结果、播放器和长文本收缩，无截断或重叠；P04 截图继续保留。该目录是本地测试证据，不作为另一平台验收结论。
