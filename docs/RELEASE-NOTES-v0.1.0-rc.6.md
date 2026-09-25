# Sonavi 0.1.0-rc.6 测试版

这是 `v0.1.0-rc.5` 之后的跨平台候选测试版，供 Windows 11 x64、macOS 13+ Intel x64 和 macOS 13+ Apple Silicon arm64 用户试用。

本版本继续以 GitHub **Pre-release** 形式提供，未标记为 Latest 或正式稳定版。

## 下载

- Windows x64：`Sonavi-0.1.0-rc.6-win-x64.exe`
- macOS Intel x64：`Sonavi-0.1.0-rc.6-mac-x64.dmg`
- macOS Apple Silicon arm64：`Sonavi-0.1.0-rc.6-mac-arm64.dmg`
- `SHA256SUMS.txt`：上述安装包和验证 manifest 的 SHA-256 校验值

## 相对 rc.5 的主要变化

- 移除首页和独立搜索页，连接、恢复和切换服务器后默认进入专辑页。
- 新增“音乐”栏目，可按页浏览歌曲，并直接播放、追加队列或收藏。
- 搜索分别集成到音乐、专辑和艺术家页；三类结果使用独立的 OpenSubsonic `search3` offset/count 窗口。
- 艺术家页改为服务端分页，每页最多 50 位，不再一次加载完整艺术家索引；艺术家详情与专辑来源链保持不变。
- 艺术家列表使用工作区自然滚动，取消固定 480px 内层滚动窗口。
- 音乐、专辑和艺术家页的搜索条在滚动时固定于工作区顶部，并增加与结果内容的间距。
- 保留 rc.5 的单实例唤醒、多服务器加密管理、服务器切换确认、深色歌词对比度、队列恢复与安全媒体句柄行为。

## 验证状态

- macOS Intel x64 本地源码闸门已通过：lint、三组 typecheck、35 个测试文件/205 项测试、生产构建与 Electron 完整冒烟。
- 本地 Electron 冒烟同时验证了服务器添加/切换/删除、单实例唤醒、默认专辑、三页搜索/分页、艺术家自然滚动与搜索条吸顶。
- 用户已对当前 macOS Intel 源码构建执行人工试用，未发现新问题。
- Windows x64、macOS Intel x64 与 macOS Apple Silicon arm64 必须在本次 GitHub 原生 runner 上重新通过完整 release gate，才会创建本 Pre-release。

## 已知限制

- 不同 Navidrome/Subsonic/OpenSubsonic 服务对 `search3` 空查询的实际兼容性、大型库末页与响应性能仍需更多真实服务覆盖。
- macOS Apple Silicon arm64 尚无实机安装、物理听音、菜单栏、媒体键、锁屏与睡眠验收。
- Windows 与 macOS 新安装包仍需人工复验安装、升级、卸载、真实播放和完整桌面行为。
- 当前没有自动更新器；候选版升级与回滚需人工完成。

## 重要安全说明

本候选版尚未使用正式发行证书：Windows 安装包未进行 Authenticode 签名；macOS Intel 包未签名，Apple Silicon 包可能只有 ad-hoc 签名；两个 macOS 包均未公证。系统可能显示未知发布者或阻止启动。

仅在确认下载来自本项目 GitHub Release 且 SHA-256 与 `SHA256SUMS.txt` 一致后试用。不要关闭 Gatekeeper、SmartScreen、TLS 或其他系统安全保护；可信用户如被 macOS 拦截，应使用“系统设置 → 隐私与安全性 → 仍要打开”的系统入口。
