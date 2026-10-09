# Sonavi 0.1.0-rc.8 测试版

这是 `v0.1.0-rc.7` 之后的跨平台候选测试版，供 Windows 11 x64、macOS 13+ Intel x64 和 macOS 13+ Apple Silicon arm64 用户试用。

本版本以 GitHub **Pre-release** 形式提供，未标记为 Latest 或正式稳定版。

## 下载

- Windows x64：`Sonavi-0.1.0-rc.8-win-x64.exe`
- macOS Intel x64：`Sonavi-0.1.0-rc.8-mac-x64.dmg`
- macOS Apple Silicon arm64：`Sonavi-0.1.0-rc.8-mac-arm64.dmg`
- `SHA256SUMS.txt`：上述安装包和三份验证 manifest 的 SHA-256 校验值

## 相对 rc.7 的主要变化

- 设置页显示当前版本，支持手动检查公开 GitHub Releases；启动时自动检查默认开启，可关闭并保存偏好。
- RC 可发现更高的 RC 或正式版，正式版只提示更高的正式版。当前包未签名也可检查，不依赖自动更新清单或 macOS ZIP 附件。
- 启动检查结果保留在设置页，打开设置即可查看已发现的新版本和下载入口，无需再次检查。
- 若新版本已上传当前系统与架构的 EXE/DMG，点击“下载当前系统安装包”会在默认浏览器打开固定仓库的对应附件；缺少对应安装包时仍可查看发布页。
- 设置页七个分组统一使用边框内标题，中英文文案同步；README 补齐多服务器、双语界面、暂停队列恢复与更新说明。
- 更新存在高危漏洞的传递依赖；CI 在并行测试前显式安装锁定的 Electron 运行时，避免首次加载时并发解压冲突。

下载进度由浏览器显示，安装由用户完成；应用不会自动下载、安装或因更新重启。检查失败不阻断启动、连接或播放，手动检查可重试。

## 验证状态

- macOS Intel x64 本地已通过 lint、三组 typecheck、37 个测试文件/221 项测试、生产构建和源码 Electron 冒烟；最终 rc.8 发布准备的命令与结果记录在 `docs/TEST-REPORT.md`。
- Windows x64、macOS Intel x64 与 macOS Apple Silicon arm64 必须在本次 GitHub 原生 runner 上通过完整 release gate（含依赖审计、包验证及包内 Electron 冒烟），才会创建本 Pre-release。
- 版本检测、平台附件筛选和设置页状态已由模拟 Release 数据覆盖；模拟检查不代表真实下载或升级验收。

## 已知限制与升级

- 真实新版本检查、浏览器下载、跨版本安装及升级后凭据、设置和暂停队列恢复尚未验证；本轮 Windows x64、macOS arm64 实机验证未完成，Apple Silicon arm64 仍缺少人工安装和物理听音证据。
- 已发布 rc.7 安装包不包含检查更新功能；首次升级到 rc.8 需从本 Release 手动下载。rc.8 的更新检查用于发现后续更高版本。
- 下载后先校验 SHA-256，退出 Sonavi 再安装。回滚前备份 Electron `userData`，不要删除用户数据来完成升级或回滚。
- 真实服务器的艺术家请求与播放记录上报仍有待复验项，详见 `docs/KNOWN-ISSUES.md`；此版不声称全部真实服务问题已关闭。
- 发布前依赖审计高危 0 项，仍有 8 项中危构建工具链传递依赖；未使用 `--force` 降级 electron-builder。

## 重要安全说明

本候选版尚未使用正式发行证书：Windows 安装包未进行 Authenticode 签名；macOS Intel 包未签名，Apple Silicon 包可能只有 ad-hoc 签名；两个 macOS 包均未公证。系统可能显示未知发布者或阻止启动。

仅在确认下载来自本项目 GitHub Release 且 SHA-256 与 `SHA256SUMS.txt` 一致后试用。不要关闭 Gatekeeper、SmartScreen、TLS 或其他系统安全保护；可信文件如被 macOS 拦截，应使用“系统设置 → 隐私与安全性 → 仍要打开”的系统入口。
