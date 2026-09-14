# 项目交接

更新日期：2026-09-15

## 当前目标与状态

P01～P10 已按顺序落地到当前发布前代码闸门。P10 已在 macOS 13.7.8 Intel x64 生成未签名 DMG，完成包结构验证、只读挂载、复制到临时安装目录、真实 Electron 全链路冒烟和截图检查。该结果只证明当前 Intel Mac 的开发测试包；Windows 11、Apple Silicon、正式签名/公证、最低系统和完整人工发布验收仍未完成。

## 分支与工作区

- 分支：`main`；当前 HEAD 与 `origin/main` 同为 `fb430a1 feat(p08-p09): 完成网络策略与桌面集成`。
- 用户已推送 P08/P09。当前工作区是本轮 P10 源码、测试和文档增量，尚未提交或推送。
- `release/` 与 `artifacts/` 被忽略；本机 DMG、manifest 和截图不会随提交上传。
- 原始参考包保持未修改；不得重置或丢弃当前 P10 工作区。

## P10 已完成代码

- `scripts/verify-package.mjs` 固定三个首版目标，在对应系统检查安装包、应用可执行文件、架构、版本、应用标识、ASAR、运行时图标、签名状态和 SHA-256，并在 `release/<version>/` 写本地 manifest。
- macOS 检查单一 Mach-O 架构、`LSMinimumSystemVersion=13.0`、DMG 结构和 codesign；Windows 检查应用 PE x64 与 Authenticode。`SONAVI_REQUIRE_SIGNING=1` 会拒绝未签名候选。
- `scripts/run-packaged-smoke.mjs` 只允许在目标平台/架构启动对应打包应用，复用完整 Electron fixture；CI 在安装包生成后依次执行包验证和包内冒烟，不上传文件。
- `electron.vite.config.ts` 将 main 唯一外部运行时依赖 Zod 内联；electron-builder 排除 `node_modules`。macOS x64 ASAR 从约 55 MiB 降至 1,959,330 字节，验证器以 16 MiB 作为回归上限。
- macOS Info.plist 删除 Sonavi 未使用的相机、麦克风、蓝牙和音频采集说明；签名配置使用 `build/entitlements.mac.plist` 与 inherit 文件，仅保留 Electron 所需 JIT/可执行内存能力。
- renderer ESLint 继续禁止 Node/`process`，并新增禁止 localStorage、sessionStorage 和 `v-html`；凭据、持久化和 HTML 注入边界没有放宽。
- P07 scrobble 冒烟由固定等待改为最长 10 秒的条件等待，降低慢 CI 上的时序误报，不删除断言或降低功能要求。
- `docs/RELEASE-CHECKLIST.md` 记录三个目标的命令、签名/公证 secret 名称、安装/升级矩阵、发布闸门、回滚和 0.1.0 变更摘要，不包含真实凭据。

## 本轮实测

- `git diff --check` 与 `npm run lint`：最终复验通过，0 warning。
- `npm run typecheck`：最终复验通过；生产构建与源码 Electron 冒烟也重复通过三套类型检查。
- `npm test`：23 个文件、102 项通过；包验证器定向测试 6 项通过。
- `npm run test:e2e`：最终源码 Electron 完整通过；启动约 1556 ms，20 轮切页工作集增量约 51,340 KiB、媒体请求 +0。
- `npm audit --audit-level=high --registry=https://registry.npmjs.org`：0 vulnerabilities。
- `npm run build:mac:x64`：通过，生成 `release/0.1.0/Sonavi-0.1.0-mac-x64.dmg`；无 Developer ID，明确跳过签名。
- `npm run verify:package -- mac-x64`：通过；DMG 137,343,264 字节，SHA-256 `f5afe1f70024d71cdf319b561f4a59d0fb7c8fb4ffe682b889b6f6855a648074`，x64、`com.sonavi.desktop`、0.1.0、macOS 13.0、未签名。
- `npm run test:e2e:package -- mac-x64`：通过；启动约 1114 ms，20 轮切页工作集增量约 48,352 KiB、媒体请求 +0。
- 最终 DMG 通过校验后只读挂载，`Sonavi.app` 复制到临时安装目录并再次完整冒烟：启动约 1111 ms，切页工作集增量约 47,148 KiB、媒体请求 +0；验证后已卸载 DMG 并清理临时目录。
- 安装后冒烟覆盖安全偏好/CSP/preload、连接、两页专辑、流媒体、队列、歌词、scrobble、收藏/歌单、转码/seek、诊断、关闭隐藏、暂停队列、凭据跨进程恢复/删除与 safeStorage。
- 截图 `artifacts/screenshots/p10-macos-x64-dmg-installed.png` 与 `p10-macos-x64-dmg-installed-desktop.png` 已目视检查，无明显文字截断、重叠或应用级横向溢出。

## 已推送 CI 事实

GitHub Actions run `34842121215` 对应提交 `fb430a1`：

- Windows x64：lint、typecheck、96 项测试、源码 Electron 冒烟和 NSIS 构建成功；
- macOS Apple Silicon arm64：同组检查和 arm64 DMG 构建成功；
- macOS Intel x64：lint、typecheck、96 项测试成功，源码 Electron 冒烟失败，打包步骤跳过；公开 API 只返回步骤和 exit code，不开放详细日志。

因此 P08/P09 不能写成三目标全绿。当前 P10 增量尚未提交，新增的包验证与包内冒烟也未经过三目标 CI。

## 未验证与发布阻断项

- Windows 11 x64 当前 P10 NSIS 的包验证、安装、开始菜单/图标、卸载保留 userData、桌面行为和物理听音。
- macOS Apple Silicon 当前 P10 arm64 的包验证、安装、Dock/菜单栏/图标、桌面行为和物理听音。
- macOS Intel 的 Developer ID 签名、公证/stapling、隔离属性下 Gatekeeper 首次启动、Finder/Dock 图标遮罩、菜单栏逐项、物理媒体键、睡眠/锁屏和扬声器听音。
- 三个平台的真实服务器、真实大型资料库、最低系统版本和跨候选升级；0.1.0 是首个候选，没有旧公开版本迁移样本。
- Windows Authenticode 与 macOS Developer ID/公证均无真实凭据，本轮没有索取、使用或伪造签名成功。

## 下一入口

先复跑最终本机闸门并审查 diff；用户要求时提交 P10。提交后观察三目标 CI，尤其确认 macOS Intel 源码 Electron 冒烟是否因条件等待修正而稳定，并确认三个 job 的 `verify:package` 与 `test:e2e:package`。随后只在对应实机执行 `docs/RELEASE-CHECKLIST.md` 的安装/签名/公证矩阵；未经用户授权不推送、不上传安装包、不创建 Release、不索取签名密钥。
