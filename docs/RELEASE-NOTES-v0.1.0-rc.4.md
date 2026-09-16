# Sonavi 0.1.0-rc.4 测试版

这是 Sonavi 在 `v0.1.0-rc.3` 之后的下一个跨平台候选测试版，供 Windows 11 x64、macOS 13+ Intel x64 和 macOS 13+ Apple Silicon arm64 用户试用。

`v0.1.0-rc.3` 的构建源是版本提交 `cc33168`，**不包含 P11 独立审查之后的修复**；`v0.1.0-rc.4` 是首个包含 P11 修复的候选包，代码位为 `557b62d fix(p11): resolve release candidate audit issues`。

## 下载

- Windows x64：`Sonavi-0.1.0-rc.4-win-x64.exe`
- macOS Intel x64：`Sonavi-0.1.0-rc.4-mac-x64.dmg`
- macOS Apple Silicon arm64：`Sonavi-0.1.0-rc.4-mac-arm64.dmg`
- `SHA256SUMS.txt`：上述安装包和验证 manifest 的 SHA-256 校验值

## 相对 rc.3 的变化

- 媒体 URL 改为每次会话密钥加密、带会话 epoch 的无状态不透明 token，不再因 2,000 项全局 FIFO 淘汰队列音频；新增 10,000 个后续封面句柄后队列音频仍可解析的回归测试。
- `getArtists` 使用独立的 16 MiB 有界响应上限，其他 JSON API 仍保持 1 MiB。
- 真实 `ended` 状态也会触发一次 scrobble submission，仍按 `queueEntryId` 去重。
- 播放错误提供“重试播放”，原始流与 `transcodeOffset` 转码流均可按当前进度重建；专辑详情错误可原地重试。
- 生产 renderer CSP 收紧为 `connect-src 'self'`，不再保留 HMR WebSocket 来源（开发环境不受影响）。
- 专辑与搜索滚动自动分页、设置页改用项目自有 Select 组件、主题与滚动条、播放器状态宽度、账号入口和退出文案修正。
- 新的应用图标与 logo。

## 主要能力

- 安全连接 Navidrome/Subsonic/OpenSubsonic，浏览和搜索音乐库；
- 收藏、歌单、播放队列、歌词、播放上报、转码与完整时间线 seek；
- Windows/macOS 原生窗口生命周期、托盘或 Dock、Media Session 和暂停队列恢复；
- 安装包架构、应用元数据、资源、签名状态及 SHA-256 自动验证。

## 已知问题

`docs/KNOWN-ISSUES.md` 记录修复复核后仍然开放的问题：Blocker 0、Critical 0、Major 4。

- 真实大型艺术家索引仍需在发生过错误的真实 Navidrome 资料库复验；
- 真实服务器的 scrobble 计数口径仍需复验；
- 网络中断目前只有手动“重试播放”，没有自动恢复与退避；
- 真实音频格式矩阵（MP3、AAC/M4A、FLAC、Opus/Ogg 与真实转码输出）尚未建立，自动化只解码合成 PCM WAV。

自动化通过不等于真实服务器、真实音频格式或对应实机已经验证。

## 重要安全说明

本候选版尚未使用正式发行证书：Windows 安装包未进行 Authenticode 签名；macOS Intel 包未签名，Apple Silicon 包仅有 ad-hoc 签名；两个 macOS 包均未公证。系统可能显示未知发布者或阻止启动。请勿关闭 Gatekeeper、SmartScreen、TLS 或其他系统安全保护来绕过提示。

三个目标均在 GitHub 原生 runner 完成 lint、类型检查、单元/组件测试、依赖审计、源码 Electron 冒烟、安装包构建、包验证和打包应用 Electron 冒烟。CI 不替代最低系统版本、真实服务器、物理听音、系统媒体键、安装/卸载和签名后行为的完整人工验收，因此本版本不是正式稳定版。
