# Sonavi 0.1.0-rc.3 测试版

这是 Sonavi 首个可下载的跨平台候选测试版，供 Windows 11 x64、macOS 13+ Intel x64 和 macOS 13+ Apple Silicon arm64 用户试用。`rc.1` 与 `rc.2` 均因发布闸门中的 Electron 冒烟失败而没有创建 Release；`rc.3` 修复了歌单写后刷新、断开时暂停队列保存和慢速 runner 自然切歌造成的时序问题，并重新执行全部平台门禁。

## 下载

- Windows x64：`Sonavi-0.1.0-rc.3-win-x64.exe`
- macOS Intel x64：`Sonavi-0.1.0-rc.3-mac-x64.dmg`
- macOS Apple Silicon arm64：`Sonavi-0.1.0-rc.3-mac-arm64.dmg`
- `SHA256SUMS.txt`：上述安装包和验证 manifest 的 SHA-256 校验值

## 主要能力

- 安全连接 Navidrome/Subsonic/OpenSubsonic，浏览和搜索音乐库；
- 收藏、歌单、播放队列、歌词、播放上报、转码与完整时间线 seek；
- Windows/macOS 原生窗口生命周期、托盘或 Dock、Media Session 和暂停队列恢复；
- 安装包架构、应用元数据、资源、签名状态及 SHA-256 自动验证。

## 重要安全说明

本候选版尚未使用正式发行证书：Windows 安装包未进行 Authenticode 签名；macOS Intel 包未签名，Apple Silicon 包仅有 ad-hoc 签名；两个 macOS 包均未公证。系统可能显示未知发布者或阻止启动。请勿关闭 Gatekeeper、SmartScreen、TLS 或其他系统安全保护来绕过提示。

三个目标均在 GitHub 原生 runner 完成 lint、类型检查、单元/组件测试、源码 Electron 冒烟、安装包构建、包验证和打包应用 Electron 冒烟。CI 不替代最低系统版本、真实服务器、物理听音、系统媒体键、安装/卸载和签名后行为的完整人工验收，因此本版本不是正式稳定版。
