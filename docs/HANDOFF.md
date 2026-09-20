# 项目交接

更新日期：2026-09-20

## 当前目标与状态

P01～P10 已完成，P11～P20 已经过审查、稳定性修复与持续真机回归；当前为 P21 系统托盘安全重启。未换框架或大重构，也未配置签名/公证/自动更新或创建新的 Release。最新代码仍不能判定为发布就绪，完整结论见 `docs/TEST-REPORT.md`、`docs/TEST-MATRIX.md` 与 `docs/KNOWN-ISSUES.md`。

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

## 诊断分类修正（2026-09-16）

- 背景：用户导出的真实运行诊断里，6 次 API 请求（`durationMs` 12002–12015、无 HTTP 状态）被记为 `cancelled`，推荐语误导为“因切换连接、代理或播放项目取消”；同一个音频请求出现 `cancelled` 与 `broken-stream` 两条互相矛盾的记录。
- 修正：`network-diagnostics.ts` 新增 `timeout` 分类与显式中断原因（`timedOut` / `cancelledByCaller`）；`transport.ts` 由 `client.ts` 传入端点名与中断原因；`media-protocol.ts` 改为单一终态记录，消除 `cancel()` 与 `pull()` 的竞争；条目新增 `operation`、`errorName`、`errorDetail`，错误文本写入前替换 URL 与 `u/p/t/s/token/apikey/salt` 参数值。
- 验证：`npm run lint`、`npm run typecheck`、`npm test`（24 文件、122 项）均通过；新增回归测试在回退源码后确实失败（12 秒超时被断为 `cancelled`、媒体请求双记录），恢复修正后通过。本机为 Node.js v24.13.0，与 `.nvmrc` 的 22.19.0 存在偏差，最终以三目标 CI 为准。
- 未改变：API 超时仍是固定 12 秒、Vue Query 仍是默认重试 3 次、消费者取消仍未主动中止上游 fetch；这三项留给后续决定。

当前可以进入真机测试；Blocker 0，Critical 0，Major 4。下一步先在原 Windows 服务器复验艺术家/scrobble和真实格式，再按 `docs/TEST-MATRIX.md` 完成 NSIS 安装、托盘/媒体键/睡眠/长时播放，以及 macOS Intel/arm64 的原生构建、安装和桌面矩阵。`v0.1.0-rc.4` 已可供下载；随后只在对应实机执行 `docs/RELEASE-CHECKLIST.md` 的安装、升级、真实服务器、物理听音与签名/公证矩阵。保留既有 RC 标签历史，不移动或改写任何既有标签；当前仍是测试版，不索取签名密钥、不将其标为 Latest 或正式稳定版。

## P12 真机回归启动（2026-09-16）

- P12 基线为 `main` / `fe5b07a`；不增加新功能。
- `docs/TEST-MATRIX.md` 已追加四态真机矩阵，macOS Intel/arm64 因当前无实机记为 `BLOCKED`。
- Windows 从当前源码重新生成未签名 `0.1.0-rc.4` x64 包并通过包验证；SHA-256 为 `54f2d19542a575763b98d76a68981bb9d69e5a7888ff7f8617631764a1d75b13`，没有发布或上传。
- `win-unpacked/Sonavi.exe` 已启动。当前 Codex 工具环境禁止原生 Windows UI 控制，下一入口是用户在 Sonavi UI 内手动输入真实凭据并反馈登录结果；凭据不得进入对话、日志、fixture 或文档。
- 用户已确认 Windows 未签名测试包自动恢复凭据并成功连接真实服务器；P12 A-01、A-06 为 `PASS`，未记录服务器地址或账号信息。下一入口是音乐库页面与真实播放人工回归。
- P12-MI-001 已完成小范围修复和自动回归；2026-09-17 新 Windows x64 包验证通过，NSIS SHA-256 为 `2ddf941740fd5129a7cea4e3aff54ee22475be7ea484fba41eff391bc92baec7`。下一入口是用 `win-unpacked/Sonavi.exe` 真机确认每次打开队列时当前歌曲进入可视区域；确认前 C-14 保持 `FAIL`、问题状态保持 `RETEST`。
- P12-MI-002 已根据浅色与深色截图将队列当前歌曲标题改为主题高对比正文色，主强调色仅用于左侧标记；按用户要求本批全部完成后统一构建与真机验证。
- P12-MI-003 已为主播放/暂停按钮增加独立高对比样式，避免播放器通用按钮规则覆盖白色图标与强调色悬停背景；继续等待本批其余问题，统一构建与真机验证。
- P12-MI-004 已让播放器底栏的队列外点击关闭队列，同时保留队列内部交互和队列按钮切换行为；继续等待本批其余问题，统一构建与真机验证。
- P12-MI-005 已统一移除七个共享页面眉题中的硬编码重复序号，只保留栏目名称；定向应用外壳测试通过，继续等待本批其余问题后统一构建与真机验证。
- P12-MI-006 已把艺术家完整索引成功结果改为当前连接会话内复用，并禁用窗口聚焦重取；首次 `getArtists` 仍为全量请求，必须在真实服务器计时复验。
- P12-MI-007 已为所有可用按钮增加小手光标、禁用按钮增加不可操作光标，并通过真实 CSS 计算样式测试；继续等待本批其余问题后统一构建与真机验证。
- P12-MI-008 已确认真实播放出现 scrobble 同步失败提示；功能已实现但至少一次真实上报失败。当前保持 `OPEN`，下一入口是设置页中 operation=`scrobble` 的脱敏诊断，不得记录或传递凭据。
- P12-MI-009 已让播放器底栏优先显示当前歌曲已有的受限封面 URL，无封面或未选歌时保留占位；继续等待本批其余问题后统一构建与真机验证。
- 2026-09-17 已完成本批统一闸门：lint、typecheck、25 文件/130 项测试与生产构建通过；新 Windows x64 未签名包构建及验证通过，NSIS SHA-256 为 `6fc49135d56aabdb7c8a02f6a66c4509804e0356ab23b415fe127e38a2d270b8`，ASAR 1,866,755 字节。下一入口是启动 `release/0.1.0-rc.4/win-unpacked/Sonavi.exe` 进行一轮集中复验；未发布或上传。
- P12-MI-010 在上述统一包启动后新增：首页“最近添加”和“全部专辑”进入详情前保存 workspace 滚动位置，返回后恢复；参数化定向测试 5/5、lint、typecheck 通过。当前运行包不含该修复，下一次统一构建后再复验。
- P12-MI-011 已按最新要求调整：首页、专辑、艺术家、搜索、收藏、歌单及详情分别保存并恢复滚动位置，设置页不保存且每次进入回到顶部；艺术家列表改为内部滚动后，其位置由应用外壳单独保存。连接、断开或忘记账号时全部清空。最新定向测试 11/11、lint、typecheck 与 26 文件/137 项全量测试通过；当前运行包不含该修复。
- P12-MI-012 在上述统一包启动后新增：搜索进入艺术家详情再打开专辑时继续激活“艺术家”，返回按钮回到原艺术家详情并恢复位置；艺术家来源不额外加载完整专辑列表。定向测试 11/11，25 文件/134 项全量测试、lint、typecheck 与生产构建通过；当前运行包不含 MI-010～MI-012，下一次统一构建后再复验。
- P12-MI-013 在上述统一包启动后新增：专辑详情固定标题、操作和专辑摘要，关闭 workspace 外层滚动，仅歌曲列表独立滚动并支持键盘焦点；相关定向测试 14/14，25 文件/135 项全量测试、lint、typecheck 与生产构建通过。当前运行包不含 MI-010～MI-013，下一次统一构建后再复验。
- P12-MI-014 已将搜索从 300ms 自动防抖改为显式提交：输入不发请求，按 Enter 或点击搜索按钮才搜索，空白输入不可提交；新增定向测试并完成 lint、typecheck 与 26 文件/136 项全量测试。按用户要求未重新构建或启动应用，当前运行包不含该改动。
- P12-MI-015 已让艺术家列表态占满播放器上方剩余空间并关闭 workspace 外层滚动，只有虚拟艺术家列表保留滚动条；列表使用 ResizeObserver 按实际高度计算渲染窗口，艺术家详情仍使用原外层滚动。定向测试 15/15、lint、typecheck 与 26 文件/137 项全量测试通过；未构建或重启当前测试包。
- P12-MI-016 已将首页和专辑从滚动自动续载改为项目持有的 shadcn-vue Pagination：每页 30 张，显示已知页码与上一页/下一页，首页和专辑分别保留当前页，翻页后置顶。官方 CLI 源码已按项目严格类型规则及中文文案适配；lint、typecheck 与 26 文件/139 项测试通过。按用户要求未重新构建或启动应用，当前运行包不含该改动。
- P12-MI-017 已通过官方 CLI 加入 shadcn-vue Sonner，并在根节点挂载唯一 Toaster。连接、设置、收藏/歌单、查询、播放和上报错误改用 Sonner；加载失败状态卡继续提供重试。删除歌单与退出并忘记账号已从原生 `window.confirm` 改为持久 Sonner 的确认/取消动作，并防止重复触发。lint、typecheck 与 28 文件/144 项测试通过；E2E 脚本已同步，但按用户要求未构建或启动应用。
- P12-MI-018 已让首页、专辑、艺术家、搜索、收藏和歌单在栏目切换时保留页面实例，查询结果在当前连接会话内复用并关闭挂载/窗口聚焦自动重取。各页新增只刷新当前列表、分页或详情的按钮；搜索条件/结果和歌单详情也会保留。收藏/歌单写入、网络设置变化、恢复/解锁、断开和忘记账号仍按原边界刷新或清空数据。lint、typecheck 与 28 文件/146 项测试通过；按用户要求未构建、未重启或打开新包。
- P12-MI-019 已通过官方 shadcn-vue CLI 引入并适配 Input、Checkbox、Label、完整 Select、Slider 与 AlertDialog。连接、搜索、歌单、设置、歌词和播放器已迁移；Sonner 只保留通知，删除歌单与忘记账号改由 AlertDialog 确认；业务导航和实体卡片继续保留语义化按钮。Node.js 22.21.1 下 lint、typecheck、28 文件/147 项测试、生产构建和 Windows 源码 Electron 完整冒烟通过；冒烟覆盖显式搜索、复选、Select 持久化、Slider 原始/转码 seek、歌单 CRUD、生命周期和凭据恢复/删除。未重新生成 Windows 安装包，macOS 两架构未验证。
- P12-MI-020 已修复播放器的两个 Slider 错位、控制区水平中心偏移，以及艺术家虚拟列表从 `KeepAlive` 恢复后需滚动才重绘的问题。Node.js 22.21.1 下 lint、typecheck、28 文件/148 项测试、生产构建和 Windows 源码 Electron 完整冒烟通过；冒烟新增 Slider 中心线与播放控制区 1px 以内的几何对齐断言。下一入口是用当前源码预览人工确认，再统一打包。
- P12-MI-021 已将清空当前账号封面缓存和断开连接纳入 shadcn-vue AlertDialog 二次确认，取消不调用 IPC；Sonner 关闭按钮使用官方属性移到右上。lint、typecheck、28 文件/148 项测试、生产构建与 Windows 源码 Electron 完整冒烟通过。同日真实诊断显示 28 个封面请求在 10 ms 内并发，且 `getAlbumList2` 以默认退避模式连续 12 秒超时；未见 `scrobble` 条目，因此该文件不能解释播放记录上报失败。
- 随后的真实记录已出现 `operation=scrobble`、无 HTTP 状态、`durationMs=12014`、`errorCategory=timeout`，证明请求进入了传输层但 12 秒内没有响应；该证据不能单独区分服务端、反向代理或链路等待。播放上报控制器已修复新队列项首次观察即为 `playing` 时重置后提前返回的问题，因此上一首超时不会让下一首等待后续进度事件才上报；未知结果仍不自动重试，避免重复计数。
- P12-MI-022 已为专辑列表图片增加原生懒加载/异步解码/低优先级，并在 main 媒体协议对缓存未命中的封面上游读取设置全局 6 并发队列；专辑页查询显式限制为最多一次自动重试，手动重试会重新从第 1 次计数。诊断导出升级到 schema v2，`getAlbumList2` 记录白名单化的 `listType/page/size` 和 `attempt`，不记录资源 ID、URL 或凭据。Node.js 22.21.1 下 lint、typecheck、28 文件/153 项测试、生产构建和 Windows 源码 Electron 完整冒烟通过；E2E 实际确认诊断页显示列表上下文、第 1 次尝试与 scrobble 条目。下一入口是真实服务器复验封面峰值、专辑最多两次请求及切歌后的新 scrobble。
- P12-MI-023 已将 `waiting` / `stalled` 收敛为脱敏 `buffer-start` 和 `buffer-end`，结束条目记录缓冲持续时间。renderer→main 的新 IPC 使用 strict schema，只允许事件枚举与 0～3,600,000 ms 整数，多带 `trackId` 等字段即拒绝；诊断导出升级到 schema v3。Logo 区域改为可访问按钮，调用无参数 preload 方法，由 main 固定打开 `https://github.com/zhiyxn/Sonavi`，不提供任意外链能力。Node.js 22.21.1 下 lint、typecheck、29 文件/157 项测试、生产构建和 Windows 源码 Electron 完整冒烟通过；E2E 验证多余身份字段被拒绝、诊断页显示 1234 ms 的 buffer-end，Logo 控件可访问。下一入口是真实网络缓冲和系统浏览器打开真机复验。

## P13 稳定性修复进展（2026-09-18）

- 用户人工用例发现 `PLAY-02`：Windows 上 FLAC 原始流 seek 后长时间缓冲，切歌无法恢复。脱敏日志确认 `audio/flac` / HTTP 206，一次缓冲持续 130456 ms，末次 `buffer-start` 到导出时已持续 553099 ms 且未结束。
- `P13-CR-001` 已记入 `docs/KNOWN-ISSUES.md`。已确认三个直接原因：受控 Slider 没有保存拖动临时值，媒体消费者取流时没有主动 abort 上游 fetch，以及“上一首”在当前进度超过 3 秒时隐式改为重播当前歌曲。已分别做最小修复。
- 三个回归检查在修复前均稳定失败；修复后播放器 19/19、媒体协议 17/17 通过。Node.js 22.21.1 下 lint、typecheck、29 文件/159 项 Vitest 和生产构建均通过；只有既有 Zod PURE 注释位置警告。
- 修复后的 Windows 源码预览已重新启动。下一入口是复测同一首 FLAC 的进度拖动、连续点击与切歌；通过前 Critical 仍为 1，不处理 Major/Minor。
- 歌曲格式展示是功能增强，按 P13 禁止项暂不实施，留待 P14 评估。
- 新反馈的歌词高亮不自动滚动与队列全页面点击外部收起已分别登记为 P13-MA-001、P13-MA-002；当前不越过 Critical 优先级实施。
- P13-CR-002 深色连接表单将输入背景硬编码为白色，与深色主题浅色前景冲突。现已改用主题 canvas token；样式定向 5/5、全量 29 文件/160 项、lint、typecheck 与构建通过，修复后 Windows 预览已启动待目视复验。
- 用户完成一轮人工测试：26 PASS、8 FAIL、1 NOT TESTED；`PLAY-02` 已通过，`P13-CR-001` 关闭。深色输入 `P13-CR-002` 尚缺明确目视结论。
- 新 Critical `P13-CR-003` 的根因是设置页无条件丢弃 `connectionsReset` 并触发 `player.stop()`。现已改为仅代理实际切换时停止和清理；普通播放设置保存保留队列与当前播放。回归测试修复前稳定失败，修复后应用外壳 9/9，完整 lint、typecheck、29 文件/161 项测试与生产构建通过。
- Windows 真机确认保存后队列 UI 保留，但 16:44 新诊断显示同一保存操作仍在 main 撤销 FLAC 流与全部媒体句柄，随后出现 20762 ms 和 18320 ms 长缓冲；因此 `P13-CR-003` 重新打开。现已让 main 也仅在 `connectionsReset=true` 时撤销会话资源，相关 3 文件/31 项、lint、typecheck、29 文件/162 项测试与生产构建通过。
- Windows 真机再次确认保存播放设置后的持续播放与队列行为正常，`P13-CR-003` 关闭。其余人工失败已登记为 `P13-MA-001`～`P13-MA-005` 与 `P13-MI-001`，未实施。当前只剩 `P13-CR-002` 深色连接输入的 Windows 目视复验；通过后 Blocker/Critical 清零并停止 P13，等待 P14。
- Windows 深色连接输入目视复验通过，`P13-CR-002` 关闭。P13 当前 Blocker 0、Critical 0，已按退出条件停止；未继续实施 `P13-MA-001`～`P13-MA-005`、`P13-MI-001` 或功能增强，等待用户明确进入 P14。
- 用户随后明确要求继续处理剩余 6 个逻辑问题，P14 启动。首项 `P13-MA-001` 已修复：同步歌词高亮索引变化后，将当前 `aria-current` 行居中滚入可视区。回归测试修复前滚动调用为 0，修复后歌词 4/4、lint、typecheck、29 文件/163 项全量测试通过；待真机复验，下一项为 `P13-MA-002`。
- `P13-MA-002` 已修复：队列点击外部判断扩展到 document 生命周期，队列内部与队列按钮仍排除。修复前主页面点击不关闭，修复后播放器 20/20、lint、typecheck、29 文件/164 项全量测试通过；待真机复验，下一项为 `P13-MA-003`。
- `P13-MA-003` 已修复：首页、专辑与艺术家分别持有专辑详情 ID，艺术家 ID 不再在离栏时清空。修复前返回艺术家栏时 ID 为 null；修复后应用外壳 10/10、lint、typecheck、29 文件/165 项全量测试通过；待真机复验，下一项为 `P13-MA-004`。
- `P13-MA-004` 在自动环境未重现真机关闭，但已将队列面板改为显式停止内部点击冒泡，并新增删除当前项/非当前项后保持展开的回归。播放器 21/21、lint、typecheck、29 文件/166 项全量测试通过；待 Windows 真机复验，下一项为 `P13-MA-005`。
- `P13-MA-005` 已修复：断开后若当前账号使用系统加密保存，ConnectPanel 提供无参数 restore 重新连接入口，不回填服务器凭据或密码；忘记账号后入口清除。相关 2 文件/11 项、lint、typecheck、29 文件/166 项全量测试通过；待真机复验，最后一项为 `P13-MI-001`。
- `P13-MI-001` 已修复：设置快捷键只忽略文本输入/选择/可编辑区域，空格播放仍忽略按钮与链接；侧栏按钮聚焦时快捷键恢复。修复前按钮目标不匹配，修复后定向 4/4、lint、typecheck、29 文件/166 项全量测试通过。
- 用户要求的 6 个逻辑问题均已完成最小修复，目前全部为 `RETEST`；未实现功能增强或引入 vue-router。最终 lint、typecheck、29 文件/166 项测试与生产构建通过，旧实例已停止，包含全部修复的 Windows 源码预览已启动。下一入口是按 `CURRENT-MANUAL-TEST-CASES` 集中复验 `PLAY-11`、`PLAY-05`、`LIB-02`、`LIB-07`、`PLAY-08`、`SET-02` 与 `LIFE-03`。
- 2026-09-18 已由电脑控制完成 Windows 真实窗口集中复验：歌词 seek 自动滚动、全页面点击外部收队列、删除当前/非当前队列项保持展开、断开后安全重连、侧栏聚焦时 `Ctrl+,` 均通过。栏目详情隔离因真实服务器艺术家全量索引 90 秒仍不可用、收藏无艺术家且通配搜索前 12 个艺术家无专辑而记为 `BLOCKED`，未观察到修复反例。人工清单现为 32 PASS、0 FAIL、2 BLOCKED、1 NOT TESTED；macOS Intel/arm64 未验证。复验结束后已重新打开当前源码预览；下一入口是在服务器能返回带专辑的艺术家时复验 `LIB-02` / `LIB-07`，再转入两种 macOS 架构真机矩阵。

## P15 macOS 播放日志修复（2026-09-19）

- macOS 脱敏日志确认 `getArtists` 八次 12 秒超时、一次 MP3 转码流在 102 秒后发生 HTTP/2 协议错误，并在导出时存在约 16 秒未结束缓冲；同期其余 API、108 次封面和 5 次 scrobble 均成功。
- `getArtists` 现为单次 45 秒、无自动重试；AudioEngine 连续缓冲 30 秒释放旧宿主，player 仅对可保持位置的流错误/缓冲超时按队列项自动恢复一次。
- 诊断导出升级 schema v4，新增状态、响应头耗时与已读字节数以区分“未收到响应头”和“正文读取过慢”，继续不记录 URL、正文、资源 ID 或凭据。
- Node.js 22.19.0 下 lint、typecheck、29 文件/172 项测试、生产构建和 macOS Intel 源码 Electron 完整冒烟通过；诊断裁剪导出分支也由回归测试确认保持 schema v4。第一次冒烟暴露脚本仍假设首页切回列表；按 P14 详情持久化语义修正测试后完整通过，产品代码未为测试回退。
- 下一入口：在真实 macOS 服务复验艺术家单次 45 秒、长缓冲退出和一次自动恢复，并按本地时间对照反向代理/Navidrome 的 HTTP/2 错误日志；Windows 11 与 macOS arm64 仍未验证。

## P12 流程重走（当前源码，2026-09-19）

- 用户要求重走 P12；本轮选择当前 `main` / `67126ea` 作为基线，不回退到旧 P12 的 `fe5b07a`，因此 P13～P15 的修复全部保留。
- 当前可用真机是 macOS 13.7.8 Intel x64；Windows 11 x64 与 macOS arm64 本轮没有新实机证据，继续标为未验证。
- Node.js 22.19.0 / npm 10.9.3 下，`npm run lint`、`npm run typecheck`、`npm test`（29 文件/172 项）和 `npm run build` 全部通过；构建只有既有 Zod PURE 注释位置提示。
- `npm run test:e2e` 首次在受限沙箱内因 Electron 无法启动而失败；获准在本机桌面环境运行后同一命令完整通过。源码冒烟启动样本 1504 ms，20 轮切页内存增量 55,792 KiB、媒体请求增量 0。
- 已重新构建 macOS x64 未签名 DMG。沙箱内 electron-builder 因无法解析 GitHub 失败一次，获准联网取得缺失 Electron 缓存后构建成功；没有发布或上传。
- `npm run verify:package -- mac-x64` 在本机环境通过：DMG 135,241,299 字节，SHA-256 `5a37c6579b978d03c17607f9528d2fb05018dc14914c7cbb634929b9a24b17ec`；应用为 x64、最低 macOS 13.0、签名状态 `unsigned`、ASAR 2,117,420 字节。
- `npm run test:e2e:package -- mac-x64` 完整通过；打包应用启动样本 1189 ms，20 轮切页内存增量 52,652 KiB、媒体请求增量 0。
- 当前未签名 macOS x64 测试包已经启动，并由用户确认自动恢复加密账号、进入真实主界面；本轮 `A-01`、`A-06`、`UI-01` 记为 `PASS`。没有记录服务器或账号信息。
- 用户随后确认首批只读检查全部通过：Logo 外链、栏目标题/按钮光标、首页与专辑独立分页、艺术家列表首次显示/单一滚动条/缓存恢复，以及显式提交搜索；对应 `UI-02`、`UI-03`、`LIB-01`、`LIB-03`、`LIB-05` 为 `PASS`。
- 第二批只读导航发现 `P12R-MA-001`：搜索和收藏结果点击专辑后，左侧都错误激活“专辑”，返回进入全部专辑列表而非原来源；`LIB-07` 记为 `FAIL`。代码核对确认两个入口复用的 `openAlbum()` 无条件切换到 `albums`，现有测试没有覆盖这些返回路径。问题已写入 `docs/KNOWN-ISSUES.md`，尚未修改代码。
- 同批 `LIB-02`、`LIB-04` 由用户确认 `PASS`：专辑详情内部滚动/返回位置、艺术家缓存/手动刷新符合预期。
- 用户随后明确补充新的来源保持要求：搜索结果点击艺术家不应切换到“艺术家”栏目，而应保留“搜索”并可返回原结果。当前 `openArtist()` 无条件切换到 `artists`，已登记为 `P12R-MA-002`；此前按旧用例文案记录的 `LIB-06 PASS` 已撤销并改为 `FAIL`，尚未修改代码。
- macOS Intel 基础播放人工批次全部通过：`PLAY-01`、`PLAY-02`、`PLAY-04`、`PLAY-05`、`PLAY-06`、`UI-04` 为 `PASS`。本轮证据覆盖真实物理听音、暂停/继续、原始流前后 seek、5 首以上队列连续切歌、队列定位/主题可读性/外部关闭、主按钮/封面，以及 Slider 与控制区几何布局。
- 高级播放中 `PLAY-07`、`PLAY-08`、`PLAY-09` 为 `PASS`；自然结束/循环/随机、重复项/重排/删除及逐曲 scrobble 符合预期。
- `PLAY-03` 为 `FAIL`，登记 `P12R-MA-003`：保存兼容转码后，从缓存专辑重新创建队列仍显示“原始音频”；手动刷新专辑后再播放则正确显示“兼容转码”。该对照确认根因是只改播放策略时未失效携带旧媒体句柄/播放计划的 renderer 查询缓存，main 策略和转码链路本身正常。后续应只刷新相关查询，不能回退为清空队列或中断当前播放。
- `PLAY-11` 为 `FAIL`，登记 `P12R-MI-001`：同步歌词自动居中时主题滚动条反复显示/隐藏；同步高亮、seek 定位、普通歌词和无歌词状态均正常。可以只隐藏歌词容器视觉滚动条而保留滚轮、键盘和程序化滚动；尚未修改代码。
- 用户要求先修复上述四项。`P12R-MA-001` / `002` 已让搜索与收藏分别保存专辑、艺术家及嵌套专辑状态，详情页保持来源侧栏，返回可逐级回到来源且不额外启用全量专辑/艺术家列表查询。
- `P12R-MA-003` 已在网络设置更新结果中区分 `playbackChanged` 与 `connectionsReset`。用户进一步明确：保存后应优先切换当前歌曲，做不到则至少下一曲生效。现在 renderer 通过受限 IPC 为现有队列重建播放句柄；服务器支持 `transcodeOffset` 时从当前进度换成新策略，不支持偏移时保持当前流、其余队列项立即采用新策略。查询缓存同步重取，代理切换仍沿用停止与清理边界。
- `P12R-MI-001` 已隐藏歌词容器的 Firefox/WebKit 视觉滚动条，保留 `overflow-y: auto`、滚轮、键盘和 `scrollIntoView` 自动居中。
- failure-first 定向回归中，四项首轮修复前 5 项失败；新增当前/下一曲策略测试在实现前 2 项失败。最终定向 2 文件/35 项、全量 29 文件/177 项、lint、typecheck、生产构建及源码 Electron 冒烟通过；E2E 明确断言只改播放策略后当前播放器标签直接变为“兼容转码”。
- 新 macOS x64 未签名包已覆盖生成并验证：DMG 135,242,879 字节，SHA-256 `cf4f8d7ef6c98a4c16ae732b5ec961df4e4f50fa989cd99bca753efbfc762efb`，ASAR 2,125,527 字节；打包应用完整冒烟通过，启动样本 1137 ms、20 轮切页内存增量 57,736 KiB、媒体请求增量 0。四项当前均为 `RETEST`，不能以自动结果代替真实服务器与物理听音结论。
- 用户要求由 Codex 直接检查设置批次。macOS 辅助功能接口不可用，因此先正常退出应用，再以仅监听 `127.0.0.1:9223` 的 Electron 调试端口重开同一真实包和同一 userData；所有脚本只输出布尔结果，不输出页面文本、服务器或媒体身份。
- `SET-01` 与 `LIB-08` 通过：清空缓存取消分支不改变缓存，确认分支清空当前账号封面缓存；随后封面元素和封面诊断重新出现，页面保持可操作，真实播放在滚动/加载期间保持 active 且进度继续前进。缓存内容已按正常浏览重新下载，未删除服务器数据或音频。
- `SET-02` 通过：取消保持连接；确认后连接表单三项为空且显示安全重连入口；重连成功，凭据没有回填 renderer。
- `SET-03` 通过：播放与桌面设置在实际进程重启后保持，并在断开/安全重连后保持一致。
- `SET-04` 通过：实时诊断存在 `getAlbumList2` 的白名单 `listType/page/size` 与尝试序号，封面阶段也有记录。
- `SET-05` 的实时隐私部分通过：当前诊断非空，不含服务器值或 `url/username/password/token/salt/cookie/authorization/trackId/resourceId/responseBody` 字段；schema v4 已由此前自动回归确认。本轮无法自动控制原生保存对话框，因此真实文件导出仍标 `BLOCKED`，不以代码结果冒充人工导出。
- `UI-05` 通过：使用不会生效的非法代理值安全触发一次错误通知，关闭按钮位于右上，点击后只关闭该通知且仍停留设置页；无效设置未持久化。
- 检查结束后已正常退出调试实例，确认 9223 端口不再监听，并按普通方式重新打开 Sonavi。
- 下一入口是应用外壳与音乐库只读人工矩阵，然后再进入真实播放、写操作和桌面生命周期。任何凭据、服务器地址、歌曲 ID 或媒体 URL 不得进入对话、日志说明或文档；网络问题只导出 schema v4 脱敏诊断。

## P16 歌曲格式展示（2026-09-19）

- 之前因 P13 稳定性闸门暂缓的歌曲格式展示已实现。播放器复用受校验的 `TrackSummary.contentType`，显示“FLAC · 原始音频”或“FLAC → MP3 · 兼容转码”一类标签；缺失、非音频和未知类型统一显示“未知格式”。不新增端点、IPC 或媒体探测，也不解析不透明媒体 URL。
- failure-first 旧实现按预期失败；最终定向 2 文件/31 项、lint、typecheck、29 文件/178 项测试、生产构建和获准后的 macOS Intel 源码 Electron 完整冒烟通过。冒烟验证 WAV fixture 的转码标签；启动样本 1288 ms，20 轮切页内存增量 50,364 KiB、媒体请求增量 0。
- 本轮没有重新生成或启动新的安装包，没有发布、上传或创建提交。该阶段当时的真实格式矩阵尚未验证；2026-09-20 已由用户确认 `PLAY-12` 为 `PASS`，但未单独执行的平台发布验收仍保持未验证。

## P17 设置页安全重启（2026-09-19）

- 设置页新增“应用恢复 / 重启 Sonavi”及 AlertDialog。取消不触发 IPC；确认调用无参数 preload 方法。main 校验可信发送者，只安排一次 `app.relaunch()` 并进入既有 `app.quit()`，从而复用暂停队列刷新、5 秒超时和 `will-quit` 资源释放。renderer 无法传入命令、路径、参数或目标进程。
- failure-first 两项按预期失败；最终定向 4 文件/18 项、lint、typecheck、30 文件/180 项测试、生产构建和获准后的 macOS Intel 源码 Electron 完整冒烟通过。冒烟覆盖打开/取消重启确认；启动样本 1389 ms，20 轮切页内存增量 61,288 KiB、媒体请求增量 0。
- `app-shell` 旧测试的 wrapper/查询清理串扰已通过“先卸载、后清空 DOM”修复，没有放宽原断言。实际确认重启会中断自动冒烟，尚未在 Windows 11 x64、macOS Intel x64 或 macOS arm64 执行；`LIFE-06` 保持 `NOT TESTED`。该入口也不能恢复完全无响应的 main，届时仍需系统强制退出。
- 本轮未生成安装包、未发布、未推送、未创建提交。下一入口是在当前源码或新测试包上执行 `LIFE-06`，确认旧进程退出、单一新进程启动、加密账号和暂停队列恢复。

## P18 搜索结果布局与专辑歌曲数量（2026-09-20）

- 已落实此前人工反馈：搜索输入框和按钮统一高度；桌面宽度下歌曲区与艺术家/专辑发现区并排，窄屏时歌曲区优先，避免歌曲被大量专辑推到页面末尾。搜索滚动续载改为 shadcn-vue Pagination，每页以相同 offset/size 请求最多 25 条艺术家、专辑和歌曲结果，翻页只展示当前页。
- 首页、全部专辑、艺术家详情、搜索和收藏中的专辑条目现在统一显示 `songCount`。后续人工测试发现长歌手名会把数量一起省略，现已将名称与数量拆为两个 flex 项：名称可省略，数量固定不收缩。数据复用既有共享 schema，无新增网络请求、IPC、权限或 Navidrome 私有接口。
- failure-first 新断言在旧实现按预期因找不到分页控件而失败。最终定向测试通过；Node.js 22.21.1 下 lint、三组 typecheck、31 文件/186 项 Vitest、生产构建与 Windows 源码 Electron 完整冒烟通过。E2E 实测输入框/按钮几何对齐、宽屏两栏同起点、专辑歌曲数和末页“下一页”禁用；启动样本 515 ms，20 轮切页内存增量 29,892 KiB、媒体请求增量 0。
- 当前只证明 Windows 自动化 fixture；真实大型搜索结果、Windows 人工界面、macOS Intel x64、macOS arm64 和新安装包均未验证。本轮未生成安装包、未发布、未推送、未创建提交。下一入口是执行 `LIB-09`。

## P19 慢响应与封面队列治理（2026-09-20）

- 用户提供的 schema v4 脱敏日志共 200 条且已达容量上限：18 次 API 中 13 次超时，全部为已收到 HTTP 200/JSON 响应头但正文 0 字节读完；`search3` 连续八次超时对应两批 TanStack 默认四次尝试，`getStarred2` 三次超时后第四次成功。181 条封面均成功，但 65 条总耗时超过 2 分钟、19 条超过 10 分钟；旧时长包含排队，无法归因到上游。
- 搜索与收藏读取现明确关闭自动重试，只保留用户操作；列表封面由 `DeferredCoverImage` 在视口附近挂载，停用时移除请求节点。同一会话/资源复用不透明封面 URL，索引有 10,000 项上限并在会话撤销时清理；音频流和六并发限制不变。
- schema v5 为封面增加纯数字 `queueMs/upstreamMs`，设置页同步展示。API 已有响应头时若正文超时，会显示“已收到响应头，但正文读取超时”及针对响应缓冲/上游读取的建议，不再误报为完全没有响应。
- failure-first 6 文件中 8 项按预期失败；最终定向 6 文件/62 项、lint、三组 typecheck、32 文件/193 项全量测试、生产构建和 Windows 源码 Electron 完整冒烟通过。冒烟启动样本 505 ms，20 轮切页内存增量 24,540 KiB、媒体请求增量 0，并直接校验完整诊断中的封面排队/上游字段。
- 2026-09-20 Windows 真实服务复验通过：用户确认 `LIB-08` 与 `SET-05` 为 `PASS`。新 schema v5 导出文件共 106 条、44,613 字节，SHA-256 为 `6ea1c922a434ed0758f2ac0d60974229220e14af15e60e43bdc22f3753eab400`；94 条封面全部返回 200 且无错误，总耗时平均 2.63 秒、P95 4.27 秒、最大 4.99 秒，全部具有 `queueMs/upstreamMs`。白名单检查未发现敏感键、URL、认证查询参数/请求头、资源身份或响应正文。
- 本次新日志没有 `search3` / `getStarred2`，因此搜索/收藏失败时单次 API 请求的真实慢服务证据仍待补齐；macOS Intel/arm64 与新安装包仍未验证。本轮未发布、未推送、未创建提交。

## P20 搜索纵向布局与独立分页（2026-09-20）

- 搜索结果已改为艺术家、专辑、歌曲上下排列。专辑和歌曲各有分页器与页码；专辑翻页只改变 `albumOffset`，歌曲翻页只改变映射到协议 `songOffset` 的 `trackOffset`，另一页码保持不变。
- renderer、preload 类型、main 输入校验、LibraryService 和 OpenSubsonic 客户端共用扩展后的严格 schema。两个偏移量仍合并到一次公共 `search3`，避免慢服务器首屏请求翻倍；艺术家固定取 offset 0 的首批结果。
- failure-first 搜索面板 2 项按预期失败。Node.js 22.21.1 下相关 6 文件/57 项与独立分页 2 文件/7 项通过；lint、三组 typecheck、32 文件/194 项全量测试、生产构建和 Windows 源码 Electron 完整冒烟通过。根据真机截图，两个分页器与内容统一增加 20px 上间距；最新冒烟同时断言纵向顺序、两个分页间距不少于 20px、单页下一页禁用及 960×640 无横向溢出。启动样本 706 ms，20 轮切页内存增量 24,172 KiB、媒体请求增量 0。
- 2026-09-20 用户确认 `LIB-09` 真实大型音乐库人工复验通过；搜索纵向布局、专辑/歌曲独立分页、分页间距、末页状态及五类专辑歌曲数量记为 `PASS`。本结果不外推为未单独执行的平台或安装包结论。
- `LIB-08` / `SET-05` 的 Windows 真实服务复验已在 P19 记录为 `PASS`。本轮未发布、未推送、未创建提交。

## P21 系统托盘安全重启（2026-09-20）

- 用户确认 `PLAY-12` 真实格式矩阵为 `PASS`；随后 `LIB-08`、`SET-05` 与 `LIFE-06` 也完成 Windows 人工复验。
- Windows 托盘与 macOS 菜单栏共享菜单新增“重启 Sonavi”。点击后直接复用 `DesktopIntegrationController.requestRestart()`：只安排一次 `app.relaunch()`，然后进入既有 `app.quit()` / 暂停队列刷新 / 5 秒超时流程。未新增 IPC、renderer 权限、命令、路径或参数。
- failure-first 定向测试首先准确因缺少菜单项失败，实现后 1 文件/5 项通过。Node.js 22.21.1 下 lint、三组 typecheck、32 文件/194 项全量测试、生产构建与 Windows 源码 Electron 完整冒烟通过；冒烟启动样本 608 ms，20 轮切页内存增量 47,192 KiB，媒体请求增量 0。
- 首次使用 `electron-vite dev` 启动的预览在重启后出现空白；进程检查确认当时 5173 开发服务已退出，新 Electron 进程无法继续读取开发 renderer URL。该现象不属于打包加载路径。
- 改用已构建、不依赖 5173 的 `electron .` 入口后，用户确认 Windows 托盘重启后主界面正常显示与操作，真实听音正常；读取只发现一个 Sonavi Electron 主进程。Windows 当前构建入口记为 `PASS`，macOS Intel/arm64 菜单栏仍待各自实机验收。
- 用户进一步确认设置页取消/确认重启分支均通过，`LIFE-06` 在 Windows 记为 `PASS`。
- 用户最后确认 `LIB-02` / `LIB-07` 均为 `PASS`，两级来源链正确；并指出全程仍在收藏上下文时“返回艺术家详情”可能被误解为跳到顶级艺术家栏目。当前已将专辑详情按钮改为“返回艺术家专辑”，返回目标不变。failure-first 旧实现 2 项按预期失败；实现后定向 1 文件/11 项、lint、三组 typecheck、32 文件/194 项全量测试和生产构建通过。重启后用户目视确认当前测试未发现问题。
- Windows 当前源码人工矩阵仍为 37 PASS、0 FAIL、0 BLOCKED、0 NOT TESTED；该结果不外推到 macOS 或新安装包。
- 用户说明当前只有 Windows 与 macOS Intel 真机，并确认 macOS Intel 当前版本已试用、未发现问题；暂只把明确执行的用例记为 `PASS`，不把未逐项执行的完整矩阵自动通过。Apple Silicon arm64 因无实机保持“未验证”，不缩减产品支持范围。
- macOS Intel 菜单栏安全重启已由用户明确确认未发现问题：单实例、加密账号、暂停队列与主界面恢复通过，`LIFE-06` / F-07 在 macOS Intel 记为 `PASS`。
- 用户确认 Windows EXE（NSIS 安装程序）与 macOS x64 DMG 均能正常安装、启动、真实播放并卸载，账号/设置数据保留未发现问题。未提供本轮文件哈希或构建提交，因此该证据不外推为最新 `main` 安装包、签名/公证或完整桌面集成通过。
- 下一入口可补齐 Windows 安装/卸载细项与 macOS x64 图标/Dock 细项；P19 的搜索/收藏失败单请求证据可在慢服务再次复现时补取。arm64 继续依赖 CI 构建证据并等待未来实机运行验收。

## v0.1.0-rc.5 发布结果（2026-09-20）

- 用户明确授权发布 GitHub Pre-release；既有标签保持不变，新候选使用 `v0.1.0-rc.5`。
- `README.md` 已改为下载、功能、未签名安装提示、平台验证状态和文档入口；内部开发阶段与命令保留在 `docs/`，不再占据下载页主体。
- README 的界面预览使用 `docs/images/` 中的浅色歌单与深色专辑详情截图；内容来自受控 fixture，不含真实账号或服务器信息。
- 新增标准 MIT `LICENSE`，`package.json` 与 lockfile 的 license 字段同步为 `MIT`。
- 候选说明位于 `docs/RELEASE-NOTES-v0.1.0-rc.5.md`，明确三种目标安装包、人工证据、arm64 实机未验证及未签名/未公证风险。
- Node.js 22.19.0 下 lint、typecheck、32 文件/194 项测试、生产构建与 `validate-tag` 通过。本机重新安装 Electron 44.3.0 后，源码 E2E 仍在当前 Windows 桌面会话出现 renderer `Target crashed`；真实 Windows/macOS Intel 安装播放证据未发现对应问题。
- 标签 `v0.1.0-rc.5` 的 release run `35517541553` 在三个原生目标完整通过，并创建非草稿、非 Latest 的 Pre-release：`https://github.com/zhiyxn/Sonavi/releases/tag/v0.1.0-rc.5`。附件为三个安装包、三个 manifest 与 610 字节的 `SHA256SUMS.txt`，共七个。
- 同提交的 main run `35517517625` 中 Windows 与 macOS arm64 通过，macOS Intel 打包冒烟因测试时间竞态失败：测试在播放中的 4 秒 fixture 上读取预期标题后，曲目在断开确认期间自然前进；持久化文件正确记录动作发生时的最新索引。E2E 现先暂停并等待“继续播放”状态后再取快照；既有单元测试继续验证断开处理会暂停、保存且保存先于会话撤销，产品代码不变。
- 下一入口：等待测试稳定性修复的普通 CI；rc.5 已可作为明确标注未签名/未公证的测试版下载。macOS arm64 实机仍保持未验证。
