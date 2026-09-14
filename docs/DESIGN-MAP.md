# Sonavi 双平台设计映射

更新日期：2026-09-14

## 共用视觉来源

`Sonavi_UI_v0.1/` 是视觉参考包。共享 renderer 从 `tokens.css` 复用石色画布、白色抬升面、深色侧栏、琥珀强调、圆角和间距，并在 `src/renderer/src/styles/tokens.css` 增加跨平台中英文字体回退。用户在 2026-09-14 指定的方形橙色音符图作为当前 Sonavi 标志，原始像素副本保存在 `build/icon.png`，应用内副本保存在 `src/renderer/src/assets/sonavi-logo.png`。Tailwind CSS theme 映射既有 tokens，shadcn-vue 组件源码按相同视觉调整。

| 参考内容 | 共享实现 | 平台差异 |
| --- | --- | --- |
| 石色/琥珀 tokens | renderer CSS 变量 | 无 |
| Sonavi 标志 | 侧栏品牌位与 HTML 页面图标使用同一 PNG；electron-builder 以原图生成平台图标 | Windows 生成 ICO 资源，macOS 生成 ICNS 资源；外观需分别验收 |
| 左导航、内容区、底部播放器 | 单一 App.vue 外壳 | 无 |
| 连接表单 | 单一 ConnectPanel.vue | 设备名称由 preload 提供 |
| P03 专辑列表/详情 | 单一 LibraryPanel.vue；每页 30 张并显式加载更多 | 无；结果按平台分别截图验收 |
| P04 播放器 | 单一 PlayerBar.vue / AudioEngine；前后切歌、随机/循环、进度与音量 | 系统媒体集成留到 P09 |
| P04 播放队列 | 共用深石色浮层；重复项、删除、清空、上移/下移 | 无；键盘与外观按平台分别验收 |
| P05 首页/专辑 | 共用 LibraryPanel、专辑卡片与详情；首页最近添加，专辑页字母序分页 | 无；滚动与替代字体分别验收 |
| P05 艺术家 | 共用窗口化列表、圆形封面/字母占位与艺术家详情 | 无；超长列表性能分别验收 |
| P05 搜索 | 共用输入、艺术家/专辑/歌曲结果与加载/空/错误状态 | Ctrl/Cmd 只在未来快捷键入口适配，查询逻辑无平台分叉 |
| P05 设置 | 共用服务器/协议展示和断开/忘记操作 | 平台名称与后续系统集成由 preload/平台适配提供 |
| P06 收藏 | 共用艺术家/专辑/歌曲分区、详情跳转、取消收藏和歌曲播放/入队操作 | 无；写权限和布局按平台分别验收 |
| P06 歌单 | 共用列表/详情、创建/编辑/删除、当前队列追加、索引移除与整单播放 | 无；确认框使用 renderer 标准行为，系统外观分别验收 |
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

当前 P07 Windows x64 目录包截图位于 `artifacts/screenshots/p07-windows-x64-package.png` 与 `artifacts/screenshots/p07-lyrics-windows-x64-package.png`，已检查 960×640 下的歌词浮层、多行文本、活动行高亮、播放器和既有歌单页面，无明显截断、重叠或应用级横向溢出。历史 P05/P06 截图继续保留；本地截图不作为另一平台验收结论。
