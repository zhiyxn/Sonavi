# Sonavi 双平台设计映射

更新日期：2026-09-15

## 共用视觉来源

`Sonavi_UI_v0.1/` 是视觉参考包。共享 renderer 从 `tokens.css` 复用石色画布、白色抬升面、深色侧栏、琥珀强调、圆角和间距，并在 `src/renderer/src/styles/tokens.css` 增加跨平台中英文字体回退。用户在 2026-09-14 指定的方形橙色音符图作为当前 Sonavi 标志，原始像素副本保存在 `build/icon.png`，应用内副本保存在 `src/renderer/src/assets/sonavi-logo.png`。Tailwind CSS theme 映射既有 tokens，shadcn-vue 组件源码按相同视觉调整。

| 参考内容 | 共享实现 | 平台差异 |
| --- | --- | --- |
| 石色/琥珀 tokens | renderer CSS 变量 | 无 |
| Sonavi 标志 | 侧栏品牌位与 HTML 页面图标使用同一 PNG；electron-builder 以原图生成平台图标 | Windows 生成 ICO 资源，macOS 生成 ICNS 资源；外观需分别验收 |
| 左导航、内容区、底部播放器 | 单一 App.vue 外壳 | 无 |
| 连接表单 | 单一 ConnectPanel.vue | 设备名称由 preload 提供 |
| P03 专辑列表/详情 | 单一 LibraryPanel.vue；每页 30 张并使用 shadcn-vue Pagination 显式翻页 | 无；结果按平台分别截图验收 |
| P04/P09 播放器 | 单一 PlayerBar.vue / AudioEngine；前后切歌、随机/循环、进度与音量；进度和音量使用 shadcn-vue Slider，Media Session 元数据与动作复用同一 store | Windows/macOS 媒体键由 Chromium 映射，需分别人工复验 |
| P04 播放队列 | 共用深石色浮层；重复项、删除、清空、上移/下移 | 无；键盘与外观按平台分别验收 |
| P05 首页/专辑 | 共用 LibraryPanel、专辑卡片与详情；首页最近添加，专辑页字母序，分别保留当前页；刷新只重取当前页或详情 | 无；滚动与替代字体分别验收 |
| P05 艺术家 | 共用窗口化列表、圆形封面/字母占位与艺术家详情；刷新只重取当前列表或详情 | 无；超长列表性能分别验收 |
| P05 搜索 | 共用输入、艺术家/专辑/歌曲结果与加载/空/错误状态；切页保留搜索状态并可手动刷新结果 | Ctrl/Cmd 只在未来快捷键入口适配，查询逻辑无平台分叉 |
| P05/P09 设置 | 共用服务器/协议、播放/网络、关闭动作、主题、封面缓存和断开/忘记操作；输入、标签与选择控件使用项目持有的 shadcn-vue 源码 | 平台名称与托盘/Dock 说明由 preload/平台适配提供 |
| P09 桌面宿主 | renderer 只显示统一设置与播放状态，不绘制托盘或 Dock 控件 | Windows 托盘、macOS 菜单栏/Dock；两端关闭默认隐藏同一窗口 |
| P06 收藏 | 共用艺术家/专辑/歌曲分区、详情跳转、取消收藏和歌曲播放/入队操作 | 无；写权限和布局按平台分别验收 |
| P06 歌单 | 共用列表/详情、创建/编辑/删除、当前队列追加、索引移除与整单播放 | 无；删除确认统一使用 shadcn-vue AlertDialog |
| 数据页缓存与刷新 | 首页、专辑、艺术家、搜索、收藏和歌单保留已访问实例与会话查询缓存；刷新按钮仅刷新当前视图 | 无；断开或网络上下文变化时统一清除 |
| 账号退出 | 同一断开/忘记账号逻辑；忘记账号使用 shadcn-vue AlertDialog 二次确认 | 文案不假设某一系统；系统凭据由 main 删除 |
| 设置快捷键提示 | 同一文案槽位 | Windows Ctrl；macOS Cmd |
| 标题栏 | 不在 renderer 绘制 | 使用各自原生边框与按钮 |
| 字体 | 同一 fallback 列表 | Windows 优先 Segoe UI/微软雅黑；macOS 优先苹方/冬青黑体 |

## 桌面外观规则

- 不渲染假的 macOS 红黄绿按钮，不隐藏原生 Windows 控件。
- 不使用持续背景动画或重度毛玻璃。
- 长中文、英文 URL 与系统替代字体不得造成表单横向溢出；连接内容使用可收缩网格与明确最小宽度。
- 默认 BrowserWindow 为 1240×800，最小尺寸 960×640；P05 页面使用可收缩网格、文本截断与内容区独立滚动，960×640 自动化确认无应用级横向溢出。
- P09 增加浅色/深色两组 Sonavi token；主题只切换共享 CSS 变量，不复制页面。托盘图标使用同一 `build/icon.png`，macOS 运行时转为 18px template image，Windows 保留彩色系统托盘图标。

## 分平台验证记录入口

实际截图与人工结果只写入 `docs/TEST-REPORT.md`：

- Windows 11 x64：必须在 Windows 实机单独启动并截图；macOS 截图不能代替。
- macOS Intel x64：必须在 Intel Mac 单独启动并截图。
- macOS Apple Silicon arm64：必须在 Apple Silicon Mac 单独启动 arm64 包并截图。

当前 P10 macOS Intel DMG 临时安装截图位于 `artifacts/screenshots/p10-macos-x64-dmg-installed.png` 与 `p10-macos-x64-dmg-installed-desktop.png`，已检查浅色/深色共享 token、中文/英文混排、导航、播放器和 960×640 布局，无明显截断、重叠或应用级横向溢出。截图没有覆盖 Finder 中的 DMG 窗口、Dock 图标系统遮罩、菜单栏下拉、物理媒体键和睡眠/恢复，因此这些项目仍标未验证。Windows 与 Apple Silicon 仍必须分别安装并截图；任何单平台截图都不作为另一平台验收结论。
