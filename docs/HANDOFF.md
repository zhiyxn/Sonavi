# 项目交接

更新日期：2026-09-16

## 当前目标与状态

P01～P10 已完成，当前处于 P11 Release Candidate 独立审查、修复与真机测试准备。未换框架或大重构，也未配置签名/公证/自动更新或发布 Release。修复后 Windows 自动化允许进入真机测试，当前为 0 Blocker、0 Critical、4 Major；仍不能判定为发布就绪。完整结论见 `docs/RC-AUDIT.md`、`docs/TEST-MATRIX.md` 与 `docs/KNOWN-ISSUES.md`。

P11 原 Critical 已修复：媒体句柄改为会话密钥加密、带 epoch 的无状态 token，不再因 2,000 项 FIFO 淘汰；10,000 个后续封面句柄回归测试通过。用户真实 Windows 记录 `docs/Existing issues.md` 中的艺术家大响应、后续播放、scrobble 和 UI 问题均有针对性代码修复，但艺术家/scrobble 必须回到原服务器复验，不能仅凭 fixture 宣称关闭。

## 分支与工作区

- P11 审查起点为 `e304fb2`；新 logo `build/icon.png`、`src/renderer/src/assets/sonavi-logo.png` 与 `docs/Existing issues.md` 已随提交 `557b62d` 一并提交，工作区无未提交修改。
- P11 已按用户要求修改产品代码和审查文档，并随提交 `557b62d` 推送到 `main`；候选发布只在用户明确授权后执行。
- 分支：`main`；`1f23427 fix(p10): 稳定 macOS 冒烟与队列持久化` 随文档提交 `51cf322` 进入 run `34934352140`，三个原生目标的完整 CI 均通过。
- 提交 `9a7af94 ci(release): 添加跨平台候选发布流程` 将版本推进到 `0.1.0-rc.1`，增加标签驱动的 GitHub Pre-release 工作流、资产收集校验与候选版说明；`v0.1.0-rc.1` 已推送，但发布 run `34937503560` 被 Intel 源码冒烟失败阻断，未创建 Release。
- 提交 `54e15df test(e2e): 输出 CI 失败摘要` 为 Electron 冒烟增加脱敏 Check Summary 失败栈；断言与失败条件没有放宽。其 run `34938572347` 的三个目标全部通过，Intel 失败没有稳定复现。
- `v0.1.0-rc.2` 发布 run `35036809845` 再次被 Intel 源码 Electron 冒烟阻断；Windows x64 与 Apple Silicon arm64 通过，发布 job 跳过，未创建 Release。
- 提交 `6842e3d` 修复歌单写后刷新等待和断开连接时空队列覆盖暂停队列的竞态，增加断开顺序回归测试；提交 `09b1ab0` 改为按断开前实际当前歌曲验证落盘与重启恢复。run `35039453442` 的三个目标完整通过。
- 提交 `cc33168 chore(release): 准备 v0.1.0-rc.3` 通过普通 CI run `35040182258` 后创建标签；release run `35040657787` 的三个目标与发布 job 全部通过，GitHub Pre-release 已创建并包含七个预期附件。该候选构建自 `cc33168`，不含 P11 修复。
- 提交 `557b62d fix(p11): resolve release candidate audit issues` 通过普通 CI run `35061052839` 后，版本推进到 `0.1.0-rc.4`，发布 job 的 Release notes 改为按 `docs/RELEASE-NOTES-${GITHUB_REF_NAME}.md` 解析并在缺失时失败。提交 `acb7c8c chore(release): 准备 v0.1.0-rc.4` 通过普通 CI run `35062596436` 后创建标签；release run `35063014155` 的三个目标与发布 job 全部通过，GitHub Pre-release 已创建并包含七个预期附件。
- `release/` 与 `artifacts/` 被忽略；本机 DMG、manifest 和截图不会随提交上传。
- 原始参考包保持未修改；不得重置或丢弃当前 P10 工作区。

## P10 已完成代码

- `scripts/verify-package.mjs` 固定三个首版目标，在对应系统检查安装包、应用可执行文件、架构、版本、应用标识、ASAR、运行时图标、签名状态和 SHA-256，并在 `release/<version>/` 写本地 manifest。
- macOS 检查单一 Mach-O 架构、`LSMinimumSystemVersion=13.0`、DMG 结构和 codesign；区分 Intel `unsigned`、arm64 linker `ad-hoc` 与 Developer ID。Windows 先检查应用 PE x64/Certificate Table，有表才调用 Authenticode。`SONAVI_REQUIRE_SIGNING=1` 会拒绝 unsigned/ad-hoc/非发行身份。
- `scripts/run-packaged-smoke.mjs` 只允许在目标平台/架构启动对应打包应用，复用完整 Electron fixture；普通 CI 在安装包生成后依次执行包验证和包内冒烟，不上传文件。
- `scripts/prepare-release.mjs` 强制候选标签与 `package.json` 版本一致，只收集三个安装包和三份验证 manifest，并为六个文件生成统一 `SHA256SUMS.txt`。`.github/workflows/release.yml` 只有在三个原生目标重新通过完整闸门后才创建 Pre-release。
- `electron.vite.config.ts` 将 main 唯一外部运行时依赖 Zod 内联；electron-builder 排除 `node_modules`。macOS x64 ASAR 从约 55 MiB 降至 1,959,330 字节，验证器以 16 MiB 作为回归上限。
- macOS Info.plist 删除 Sonavi 未使用的相机、麦克风、蓝牙和音频采集说明；签名配置使用 `build/entitlements.mac.plist` 与 inherit 文件，仅保留 Electron 所需 JIT/可执行内存能力。
- renderer ESLint 继续禁止 Node/`process`，并新增禁止 localStorage、sessionStorage 和 `v-html`；凭据、持久化和 HTML 注入边界没有放宽。
- P07 scrobble、P08 转码 seek 和初次 HTMLAudioElement 流请求冒烟均使用最长 10 秒的真实请求条件等待，降低慢 CI 上的时序误报，不删除断言或降低功能要求。
- 暂停队列保存由防抖、串行协调器管理；显式 flush 会保存最新快照并等待 IPC 完成。断开连接前执行 flush；真正退出由 main 发出 `prepare-to-quit`，renderer flush 后确认再退出，并有 5 秒超时兜底。E2E 在关闭进程前确认隔离 userData 中的非敏感队列状态已经落盘。
- `docs/RELEASE-CHECKLIST.md` 记录三个目标的命令、签名/公证 secret 名称、安装/升级矩阵、发布闸门、回滚和 0.1.0 变更摘要，不包含真实凭据。

## 本轮实测

- `git diff --check` 与 `npm run lint`：最终复验通过，0 warning。
- `npm run typecheck`：最终复验通过；生产构建与源码 Electron 冒烟也重复通过三套类型检查。
- 当前 Windows 主机：Windows 10.0.26200 x64，Node.js v22.21.1，npm 10.9.4；未替代 macOS 或 Windows 11 最低目标实机。
- `npm test`：24 个文件、109 项通过；除显式 queue flush 定向测试外，新增断开时暂停/保存/清队列顺序、候选标签匹配、允许附件收集和 SHA-256 清单测试。
- `npm run test:e2e`：当前 Windows 源码 Electron 完整通过；最近一次启动约 489 ms，20 轮切页工作集增量约 51,188 KiB、媒体请求 +0；真实音频请求等待、队列落盘证据、退出握手与跨进程恢复均通过。
- `npm audit --audit-level=high --registry=https://registry.npmjs.org`：0 vulnerabilities。
- `npm run build:mac:x64`：通过，生成 `release/0.1.0/Sonavi-0.1.0-mac-x64.dmg`；无 Developer ID，明确跳过签名。
- `npm run verify:package -- mac-x64`：通过；DMG 137,343,264 字节，SHA-256 `f5afe1f70024d71cdf319b561f4a59d0fb7c8fb4ffe682b889b6f6855a648074`，x64、`com.sonavi.desktop`、0.1.0、macOS 13.0、未签名。
- `npm run build:mac:arm64` 与 `npm run verify:package -- mac-arm64`：当前 Intel 主机交叉构建/结构验证通过；DMG 133,110,010 字节，目标 arm64，签名状态 `ad-hoc`；严格发行门禁按预期拒绝。
- `npm run build:win`：当前 Windows 主机对 `0.1.0-rc.1` 通过；生成未签名 x64 NSIS，文件名包含完整候选版本。
- `npm run verify:package -- win-x64`：候选包通过；NSIS 113,417,840 字节，SHA-256 `be1d1d1bb9d56394ae38e3270cf692c627bb3383de6480b97efa28458e489a8a`，应用 x64、0.1.0-rc.1、ASAR/图标正常、签名状态 `unsigned`。
- `npm run test:e2e:package -- win-x64`：候选包完整通过；启动约 745 ms，20 轮切页工作集增量约 48,480 KiB、媒体请求 +0，包含持久化与退出握手验证。
- `npm run test:e2e:package -- mac-x64`：修复后完整复跑通过；启动约 1770 ms，20 轮切页工作集增量约 51,872 KiB、媒体请求 +0。
- 最终 DMG 通过校验后只读挂载，`Sonavi.app` 复制到临时安装目录并再次完整冒烟：启动约 1111 ms，切页工作集增量约 47,148 KiB、媒体请求 +0；验证后已卸载 DMG 并清理临时目录。
- 安装后冒烟覆盖安全偏好/CSP/preload、连接、两页专辑、流媒体、队列、歌词、scrobble、收藏/歌单、转码/seek、诊断、关闭隐藏、暂停队列、凭据跨进程恢复/删除与 safeStorage。
- 截图 `artifacts/screenshots/p10-macos-x64-dmg-installed.png` 与 `p10-macos-x64-dmg-installed-desktop.png` 已目视检查，无明显文字截断、重叠或应用级横向溢出。

## 已推送 CI 事实

GitHub Actions run `34912793294` 对应提交 `ce82e9e`，三个 job 的 lint、typecheck 和 105 项测试均通过：

- Windows x64：源码 Electron、NSIS、包验证与包内 Electron 冒烟全通过；
- macOS Apple Silicon arm64：源码 Electron、arm64 DMG 与包验证通过；包内冒烟在 UI 已进入 playing、fixture 请求尚未抵达测试数组时同步断言失败；
- macOS Intel x64：源码 Electron 冒烟完成主要业务与性能段，断开后重启时暂停队列曲目未在 30 秒内显示，后续打包跳过。

run `34934352140` 已确认 `1f23427` 的两处修复在 Windows x64、macOS Intel x64 与 macOS arm64 的源码和打包应用完整冒烟均通过。

候选 release run `35036809845` 对 `v0.1.0-rc.2` 再次执行门禁：Windows x64 和 macOS Apple Silicon arm64 通过，macOS Intel x64 源码冒烟失败，因而没有创建 Release。后续公开检查注释定位并修复三处慢速 runner 时序问题；普通 CI run `35039453442` 已确认 Windows x64、macOS Intel x64 与 macOS arm64 的源码、打包、包验证和打包应用冒烟全部通过。

版本提交 `cc33168` 的普通 CI run `35040182258` 与标签发布 run `35040657787` 均在三个目标完整通过。Release `https://github.com/zhiyxn/Sonavi/releases/tag/v0.1.0-rc.3` 为非草稿 Pre-release、不是 Latest；附件包含三个安装包、三个验证 manifest 与一份覆盖六个文件的 `SHA256SUMS.txt`。

标签 `v0.1.0-rc.4` 的 Release 为 `https://github.com/zhiyxn/Sonavi/releases/tag/v0.1.0-rc.4`，非草稿 Pre-release、不是 Latest（仓库当前没有 Latest）；附件为三个安装包、三个验证 manifest 与一份覆盖六个文件的 `SHA256SUMS.txt`。

## 未验证与发布阻断项

- Windows 11 x64 当前 P10 NSIS 的实际安装、开始菜单/图标、卸载保留 userData、桌面行为和物理听音；当前 Windows 构建 10.0.26200 的未安装目录包不替代这些验收。
- macOS Apple Silicon 当前 P10 arm64 的修复后包内冒烟、安装、Dock/菜单栏/图标、桌面行为和物理听音；`ce82e9e` 的原生包验证已经通过。
- macOS Intel 的 Developer ID 签名、公证/stapling、隔离属性下 Gatekeeper 首次启动、Finder/Dock 图标遮罩、菜单栏逐项、物理媒体键、睡眠/锁屏和扬声器听音。
- 三个平台的真实服务器、真实大型资料库、最低系统版本和跨候选升级；0.1.0 是首个候选，没有旧公开版本迁移样本。
- Windows Authenticode 与 macOS Developer ID/公证均无真实凭据，本轮没有索取、使用或伪造签名成功。

## P11 问题修复复验（2026-09-16）

- 修复内容：无状态加密媒体句柄与会话撤销、`getArtists` 独立 16 MiB 上限、ended scrobble、播放错误手动断点重试、专辑错误重试、生产 CSP、自动分页、设置 Select、主题/滚动条/状态宽度及文案/入口修正。
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build` 和 `npm run test:e2e` 均通过；Vitest 为 24 个文件、115 项。
- 源码 Electron 冒烟通过；启动 694 ms，20 轮切页内存增量 51,720 KiB、媒体请求 +0。数值是单次样本，不是性能承诺。
- Windows x64 NSIS 构建和包验证通过：安装包 112,788,192 字节，SHA-256 `72a5be09328afe0cceff365e85414880acd19e06c32cbae1265abebe0c5b9aac`，应用 unsigned，ASAR 1,862,401 字节。
- Windows 打包应用完整冒烟通过；启动 814 ms，20 轮切页内存增量 51,308 KiB、媒体请求 +0。
- 生产 CSP 已直接检查为 `connect-src 'self'`，不含 `ws://localhost:*`。
- 新 logo 与 `docs/Existing issues.md` 随提交 `557b62d` 提交并推送；P11 修复本身没有配置签名、公证或自动更新，也没有创建 Release。

当前可以进入真机测试；Blocker 0，Critical 0，Major 4。下一步先在原 Windows 服务器复验艺术家/scrobble和真实格式，再按 `docs/TEST-MATRIX.md` 完成 NSIS 安装、托盘/媒体键/睡眠/长时播放，以及 macOS Intel/arm64 的原生构建、安装和桌面矩阵。`v0.1.0-rc.4` 已可供下载；随后只在对应实机执行 `docs/RELEASE-CHECKLIST.md` 的安装、升级、真实服务器、物理听音与签名/公证矩阵。保留既有 RC 标签历史，不移动或改写任何既有标签；当前仍是测试版，不索取签名密钥、不将其标为 Latest 或正式稳定版。
