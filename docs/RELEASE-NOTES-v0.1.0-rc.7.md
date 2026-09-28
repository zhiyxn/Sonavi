# Sonavi 0.1.0-rc.7 测试版

这是 `v0.1.0-rc.6` 之后的跨平台候选测试版，供 Windows 11 x64、macOS 13+ Intel x64 和 macOS 13+ Apple Silicon arm64 用户试用。

本版本继续以 GitHub **Pre-release** 形式提供，未标记为 Latest 或正式稳定版。

## 下载

- Windows x64：`Sonavi-0.1.0-rc.7-win-x64.exe`
- macOS Intel x64：`Sonavi-0.1.0-rc.7-mac-x64.dmg`
- macOS Apple Silicon arm64：`Sonavi-0.1.0-rc.7-mac-arm64.dmg`
- `SHA256SUMS.txt`：上述安装包和验证 manifest 的 SHA-256 校验值

## 相对 rc.6 的主要变化

- 设置页新增界面语言选择，仅提供简体中文和英文；选择会持久化并在重启后恢复。
- renderer、通知、可访问名称、Windows/macOS 原生菜单及托盘/菜单栏文案使用同一语言偏好，并可即时切换。
- 修复切换语言后选择框已选文本仍显示旧语言、需要再次点击才刷新的问题，覆盖关闭行为、外观、播放模式、码率、代理与歌词版本。
- 安装包只保留简体中文和英文 Electron locale；不删除 Chromium、FFmpeg、GPU 回退或许可文件。
- 歌曲收藏按钮改为心形图标，艺术家和专辑继续使用文字按钮；收藏协议和服务端同步逻辑不变。
- 专辑、艺术家、收藏和歌单详情的返回按钮统一显示“返回”或 `Back`，不改变逐级导航与滚动恢复。

## 验证状态

- macOS Intel x64 本地已通过 lint、三组 typecheck、36 个测试文件/214 项测试、生产构建、源码 Electron 冒烟和裁剪后目录包冒烟。
- 当前 macOS Intel 未签名目录包只保留 `en.lproj` 与 `zh_CN.lproj`，应用约 259.6 MiB；该数字不是 DMG 下载体积，也不代表其他平台。
- Windows x64、macOS Intel x64 与 macOS Apple Silicon arm64 必须在本次 GitHub 原生 runner 上重新通过完整 release gate，才会创建本 Pre-release。

## 已知限制

- Windows 和 macOS Apple Silicon 的本轮语言切换与 locale 裁剪尚未人工复验；Apple Silicon arm64 仍无实机安装和物理听音证据。
- 新安装包仍需人工复验安装、升级、卸载、中文/英文系统界面、真实播放和完整桌面行为。
- 当前没有自动更新器；候选版升级与回滚需人工完成。

## 重要安全说明

本候选版尚未使用正式发行证书：Windows 安装包未进行 Authenticode 签名；macOS Intel 包未签名，Apple Silicon 包可能只有 ad-hoc 签名；两个 macOS 包均未公证。系统可能显示未知发布者或阻止启动。

仅在确认下载来自本项目 GitHub Release 且 SHA-256 与 `SHA256SUMS.txt` 一致后试用。不要关闭 Gatekeeper、SmartScreen、TLS 或其他系统安全保护；可信用户如被 macOS 拦截，应使用“系统设置 → 隐私与安全性 → 仍要打开”的系统入口。
