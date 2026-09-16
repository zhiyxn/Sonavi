# Sonavi 发布前清单

更新日期：2026-09-16

本清单用于 P10 候选包验证，不代表已经授权公开发布。Windows 11 x64、macOS 13+ Intel x64 与 macOS 13+ Apple Silicon arm64 必须在各自目标系统构建和运行；在一台主机生成另一架构文件不能替代对应实机验收。

## 0.1.0 变更摘要

- 首版共享 Electron/Vue 桌面应用，正式、同等面向 Windows 11 x64 与 macOS 13+ x64/arm64。
- 支持安全连接 Navidrome/Subsonic/OpenSubsonic、音乐库与分页搜索、收藏和歌单写回。
- 支持单一 AudioEngine、队列、歌词、播放上报、原始/兼容转码、受能力约束的 seek 与网络诊断。
- 支持关闭隐藏继续播放、托盘/菜单栏、Media Session、暂停队列恢复与账号隔离封面缓存。
- P10 增加安装包架构/元数据/资源/签名状态/SHA-256 检查和打包应用 Electron 冒烟；移除未使用的 macOS 隐私权限说明，并从 ASAR 排除构建期依赖。

## 候选包命令

先在目标系统执行 `nvm use` 与 `npm ci`，再使用对应一组命令：

```sh
# Windows 11 x64
npm run build:win
npm run verify:package -- win-x64
npm run test:e2e:package -- win-x64

# macOS 13+ Intel x64
npm run build:mac:x64
npm run verify:package -- mac-x64
npm run test:e2e:package -- mac-x64

# macOS 13+ Apple Silicon arm64
npm run build:mac:arm64
npm run verify:package -- mac-arm64
npm run test:e2e:package -- mac-arm64
```

验证器会在 `release/<version>/` 写入本地 JSON 清单，记录目标、宿主、包大小、SHA-256、应用标识、版本、架构、资源和签名状态。普通 CI 只构建并验证，不上传安装包。只有用户明确授权后创建的 `v*-rc.*` 标签会触发候选发布工作流；标签必须等于 `v` 加 `package.json` 版本，三个原生目标会重新执行完整检查，全部通过后只上传三个安装包、三份 manifest 和 `SHA256SUMS.txt`，并标记为 Pre-release。

测试候选 `v0.1.0-rc.1` 与 `v0.1.0-rc.2` 均因 Electron release gate 失败而没有创建 Release，远端标签保留且不改写。`v0.1.0-rc.3` 已由 release run `35040657787` 完成三个原生目标门禁并发布为 Pre-release；其 Release notes 使用 `docs/RELEASE-NOTES-v0.1.0-rc.3.md` 的未签名/未公证提示，未标为 Latest 或正式稳定版。`v0.1.0-rc.3` 构建自版本提交 `cc33168`，不含 P11 修复；下一候选使用版本/标签 `0.1.0-rc.4` / `v0.1.0-rc.4`，其 Release notes 使用 `docs/RELEASE-NOTES-v0.1.0-rc.4.md`。发布 job 按标签名读取 `docs/RELEASE-NOTES-${GITHUB_REF_NAME}.md`，文件缺失时直接失败，不再写死具体候选版本，也不得把任何候选标为 Latest 或正式稳定版。

## 签名与公证接口

仓库不保存证书、私钥、密码、API key 或示例秘密值。实际发布时由受保护的 CI secret 或本机密钥链提供：

- Windows Authenticode：`WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`，或 electron-builder v26 支持的 `CSC_LINK` / `CSC_KEY_PASSWORD`；
- macOS Developer ID：`CSC_LINK` / `CSC_KEY_PASSWORD`；
- macOS 公证优先使用 App Store Connect API key：`APPLE_API_KEY`、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER`。

设置 `SONAVI_REQUIRE_SIGNING=1` 后再运行 `verify:package`，未取得有效发布签名会直接失败。Apple Silicon 无证书构建可能带有 Mach-O linker ad-hoc seal，清单会如实写为 `ad-hoc`，它与 `unsigned` 一样不属于发行签名。macOS 正式候选还必须另外通过 `codesign --verify --deep --strict`、`xcrun stapler validate` 与 `spctl`；Windows 正式候选必须由目标机确认 Authenticode 状态为 `Valid`、发布者正确且 SmartScreen/UAC 文案符合预期。未签名/ad-hoc 包只能内部开发测试，不能要求用户关闭 Gatekeeper、SmartScreen 或证书验证。

## 安装与升级人工矩阵

每个平台分别记录以下结果，不能用 CI 或另一平台截图替代：

- 全新安装、开始菜单或 Finder/Dock 图标、原生窗口控件、首次启动；
- 安装后 preload、CSP、`sonavi-media`、Range、播放、网络请求和 safeStorage；
- 默认关闭隐藏、最小化、重新激活、托盘/菜单栏、真正退出、媒体键、睡眠/锁屏；
- 用户配置只进入 Electron `userData`，安装目录保持只读且不出现凭据或缓存；
- 用同一 `userData` 从前一候选升级，连接、主题、音量、窗口、暂停队列和封面缓存行为符合当前 schema；
- 卸载默认保留用户数据（`deleteAppDataOnUninstall: false`），清除账号必须由应用内显式“退出并忘记账号”完成；
- 长中文/英文、系统字体、125%/150% 缩放、最小窗口与图标遮罩无截断或重叠；
- 真实服务器、真实音频输出和目标系统最低版本单独验证。

0.1.0 是首个候选版本，没有可执行的“既有公开版本 → 0.1.0”迁移样本。当前自动化只证明 versioned userData 在同一候选进程重启后可以恢复；跨版本升级仍必须在后续候选上实测。

## 发布闸门

发布前必须同时满足：

- `npm ci`、lint、typecheck、100+ 项单元/组件测试、源码 Electron 冒烟全部通过；
- 三个目标的安装包构建、`verify:package` 与打包应用 Electron 冒烟全部通过；
- 三个平台对应实机完成安装、截图、音频、桌面行为、安全存储和升级矩阵；
- `npm audit --audit-level=high --registry=https://registry.npmjs.org` 无未处置高危问题；
- 正式包具有有效签名；macOS 包已公证并 stapled；校验值与待发布文件一致；
- Release notes 明确已通过、未验证和已知问题，并经用户授权后才上传或发布。

## 回滚

Sonavi 当前没有自动更新器。发布失败时停止分发问题候选，保留上一份已验证且已签名的安装包和对应 SHA-256；回退应用二进制前备份 Electron `userData`。不得用删除整个用户目录作为常规回滚。若新版本引入不可逆 schema，必须先提供显式迁移/降级方案；当前 v1 凭据与桌面状态文件尚未引入不可逆迁移。
