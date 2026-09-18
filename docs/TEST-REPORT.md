# P10 打包、兼容性与发布前审计报告

日期：2026-09-16
状态：P11 修复后的 `v0.1.0-rc.4`（提交 `acb7c8c`）已在 release run `35063014155` 三目标全通过并发布为 GitHub Pre-release；更早的 `v0.1.0-rc.3` 构建自 `cc33168`，不含 P11 修复；正式签名/公证和各平台完整实机发布验收未完成

## 测试环境

- 本机：macOS 13.7.8（22H730），Intel x64。
- Node.js v22.19.0（NVM），npm 10.9.3。
- 本轮复验主机：Windows 10.0.26200 x64；Node.js v22.21.1（满足 Node 22 engines），npm 10.9.4。
- Electron 44.3.0，electron-vite 5.0.0，electron-builder 26.15.3。
- 分支 `main`；`1f23427` 修复随 `51cf322` 进入 GitHub Actions run `34934352140` 并三目标全通过。
- Electron 冒烟只连接 `127.0.0.1` 临时 OpenSubsonic fixture，使用合成 WAV/PNG，不读取用户服务或凭据。

## 命令结果

| 命令/操作 | 结果 | 证据 |
| --- | --- | --- |
| `git diff --check` / `npm run lint` | 通过 | 无空白错误；0 warning |
| `npm run typecheck` | 通过 | node/preload、renderer、tests 三组；x64 构建重复通过 |
| `npm test` | 通过 | 24 个文件、109 项测试；新增断开顺序、候选标签、附件白名单和 SHA-256 清单测试 |
| 包验证器定向测试 | 通过 | 9 项：三个目标、PE 架构/Certificate Table/增量读取、PowerShell 路径隔离、Mach-O 名称归一、发行签名判定、权限拒绝、SHA-256 |
| `npm audit --audit-level=high --registry=https://registry.npmjs.org` | 通过 | 0 vulnerabilities |
| `npm run test:e2e` | 通过 | 最终源码 Electron 完整 P01～P10 回归 |
| `npm run build:win` | 通过 | 当前 Windows 主机构建 `0.1.0-rc.1` 未签名 x64 NSIS，文件名/version metadata 正确 |
| `npm run verify:package -- win-x64` | 通过 | x64、0.1.0-rc.1、ASAR、图标、unsigned 与 SHA-256 均符合预期 |
| `npm run test:e2e:package -- win-x64` | 通过 | `0.1.0-rc.1` 打包应用完整回归，启动约 745 ms、内存增量 48,480 KiB、媒体请求 +0 |
| `npm run build:mac:x64` | 通过 | 最终未签名 x64 DMG 生成；首次沙箱运行因 GitHub DNS 失败，授权联网后完成 |
| `npm run verify:package -- mac-x64` | 通过 | 架构、标识、版本、macOS 13、DMG、ASAR、图标、签名状态与 SHA-256 |
| `npm run test:e2e:package -- mac-x64` | 通过 | 最终包内完整 P01～P10 回归 |
| DMG 只读挂载与临时安装 | 通过 | hdiutil 校验所有分区 CRC，复制后的应用元数据和 ASAR 正确 |
| DMG 安装后 Electron 冒烟 | 通过 | preload/CSP/媒体协议/safeStorage/重启恢复等完整流程 |
| 截图目视 | 通过（当前 Intel Mac） | 浅色/深色、中文/英文、导航、播放器无明显截断/重叠/横向溢出 |

## 发现并修复的问题

1. 旧包 Info.plist 自动带入相机、麦克风、蓝牙和音频采集 usage description，而 Sonavi 不使用这些能力。P10 使用 `extendInfo: null` 删除五项声明，验证器会阻止回归；main 的权限请求默认拒绝保持不变。
2. 旧 `app.asar` 为约 55 MiB，包含近万条构建期依赖和四千余个 source map。main 仅有 Zod 外部运行时依赖，因此将 Zod 内联并排除 `node_modules`；最终 ASAR 为 1,959,330 字节，只包含 `out/` 与 `package.json`，DMG 从约 145.8 MB 降至 137.3 MB。
3. 第一版验证器把 `lipo` 的 `x86_64` 与产品目标名 `x64` 直接比较，产生假失败。已增加明确归一并补测试，不放宽对多架构或错误架构的拒绝。
4. P07 Electron 冒烟仅给 now-playing 条件 3 秒、submission 使用固定 2.4 秒等待，慢 CI 容易产生时序误报。统一改为最长 10 秒条件等待，仍要求真实请求出现。
5. run `34910450288` 的 arm64 主可执行文件带有 linker ad-hoc seal，但应用 bundle 没有资源封印；旧验证器误按完整已签名 bundle 校验。现在 ad-hoc 只校验代码页并明确记录 `ad-hoc`，资源继续由 ASAR/图标/Info.plist/DMG/SHA-256 独立检查；严格发行门禁仍拒绝它。
6. Windows 无签名应用没有 PE Certificate Table，旧验证器仍调用 PowerShell，且把 EXE 路径追加到 `-Command` 后，造成模块加载和参数绑定连锁错误。现在先增量解析 PE；无表直接记录 `unsigned`，有表才调用 Authenticode，并通过环境变量传入路径。
7. Intel CI 在播放器已显示 0:02 后立即检查 Node 侧请求数组，新的转码请求可能尚未到达 fixture。现在最长等待 10 秒直到实际出现 `format=mp3&timeOffset=2` 请求，再继续断言 `maxBitRate=192`；本机完整 Electron 冒烟已通过。
8. 歌单移除成功提示先于 TanStack Query 写后重读完成，测试立即计数会误报。现在仍严格要求重复歌曲从 2 条降为 1 条，但以最长 10 秒条件等待实际 UI 刷新。
9. 断开连接曾在暂停队列 flush 后先清空播放器，慢速主进程断开超过 350 ms 时可能把空队列覆盖到磁盘。现在先暂停并 flush，主进程确认断开后在同一批更新中清除 session 与播放器；新增单元测试验证保存早于断开、清队列晚于断开确认。
10. 4 秒合成音频在慢速 Intel runner 的 20 轮切页期间会自然进入下一首；测试硬编码第 1 首会把正确持久化误判为失败。现在记录断开前的实际当前歌曲，并严格验证磁盘与重启后恢复同一首。

## 最终 macOS Intel 包

- 路径：`release/0.1.0/Sonavi-0.1.0-mac-x64.dmg`（本地忽略目录）。
- 大小：137,343,264 字节。
- SHA-256：`f5afe1f70024d71cdf319b561f4a59d0fb7c8fb4ffe682b889b6f6855a648074`。
- 应用：Mach-O x64；Bundle ID `com.sonavi.desktop`；版本 0.1.0；`LSMinimumSystemVersion=13.0`。
- 资源：`app.asar` 和 `icon.png` 存在；ASAR 1,959,330 字节。
- 签名：未签名；无 Team ID；未公证、未 staple。只能作开发测试包。
- manifest：`release/0.1.0/Sonavi-0.1.0-mac-x64.manifest.json`。

修复后包内冒烟启动到连接 UI 约 1770 ms，20 轮设置/首页切换工作集增量 51,872 KiB、媒体请求 +0。此前最终 DMG 临时安装的对应数字约 1111 ms、47,148 KiB、+0。均是单次受控采样，不是跨平台性能承诺。

当前 Intel 主机还为故障诊断交叉生成了 arm64 DMG 和 Windows NSIS。arm64 DMG 为 133,110,010 字节，SHA-256 `276e140acefe6ef0f4912e23c3a1b47e8ed144c63e35a13f0a602654d3ce17cd`，目标架构/标识/版本/macOS 13/资源均通过并记录 `ad-hoc`；`SONAVI_REQUIRE_SIGNING=1` 按预期拒绝。Windows 应用 EXE 的实际 PE 为 x64 且 Certificate Table 为空。以上只是跨平台包结构证据，不替代对应目标原生启动、包内冒烟或安装验收。

## 安装后自动覆盖

- BrowserWindow：`contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`、`webSecurity=true`、无 webview/insecure content/drag navigation。
- CSP：`default-src 'none'` 与 `frame-ancestors 'none'`；renderer 没有 Node/`process`/原始 IPC。
- 连接：固定 IPC、发送者和输入校验；token/salt 认证；两页专辑、详情和封面。
- 媒体：renderer 只见不透明 `sonavi-media`；真实 HTMLAudioElement 流式请求、Range/seek、取消和句柄撤销。
- 播放：队列、重复项、前后切歌、歌词、now-playing/submission、兼容转码与 `transcodeOffset` 完整时间线。
- 服务器写入：fixture 收藏与歌单 CRUD、重复歌曲按索引移除和写后重读。
- 桌面：Media Session、关闭隐藏同一 BrowserWindow、应用激活恢复、20 轮切页无新增媒体请求。
- userData：隔离路径内 safeStorage 加密往返、凭据跨进程恢复/删除、暂停队列以新媒体句柄恢复；应用/安装目录没有写用户配置。

## 分平台证据

| 验证项 | Windows 11 x64 | macOS 13+ Intel x64 | macOS 13+ arm64 |
| --- | --- | --- | --- |
| `740981f` 源码 lint/typecheck/102 tests | CI 通过 | CI 通过 | CI 通过 |
| `740981f` 源码 Electron 冒烟 | CI 通过 | P08 请求时序断言失败 | CI 通过 |
| `740981f` 安装包构建 | NSIS 成功 | 因前置冒烟失败而跳过 | arm64 DMG 成功 |
| `740981f` 包验证 | PowerShell/路径传递失败 | 跳过 | linker ad-hoc 被误按 bundle 校验而失败 |
| `ce82e9e` 源码 lint/typecheck/105 tests | CI 通过 | CI 通过 | CI 通过 |
| `ce82e9e` 源码 Electron 冒烟 | CI 通过 | 队列重启恢复超时 | CI 通过 |
| `ce82e9e` 安装包构建与包验证 | CI 通过 | 因前置冒烟失败跳过 | CI 通过 |
| `ce82e9e` 包内冒烟 | CI 通过 | 跳过 | 真实音频请求同步断言过早 |
| `51cf322` 修复后 106 项测试 | CI 通过 | CI 通过 | CI 通过 |
| `51cf322` 修复后包验证/包内冒烟 | CI 通过 | CI 通过 | CI 通过 |
| 安装器实际安装/启动 | 未验证 | 未签名 DMG 挂载和临时安装通过 | 未验证 |
| 签名/公证 | 未验证、无证书 | 未签名、未公证 | 无发行证书；交叉包为 ad-hoc，原生公证未验证 |
| 截图与字体 | 未验证 | 通过当前截图范围 | 未验证 |
| 真实服务器/物理听音/媒体键 | 未验证 | 未验证 | 未验证 |
| 最低系统版本 | Windows 11 实机未验证 | 当前 13.7.8 通过；13.0 未验证 | 13.0 未验证 |

GitHub Actions run `34934352140`（`51cf322`）已在 Windows x64、macOS Intel x64 与 macOS arm64 完成全部源码和打包应用闸门，确认 `1f23427` 对 arm64 音频请求观察和 Intel 暂停队列落盘/恢复的修复有效。该自动化证据仍不等于三个目标的完整人工发布验收。

候选标签 `v0.1.0-rc.1` 触发 release run `34937503560`：Windows x64 与 macOS Apple Silicon arm64 release gate 通过，macOS Intel x64 在源码 Electron 冒烟失败，因此 Intel 未打包，最终发布 job 被依赖门禁跳过，没有创建或上传不完整 Release。同一提交的普通 run `34937431939` 也在 Intel 源码冒烟失败，排除 Release 写权限或上传步骤为根因。GitHub 匿名 API 不返回完整 job log，后续测试会将脱敏失败栈写入 Check Summary；没有以自动重试或删除断言掩盖失败。

诊断提交 `54e15df` 保持全部原断言，只在失败时将脱敏错误栈写入 Check Summary。本机源码 Electron 冒烟通过；GitHub Actions run `34938572347` 的 Windows x64、macOS Intel x64 与 macOS arm64 全流程也全部通过，Intel 前两次失败未稳定复现。为保留标签审计历史，不移动或强推 `v0.1.0-rc.1`；下一个发布候选递增为 `v0.1.0-rc.2` 并重新执行三个 release gate。

候选标签 `v0.1.0-rc.2` 触发 release run `35036809845`：Windows x64 与 macOS Apple Silicon arm64 release gate 通过，macOS Intel x64 在源码 Electron 冒烟失败，发布 job 再次安全跳过。随后检查注释先后定位歌单写后刷新竞态、断开时空队列覆盖和测试硬编码短音频当前曲目三处问题；提交 `09b1ab0` 的普通 CI run `35039453442` 已在三个目标完成源码/打包应用 Electron 冒烟、安装包构建和包验证并全部通过。`rc.1` 与 `rc.2` 标签均保留且不改写，下一候选为 `v0.1.0-rc.3`。

版本提交 `cc33168` 的普通 CI run `35040182258` 与标签 `v0.1.0-rc.3` 的 release run `35040657787` 均在 Windows x64、macOS Intel x64 与 macOS Apple Silicon arm64 完整通过。发布 job 创建了非草稿、非 Latest 的 Pre-release，共七个附件：三个安装包、三个 manifest 与 `SHA256SUMS.txt`；校验清单为 610 字节且恰好包含六行，对应六个文件名。Release 地址为 `https://github.com/zhiyxn/Sonavi/releases/tag/v0.1.0-rc.3`。该候选的构建源是版本提交 `cc33168`，因此不包含 P11 审查修复；P11 修复提交 `557b62d` 的普通 CI run `35061052839` 在三个目标通过后，版本推进到 `0.1.0-rc.4`。提交 `acb7c8c chore(release): 准备 v0.1.0-rc.4` 的普通 CI run `35062596436` 三目标全通过，随后创建标签 `v0.1.0-rc.4`；release run `35063014155` 的 Windows x64、macOS Intel x64、macOS Apple Silicon arm64 三个 release gate 与发布 job 全部通过，发布 job 创建了非草稿、非 Latest 的 Pre-release，共七个附件：三个安装包、三个 manifest 与 610 字节、六行的 `SHA256SUMS.txt`。Release 地址为 `https://github.com/zhiyxn/Sonavi/releases/tag/v0.1.0-rc.4`。发布 job 不再写死 Release notes 文件名，改为按标签读取 `docs/RELEASE-NOTES-${GITHUB_REF_NAME}.md` 并在缺失时失败，避免新候选静默套用旧候选说明。

## 发布前安全审计

- [x] Electron 安全偏好、严格 CSP、导航/新窗口/权限默认拒绝未放宽。
- [x] preload 仅固定业务方法；main 对每个 IPC 检查受信 sender 和 Zod 输入，会话/权限在服务层再次约束。
- [x] renderer ESLint 禁止 Node、`process`、localStorage、sessionStorage 与 `v-html`；未发现任意 URL 代理或原始 IPC。
- [x] 密码/token/salt/Cookie/Authorization 不进入 renderer store、日志、认证输出或明文 userData；safeStorage 失败不落盘明文。
- [x] API/媒体禁止重定向；HTTPS 证书校验不关闭；手动代理拒绝 URL 内嵌凭据。
- [x] 音频流保留背压，不整首缓冲/缓存/Base64 IPC；Range 只接受单段并正确处理 200/206/416。
- [x] 诊断限量脱敏；歌词纯文本；renderer 不使用 `v-html`，减少 XSS 面。
- [x] 收藏/歌单写入固定端点和参数、写后重读；scrobble 按 queueEntryId 防重且不盲目重试未知结果。
- [x] 队列、封面缓存和凭据按账号范围隔离；忘记账号清除对应状态。
- [x] 暂停队列保存串行化；断开与真正退出先等待最新队列 flush，退出确认 IPC 校验 sender，5 秒后安全兜底，资源只在 `will-quit` 释放。
- [x] ASAR 不含构建期 node_modules、测试或项目源码；`npm audit` 为 0 vulnerabilities。
- [ ] Windows Authenticode、macOS Developer ID、公证/stapling 和下载隔离属性下系统安全检查未执行。

## 未验证、已知问题与结论

- 当前包未签名/未公证，不能作为正式公开发布物；不得用关闭 Gatekeeper/SmartScreen 等方式替代签名。
- Windows 候选包验证与打包应用冒烟已在当前主机通过，但 Windows 11 安装 UI、图标、桌面行为与声音仍待实机；Apple Silicon 自动包内冒烟已由 CI 通过，实际安装验收仍待对应设备。
- macOS Intel 未人工操作 Finder/Dock 图标遮罩、菜单栏每一项、物理媒体键、睡眠/锁屏和扬声器。
- 用户真实服务器的格式、转码器、代理、歌单权限、scrobble 计数和大型资料库仍需单独验证。
- 0.1.0 没有旧公开版本迁移样本；当前只证明同一 candidate 的 versioned userData 可跨进程重启恢复。
- 构建仍有 Rollup 移除 Zod 注释位置的非阻断提示；Zod 已正确内联，类型、测试和包内运行均通过。

结论：release run `35040657787` 已使 Windows x64、macOS Intel x64 与 macOS arm64 的源码、打包和包内自动闸门全部通过。`0.1.0-rc.3` 已作为明确标注未签名/未公证的 Pre-release 测试包提供下载；正式发布继续被对应实机安装、正式签名/公证、真实服务器与人工音频/桌面测试阻断。

## 诊断分类与媒体终态修正复验（2026-09-16）

- 触发证据：用户导出的诊断中 6 次 API 请求 duration 12002–12015ms 且无 `status`，被记为 `cancelled`；两对音频记录（1,007ms 与 60,132ms）同一时间戳各出现 `cancelled` 与 `broken-stream`。代码定位到 `network-diagnostics.ts` 的文本分类器把内部超时的 AbortError 归为取消，以及 `media-protocol.ts` 的 `cancel()` 与 `pull()` 各记一条终态。
- 修正后的验证：`npm run lint`（0 warning）、`npm run typecheck`（node/web/test 三组）、`npm test`（24 文件、122 项）通过；新增 7 项测试覆盖超时/取消分类、`operation` 与脱敏错误文本、媒体单终态。
- 回归证据：把四个源码文件回退到修正前、只保留测试，新增测试 9 项失败（含 `expected 'cancelled' to be 'timeout'` 与媒体双记录）；恢复修正后全部通过。
- 未验证：真实服务器/代理路径下的 12 秒超时是否消失、直连对照、macOS/Windows 实机；本机执行环境为 Node.js v24.13.0，未使用 `.nvmrc` 的 22.19.0。

## P11 独立审查复验（2026-09-16）

本节只记录 P11 本轮实际执行，不把上文历史 CI 当成本轮通过。

- 环境：Windows NT 10.0.26200 x64（25H2），Node.js 22.21.1，npm 10.9.4；`.nvmrc` 精确的 22.19.0 未安装。
- `npm run lint`：通过，0 warning。
- `npm run typecheck`：node/web/test 三组通过。
- 修复前基线 `npm test`：24 个文件、109 项通过。项目没有独立 integration script；集成场景包含在 Vitest 与 Electron fixture 中。
- `npm run build`：通过；Zod PURE 注释位置产生非阻断 Rollup 提示。
- `npm run test:e2e`：通过；启动 601 ms，20 轮切页工作集增量 52,924 KiB，媒体请求 +0。
- `npm run build:win`：通过；生成未签名 `0.1.0-rc.3` Windows x64 NSIS，没有发布。
- 修复前基线 `npm run verify:package -- win-x64`：通过；安装包 112,752,829 字节，SHA-256 `5f124e471b2dcb2170f39771782a2dfcff0d9740d91a4affb5cc98577298d8bf`，应用 x64、unsigned，ASAR 1,648,046 字节。
- `npm run test:e2e:package -- win-x64`：通过；启动 760 ms，20 轮切页工作集增量 28,556 KiB，媒体请求 +0。
- `npm audit --audit-level=high`：通过，0 vulnerabilities。
- 960×640 自动检查无横向溢出；1440×900 未执行精确尺寸检查。
- 本轮真实 HTMLAudioElement 仅使用合成 PCM WAV；MP3、AAC/M4A、FLAC、Opus/Ogg 与真实 MP3 转码输出均未验证。
- 当前含未提交新 logo 的工作区未执行 macOS Intel/arm64 构建、包验证或包内冒烟。

P11 修复前审查结论：可以进入真机测试；Blocker 0，Critical 1。该 Critical 随后已在下节修复；本阶段没有配置签名/公证/自动更新或发布 Release。

## P11 问题修复验证（2026-09-16）

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| `npm run lint` | 通过 | ESLint 0 warning |
| `npm run typecheck` | 通过 | node、web、test 三组通过 |
| `npm test` | 通过 | 24 个文件、115 项测试 |
| `npm run build` | 通过 | main/preload/renderer；生产 CSP 不含 localhost WebSocket |
| `npm run test:e2e` | 通过 | 源码 Electron 完整冒烟；启动 694 ms；20 轮切页内存 +51,720 KiB，媒体请求 +0 |
| `npm run build:win` | 通过 | 生成未签名 Windows x64 NSIS；未发布 |
| `npm run verify:package -- win-x64` | 通过 | 112,788,192 字节；SHA-256 `72a5be09328afe0cceff365e85414880acd19e06c32cbae1265abebe0c5b9aac`；ASAR 1,862,401 字节；unsigned |
| `npm run test:e2e:package -- win-x64` | 通过 | 启动 814 ms；20 轮切页内存 +51,308 KiB，媒体请求 +0；全链路通过 |

新增回归覆盖媒体句柄 10,000 个后续封面压力、加密转码 seek URL schema、ended scrobble、播放错误按原进度重试、专辑错误原地重试和 `getArtists` 独立响应上限。端到端覆盖 Reka/shadcn 风格 Select 的键值持久化、自动分页、兼容转码 seek、凭据恢复/删除和旧媒体句柄撤销。

修复后结论：可以进入真机测试；Blocker 0，Critical 0，Major 4。真实服务器艺术家/scrobble、自动断网恢复、真实格式矩阵、macOS 两架构及人工桌面/安装测试仍未验证，详见 `docs/KNOWN-ISSUES.md` 与 `docs/TEST-MATRIX.md`。

## P12 Windows + macOS 真机回归（进行中）

起始日期：2026-09-16

- 代码基线：`main` / `fe5b07a`，工作区起始状态干净。
- 本轮不增加新功能，不发布、不上传、不修改真实服务器数据来制造测试样本。
- 真实账号密码只允许用户在 Sonavi UI 中输入；测试记录不保存服务器地址、账号、密码、token、salt、Cookie 或 Authorization。
- Windows 当前桌面可用于真机测试；macOS Intel x64 与 Apple Silicon arm64 因没有可控制实机，初始状态为 `BLOCKED`。
- 状态只使用 `PASS`、`FAIL`、`BLOCKED`、`NOT TESTED`；fixture、单元测试和历史 CI 不替代 P12 真机结果。
- 完整用例、状态定义、阻断原因和通过率算法见 `docs/TEST-MATRIX.md`。

当前进度：P12 Windows 真机回归已开始；真实凭据自动恢复已通过，队列当前项定位发现 1 个问题并完成小范围修复，等待新包真机复验。macOS 因缺少对应实机保持 `BLOCKED`。

### P12 Windows 未签名包准备

- 使用 Node.js 22.21.1、npm 10.9.4 在 Windows NT 10.0.26200 x64 从 `fe5b07a` 执行 `npm run build:win`，通过；没有发布或上传。
- `npm run verify:package -- win-x64` 通过：目标 `win-x64`、版本 `0.1.0-rc.4`、应用标识 `com.sonavi.desktop`、最低系统 `Windows 11`、签名状态 `unsigned`、ASAR 1,865,170 字节。
- NSIS：112,789,035 字节；SHA-256 `54f2d19542a575763b98d76a68981bb9d69e5a7888ff7f8617631764a1d75b13`。
- 已从 `release/0.1.0-rc.4/win-unpacked/Sonavi.exe` 启动测试包进程；当前工具环境禁止原生 Windows UI 观察和输入，因此窗口、任务栏、托盘、登录和真实播放仍等待人工确认，状态不记为 `PASS`。

### P12 Windows 真实凭据恢复

- A-01 正确账号认证：`PASS`。Windows 未签名测试包使用既有加密凭据成功认证真实 Navidrome；由用户人工确认。
- A-06 重启后凭据恢复：`PASS`。新进程启动后无需重新输入凭据即恢复连接；账号、密码和服务器地址均未进入测试记录。
- 当前已执行 2 项、失败 0 项；阶段通过率 100%（2/2），Windows 执行覆盖率 3.5%（2/57）。该数字只反映当前已执行项，不代表 P12 已完成。

### P12-MI-001 队列当前项定位

- Windows 真机观察：当前播放项不是队列第一项时，关闭并重新打开播放队列，列表仍从第一项显示；C-14 为 `FAIL`。
- 影响：只影响长队列中的可见定位，不改变实际当前歌曲、播放状态或队列顺序。
- 小范围修复：打开队列后等待 Vue 完成 DOM 更新，再将带 `aria-current="true"` 的当前项滚动到列表中央；未增加新的业务能力。
- 新包：2026-09-17 在 Windows x64、Node.js 22.21.1 上重新执行 `npm run build:win` 与 `npm run verify:package -- win-x64`，均通过；NSIS 112,788,863 字节，SHA-256 `2ddf941740fd5129a7cea4e3aff54ee22475be7ea484fba41eff391bc92baec7`，ASAR 1,865,575 字节，签名状态 `unsigned`。没有发布或上传。
- 当前状态：`RETEST`。新包已经生成并通过结构验证，仍需由 Windows 真机重新确认，不能提前改为 `PASS`。
- 当前阶段统计：`PASS` 2、`FAIL` 1，通过率 66.7%（2/3），Windows 执行覆盖率 5.2%（3/58）。
- 自动验证：定向回归 12/12 通过；`npm run lint`、`npm run typecheck`、`npm test`（24 文件、123/123）和 `npm run build` 均通过。构建只有既有 Zod PURE 注释警告。

### P12-MI-002 队列当前项可读性

- Windows 浅色与深色真机截图：播放队列当前歌曲标题均与当前行背景对比不足；C-15 为 `FAIL`。
- 影响：难以辨认当前歌曲名，但不影响播放、队列顺序或操作。
- 小范围修复：标题改用各主题的高对比正文色，当前行用 3px 主强调色左侧标记区分；不改变播放器业务行为。
- 当前状态：`RETEST`。按用户要求不单独生成验证包，等待本批问题全部修复后统一构建并真机复验。
- 自动验证：Node.js 22.21.1 下播放器定向组件回归 12/12；补充暗色证据后，真实 CSS 规则测试 2/2、`npm run lint` 与 `npm run typecheck` 均通过。视觉结果仍需新包真机确认。
- 当前阶段统计：`PASS` 2、`FAIL` 2，通过率 50.0%（2/4），Windows 执行覆盖率 6.8%（4/59）。

### P12-MI-003 主播放控制图标可读性

- Windows 真机截图：主播放/暂停按钮的图标前景被播放器通用按钮规则覆盖，与琥珀色背景对比不足；C-16 为 `FAIL`。
- 影响：主控制图标难以辨认，但不影响实际播放和暂停操作。
- 小范围修复：给主播放控制增加独立样式标记，正常与悬停状态均使用白色图标并保留强调色背景；不改变播放器行为。
- 当前状态：`RETEST`。按用户要求等待本批问题全部修复后统一构建并真机复验。
- 自动验证：Node.js 22.21.1 下定向组件回归 13/13、`npm run lint` 与 `npm run typecheck` 均通过；视觉结果仍需新包真机确认。
- 当前阶段统计：`PASS` 2、`FAIL` 3，通过率 40.0%（2/5），Windows 执行覆盖率 8.3%（5/60）。

### P12-MI-004 播放器内点击关闭队列

- Windows 真机反馈：队列打开后点击播放器底栏的其他区域，队列仍保持展开；C-17 为 `FAIL`。
- 影响：关闭面板需要再次点击队列按钮，不影响播放或队列数据。
- 小范围修复：队列面板内部和队列按钮保持原行为，点击播放器其他区域关闭队列，同时不阻断被点击控制的原操作。
- 当前状态：`RETEST`。按用户要求等待本批问题全部修复后统一构建并真机复验。
- 自动验证：Node.js 22.21.1 下定向组件回归 14/14、`npm run lint` 与 `npm run typecheck` 均通过；真实点击体验仍需新包真机确认。
- 当前阶段统计：`PASS` 2、`FAIL` 4，通过率 33.3%（2/6），Windows 执行覆盖率 9.8%（6/61）。

### P12-MI-005 页面栏目标题重复伪序号

- Windows 真机反馈：多个页面显示重复的 03/05/06 等编号，但这些值是硬编码装饰文案，没有导航或业务含义；G-C01 为 `FAIL`。
- 影响：七个共享页面标题含有误导信息，功能不受影响；Windows 与 macOS 共用同一 renderer。
- 小范围修复：统一移除连接、音乐库、艺术家、搜索、收藏、歌单和设置页面眉题中的数字与斜线，仅保留栏目名称。
- 当前状态：`RETEST`。按用户要求等待本批问题全部修复后统一构建并真机复验。
- 自动验证：Node.js 22.21.1 下 `tests/unit/app-shell.test.ts` 4/4 通过，覆盖七个页面眉题及无斜线约束。
- 当前阶段统计：`PASS` 2、`FAIL` 5，通过率 28.6%（2/7），Windows 执行覆盖率 11.3%（7/62）。

### P12-MI-006 艺术家完整索引重复慢请求

- Windows 真实服务器反馈：公共 `getArtists` 首次完整索引响应较慢；原页面成功缓存仅 30 秒，切页或重新聚焦可能再次发送全量请求；B-03 为 `FAIL`。
- 影响：大型音乐库的艺术家页面等待时间和服务端负载。列表已经虚拟渲染，主要瓶颈不在 DOM 行数。
- 小范围优化：同一连接会话内持续复用成功索引并禁用聚焦重取；断开连接、退出账号或网络配置变化时继续清空。首次请求仍是协议规定的全量请求。
- 当前状态：`RETEST`。需在新包中确认首次加载，并在切页、等待和重新聚焦后确认没有重复等待。
- 自动验证：Node.js 22.21.1 下 `tests/unit/library-ui.test.ts` 3/3 通过，其中覆盖同一 QueryClient 卸载并重新打开艺术家页面只调用一次 `listArtists`；`npm run lint` 与 `npm run typecheck` 通过。

### P12-MI-007 按钮点击光标一致性

- Windows 真机反馈：可点击按钮没有统一显示小手；G-C02 为 `FAIL`。
- 影响：鼠标交互提示不一致，不影响实际点击或键盘操作。
- 小范围修复：所有可用原生按钮使用 `pointer`，禁用按钮使用 `not-allowed`；更具体的连接等待状态仍使用 `wait`。
- 当前状态：`RETEST`。按用户要求等待本批问题全部修复后统一构建并真机复验。
- 自动验证：真实 `base.css` 注入 JSDOM 后的计算样式测试通过；与艺术家缓存合并运行 2 文件、4/4 通过，`npm run lint` 与 `npm run typecheck` 通过。
- 当前阶段统计：`PASS` 2、`FAIL` 7，通过率 22.2%（2/9），Windows 执行覆盖率 14.3%（9/63）。

### P12-MI-008 真实服务器播放记录同步失败

- Windows 真机观察：播放真实歌曲时界面出现“播放记录暂时未同步；音乐播放不受影响。”；C-18 为 `FAIL`，也构成 RC-MA-002 的真实失败证据。
- 代码确认：播放记录功能已实现；进入 playing 后发送 `submission=false`，累计真实播放达到曲长 50% 与 240 秒中较小者或收到 ended 后发送 `submission=true`。失败提示只在 `scrobble` 请求被拒绝或发生网络错误时出现，后续成功上报会清除提示。
- 影响：当前失败的 now-playing 或 submission 可能没有进入服务器统计；音乐播放本身继续进行。
- 当前状态：`OPEN`。没有脱敏诊断前不能判断是 HTTP 状态、12 秒超时、服务端协议差异还是权限问题，也不能将其标为已修复。
- 重试边界：当前队列项的每种上报只尝试一次，不对未知结果盲目重试，避免服务器已写入但客户端未收到响应时造成重复计数。
- 当前阶段统计：`PASS` 2、`FAIL` 8，通过率 20.0%（2/10），Windows 执行覆盖率 15.6%（10/64）。

### P12-MI-009 播放栏当前歌曲封面

- Windows 真机反馈：播放器底栏只显示音乐符号，没有显示当前歌曲已有封面；C-19 为 `FAIL`。
- 影响：降低播放器中的当前歌曲视觉识别，不影响播放和封面安全边界。
- 小范围修复：有封面时复用当前歌曲已有的受限 `coverUrl`，无封面显示音乐符号、未选歌显示 Sonavi 占位符；不新增 API 或上游地址访问。
- 当前状态：`RETEST`。按用户要求等待本批问题全部修复后统一构建并真机复验。
- 自动验证：Node.js 22.21.1 下播放器定向回归 15/15、`npm run lint` 与 `npm run typecheck` 均通过；真实封面加载仍需新包真机确认。
- 当前阶段统计：`PASS` 2、`FAIL` 9，通过率 18.2%（2/11），Windows 执行覆盖率 16.9%（11/65）。

### P12 本批修复统一 Windows 包（2026-09-17）

- 范围：包含 P12-MI-001～P12-MI-007 与 P12-MI-009 的待复验修正；P12-MI-008 scrobble 失败仍为 `OPEN`，音频磁盘缓存未纳入 P12。
- 自动闸门：Node.js 22.21.1 下 `npm run lint`、`npm run typecheck`、`npm test`（25 文件、130/130）和 `npm run build` 全部通过；只有既有 Zod PURE 注释位置警告。
- Windows 构建：`npm run build:win` 通过，生成未签名 `0.1.0-rc.4` x64 NSIS；没有发布或上传。
- 包验证：`npm run verify:package -- win-x64` 通过；NSIS 112,788,943 字节，SHA-256 `6fc49135d56aabdb7c8a02f6a66c4509804e0356ab23b415fe127e38a2d270b8`；ASAR 1,866,755 字节，应用标识 `com.sonavi.desktop`，最低系统 Windows 11，签名状态 `unsigned`。
- 该包只具备自动化与结构验证证据；P12 真机状态在用户完成本轮复验前不改为 `PASS`。

### P12-MI-010 专辑列表滚动位置恢复

- Windows 真机反馈：从专辑详情返回后列表回到顶部；C-20 为 `FAIL`。
- 影响：长专辑列表中需要重新滚动并寻找刚查看的专辑；分页数据本身仍在查询缓存中。
- 小范围修复：首页“最近添加”和“全部专辑”从当前列表打开详情时保存 workspace 滚动位置，详情切换到顶部；点击返回并完成 DOM 更新后恢复原位置。外部入口直接打开详情不使用无关旧位置。
- 当前状态：`RETEST`。2026-09-17 11:08 启动的统一测试包不包含此后新增修复，需下一统一包真机复验。
- 自动验证：Node.js 22.21.1 下 `tests/unit/library-ui.test.ts` 5/5、`npm run lint` 与 `npm run typecheck` 均通过；参数化覆盖 `newest` 首页和 `alphabeticalByName` 全部专辑。
- 当前阶段统计：`PASS` 2、`FAIL` 10，通过率 16.7%（2/12），Windows 执行覆盖率 18.2%（12/66）。

### P12-MI-011 页面切换滚动位置恢复

- Windows 真机反馈：切换到其他栏目再返回专辑等页面后，原滚动位置丢失；F-10 为 `FAIL`。
- 影响：浏览长列表时切页后需要重新寻找离开前的内容，页面间的工作上下文无法保留。
- 小范围修复：应用外壳以页面为键保存共享 workspace 的滚动位置，专辑和艺术家详情使用独立键，艺术家内部虚拟列表单独保存位置；切换页面或详情后等待 Vue 完成 DOM 更新再恢复。设置页不保存且每次进入置顶；连接、断开和忘记账号时清空位置，避免跨会话继承。
- 当前状态：`RETEST`。2026-09-17 11:08 启动的统一测试包不包含 MI-010、MI-011，需下一统一包真机复验。
- 自动验证：Node.js 22.21.1 下最新滚动定向测试 11/11、全量 Vitest 26 文件/137 项、`npm run lint` 与 `npm run typecheck` 通过；覆盖专辑位置恢复、设置始终置顶和艺术家内部列表位置恢复。按用户要求本轮未重新构建或启动应用。
- 当前阶段统计：`PASS` 2、`FAIL` 11，通过率 15.4%（2/13），Windows 执行覆盖率 19.4%（13/67）。

### P12-MI-012 艺术家到专辑的导航上下文

- Windows 真机反馈：搜索并打开艺术家详情后，再打开其专辑会把左侧激活项切为“专辑”；专辑返回按钮进入全部专辑列表；F-11 为 `FAIL`。
- 影响：用户无法沿原浏览路径返回艺术家详情，且艺术家详情的滚动位置丢失。
- 小范围修复：从艺术家详情打开专辑时保留艺术家为当前导航栏目和原艺术家 ID；详情按钮显示“返回艺术家详情”，返回后恢复原艺术家详情位置。从首页、专辑、搜索专辑和收藏专辑直接进入时继续使用原有专辑路径。
- 请求行为：艺术家来源的专辑详情只请求目标专辑，不再因复用页面组件额外请求完整专辑列表。
- 当前状态：`RETEST`。当前已启动的统一测试包不包含 MI-010～MI-012，需下一统一包真机复验。
- 自动验证：Node.js 22.21.1 下定向测试 11/11、全量 Vitest 25 文件/134 项、`npm run lint`、`npm run typecheck` 与生产构建均通过；构建仅有既有 Zod PURE 注释位置警告。
- 当前阶段统计：`PASS` 2、`FAIL` 12，通过率 14.3%（2/14），Windows 执行覆盖率 20.6%（14/68）。

### P12-MI-013 专辑详情歌曲列表内部滚动

- Windows 真机反馈：专辑详情滚动歌曲时整个页面一起滚动；B-11 为 `FAIL`。
- 影响：长专辑浏览时标题、返回/收藏按钮和专辑信息离开视野，返回操作不便。
- 小范围修复：仅在专辑详情状态关闭 workspace 外层滚动；详情容器占满播放器上方空间，标题、操作区和专辑摘要固定，歌曲列表独立纵向滚动并隔离滚动边界。歌曲列表增加可访问名称和键盘焦点，列表页行为不变。
- 当前状态：`RETEST`。当前已启动的统一测试包不包含 MI-010～MI-013，需下一统一包真机复验。
- 自动验证：Node.js 22.21.1 下相关定向测试 14/14、全量 Vitest 25 文件/135 项、`npm run lint`、`npm run typecheck` 与生产构建均通过；构建仅有既有 Zod PURE 注释位置警告。
- 当前阶段统计：`PASS` 2、`FAIL` 13，通过率 13.3%（2/15），Windows 执行覆盖率 21.7%（15/69）。

### P12-MI-014 搜索显式提交

- Windows 真机反馈：搜索应改为按 Enter 或点击搜索按钮后执行，不应在输入停顿后自动请求。
- 小范围修复：移除 300ms 输入防抖，将输入关键词与已提交关键词分离；Enter 和搜索按钮共用提交函数，空白输入禁用按钮且不会搜索。既有分页、取消、加载、空、错误和重试状态保持不变。
- 自动验证：Node.js 22.21.1 下新增搜索面板定向测试 1/1、`npm run lint`、`npm run typecheck` 与全量 Vitest 26 文件/136 项通过。
- 当前状态：`RETEST`。按用户要求未重新构建或启动应用，当前运行包不包含该修复。

### P12-MI-015 艺术家列表单一滚动容器

- Windows 真机反馈：艺术家列表已有内部滚动条，但外层 workspace 仍出现第二条滚动条。
- 小范围修复：只在艺术家列表态关闭 workspace 外层滚动，让页面占满播放器上方空间；虚拟列表伸缩填充剩余高度并通过 ResizeObserver 动态计算可见行。艺术家详情仍沿用正常 workspace 滚动。
- 可访问性：内部列表支持键盘聚焦并提供“艺术家列表”名称，滚动边界限制在列表内。
- 自动验证：Node.js 22.21.1 下相关定向测试 15/15、`npm run lint`、`npm run typecheck` 与全量 Vitest 26 文件/137 项通过。
- 当前状态：`RETEST`。未重新构建或启动应用，当前运行包不包含该修复。

### P12-MI-016 首页与专辑显式分页

- 用户要求：首页和专辑使用 shadcn-vue Pagination，不再依赖滚动到底部自动续载。
- 实现：通过官方 shadcn-vue CLI 加入 Pagination 源码并保留现有 Button；按项目已有 `@lucide/vue`、中文界面和 `exactOptionalPropertyTypes` 规则适配组件。`LibraryPanel` 每页查询 30 张，查询键加入页码；应用外壳分别保存首页与专辑当前页，翻页置顶，详情返回保留页码。
- 协议边界：`getAlbumList2` 响应没有总数，只提供 `hasMore`，因此分页器仅展示已经确认的页以及下一可用页，不伪造总页数。
- 自动验证：Node.js 22.21.1 下分页定向测试 7/7、与应用外壳合并 13/13；`npm run lint`、`npm run typecheck`、全量 Vitest 26 文件/139 项均通过。Electron E2E 脚本已改为点击下一页、验证末页禁用并返回第一页，但本轮按用户要求未构建、未启动应用，也未执行 Electron 冒烟。
- 当前状态：`RETEST`。当前运行测试包不包含该改动。

### P12-MI-017 Sonner 错误提醒与二次确认

- 用户要求：错误提醒和二次确认使用 shadcn-vue Sonner，并参考 vue-sonner 官方 API。
- 实现：通过官方 shadcn-vue CLI 加入 Sonner 源码和锁定版 `vue-sonner`，在应用根节点加载官方 CSS 并挂载唯一 Toaster；组件颜色、圆角、字体和 action/cancel 按钮复用 Sonavi tokens。统一通知工具提供稳定 ID 的错误 toast、响应式错误监听及 Promise 化确认。
- 覆盖范围：连接、应用启动/账号操作、设置、收藏/歌单写入、音乐库/专辑/艺术家/搜索/收藏/歌单/歌词查询、播放错误及播放记录同步。加载失败状态卡保留重试入口，避免 toast 消失后页面失去恢复路径。
- 二次确认：删除歌单与退出并忘记账号不再使用 `window.confirm`；Sonner 持续显示确认/取消，取消、关闭或自动关闭均返回 false，确认后才进入既有服务调用，并阻止重复触发。Electron E2E 已从原生 dialog 接受改为点击 Sonner action。
- 自动验证：Node.js 22.21.1 下相关定向 6 文件/20 项、全量 Vitest 28 文件/144 项、`npm run lint` 和 `npm run typecheck` 全部通过。本轮未构建、未启动应用、未执行 Electron 冒烟。
- 当前状态：`RETEST`。当前运行测试包不包含该改动。

### P12-MI-018 页面会话缓存与当前视图刷新

- 用户要求：切换页面时不要整体刷新，提供明确刷新按钮，减少对服务器的频繁请求。
- 实现：应用外壳以 `KeepAlive` 保留首页、专辑、艺术家、搜索、收藏和歌单实例；设置页继续按进入时读取本地设置。上述数据查询改为当前连接会话内保持新鲜，禁用挂载和窗口聚焦自动重取，搜索输入/结果与歌单详情不会因栏目切换丢失。
- 刷新范围：首页/专辑只重取当前 30 张分页或当前专辑详情；艺术家、收藏和歌单只重取当前列表或详情；搜索只重取已提交结果。按钮在请求中禁用并显示“正在刷新…”，不清空其他页面缓存。
- 一致性边界：收藏和歌单写操作继续失效相关服务器事实；网络设置变化清查询并轮换页面缓存；恢复/解锁、断开和忘记账号继续走既有清理流程，因此不会跨账号或旧网络上下文复用。
- 自动验证：Node.js 22.21.1 下定向测试 4 文件/21 项、全量 Vitest 28 文件/146 项、`npm run typecheck` 通过；ESLint 首轮只发现并修正 1 处模板换行格式，修正后通过。覆盖查询缓存复用、手动刷新只增加一次当前请求，以及切页后搜索条件和结果不丢失。
- 当前状态：`RETEST`。按用户要求未构建、未重启或打开新包，当前运行测试包不包含该改动。

### P12-MI-019 shadcn-vue 基础交互组件统一

- 用户要求：通用 UI 功能优先直接使用项目持有的 shadcn-vue 组件，减少原生标签与手写基础控件并存。
- 实现：通过官方 shadcn-vue CLI 引入 Input、Checkbox、Label、Slider 与 AlertDialog，并以官方完整 Select 组件族替换原简化封装；组件按 Sonavi tokens、`@lucide/vue` 和 `exactOptionalPropertyTypes` 适配，CLI 自动放宽的依赖版本范围已恢复为精确锁定。连接、搜索、歌单、设置、歌词和播放器完成迁移；Sonner 只处理通知，删除歌单与退出并忘记账号使用 AlertDialog。
- 保留边界：左侧导航、专辑/艺术家/歌单实体入口、队列曲目和虚拟列表行属于业务组件，继续使用语义化原生按钮，不为形式统一套用通用 Button。Slider 提交到 AudioEngine 前将 seek 归一化到毫秒精度、音量归一化到百分之一，避免转码 `timeOffset` 浮点尾差。
- 自动验证：Node.js 22.21.1 下 `npm run lint`、`npm run typecheck`、`npm test`（28 文件/147 项）、`npm run build` 全部通过。Windows 源码 Electron 完整冒烟通过，覆盖连接 Checkbox、显式搜索、歌单 Checkbox、设置 Select 持久化、原始与 MP3 转码 Slider seek、诊断、生命周期、队列恢复和凭据恢复/删除；构建仅有既有 Zod PURE 注释位置警告。
- 当前状态：`RETEST`。未重新生成 Windows 安装包；macOS Intel x64 与 Apple Silicon arm64 实机均未验证。

### P12-MI-020 播放器布局与艺术家缓存页重绘

- Windows 源码预览反馈：shadcn-vue Slider 的进度/音量滑块圆点掉到轨道下方；播放控制区被左右不对称内容推离窗口中心；艺术家页从 `KeepAlive` 恢复时列表偶发空白，滚动后才重绘。
- 修复：取消 `.player-bar span` 对 Slider 根节点 `display:flex` 的覆盖；播放器改为对称的“歌曲区 / 控制区 / 工具区”三列网格；艺术家虚拟列表在 `onActivated` 后重新同步滚动位置与视口高度，列表行改用绝对 `top` 定位以避免 Chromium 恢复后的延迟合成。
- 自动验证：Node.js 22.21.1 下 `npm run lint`、`npm run typecheck`、`npm test`（28 文件/148 项）和 `npm run test:e2e` 全部通过。Electron 实渲染断言确认两个 Slider 圆点与轨道中心对齐，播放控制区与播放器几何中心偏差不超过 1px；艺术家导航、详情和专辑返回链路通过。
- 当前状态：`RETEST`。Windows 源码 Electron 已验证；真实大型艺术家索引和 macOS 两架构实机仍未验证。

### P12-MI-021 危险操作确认与通知关闭位置

- 用户要求：清空封面缓存和断开连接都必须二次确认；Sonner 通知的关闭按钮从左上移到右上。
- 实现：两项操作均复用项目持有的 shadcn-vue `AlertDialog`，取消时不调用 IPC，确认后才执行；对话框明确说明本地缓存、服务器音乐和加密凭据的边界。Toaster 使用 vue-sonner 官方 `closeButtonPosition="top-right"` 属性。
- 自动验证：Node.js 22.21.1 下 lint、typecheck、28 文件/148 项 Vitest、生产构建与 Windows 源码 Electron 完整冒烟均通过。E2E 验证关闭按钮 `data-close-button-position=top-right`，并实际确认清空缓存与断开连接流程。
- 当前状态：`RETEST`。Windows 源码 Electron 已验证；未生成新安装包，macOS 实机未验证。

### P12-MI-022 封面并发、专辑重试诊断与连续 scrobble

- 真实证据：首份诊断中 28 个 `getCoverArt` 在约 10 ms 内发起，`getAlbumList2` 呈默认多次重试；随后用户提供的界面记录确认 `operation=scrobble`、无 HTTP 状态、12014 ms、`timeout`。因此 scrobble 已进入传输层，但真实超时根因仍无法仅凭客户端日志唯一归因。
- 实现：专辑网格图片使用 `loading=lazy`、异步解码和低 fetch priority，只加载可视区域附近封面；main 的媒体协议对缓存未命中的封面上游读取设置全局 6 并发，并在完成、取消、错误或会话撤销时释放槽位。`getAlbumList2` 显式设为最多一次自动重试，手动重试重新计数。
- 诊断：导出结构升级为 schema v2；专辑列表 API 条目增加经白名单过滤的 `listType/page/size` 与 1 起始尝试序号，不记录 URL、资源 ID、凭据或响应正文。设置页同步显示这些字段。
- 播放上报：修复队列项变化时重置后立即返回的问题；如果新歌曲第一次被观察到时已经是 `playing`，现在立即发送独立 now-playing，即使上一首请求超时也不会被其状态阻断。未知结果仍不自动重试，以免服务器实际已写入时重复计数。
- 自动验证：Node.js 22.21.1 下 lint、typecheck、全量 Vitest 28 文件/153 项、生产构建和 Windows 源码 Electron 完整冒烟通过；网络诊断、OpenSubsonic 客户端、媒体协议、播放上报和专辑 UI 定向测试 5 文件/59 项通过，专辑 UI 新增重试/尝试序号后单文件 10 项通过。E2E 实际断言诊断页显示 `getAlbumList2 · listType=newest,page=1,size=30 · 第 1 次` 与 `scrobble` 条目；构建只有既有 Zod PURE 注释位置警告。
- 当前状态：`RETEST`。Windows 真实服务器需确认封面峰值、每页最多两次 `getAlbumList2`、切歌立即出现新的 scrobble 条目，并继续定位服务端 12 秒无响应；macOS Intel/arm64 未验证。

### P12-MI-023 脱敏缓冲事件与固定项目外链

- 用户要求：诊断中增加 `buffer-start` / `buffer-end` 及持续时间，不记录歌曲 ID、URL 或凭据；点击 Logo 区域通过系统浏览器打开 Sonavi GitHub。
- 实现：播放状态控制器只在有当前队列项且进入 `buffering` 时发送一次开始，退出缓冲、切歌或销毁时发送一次结束并计算单调时钟持续时间。跨 IPC 的数据只有 `{ event, durationMs }`；main 写入独立 `playback-buffer` 阶段，导出 schema 升级为 v3。
- 安全边界：Zod strict schema 限制事件枚举、开始时长必须为 0、结束时长为 0～3,600,000 ms 整数，任何 `trackId`、URL、会话或任意扩展字段都拒绝。Logo preload 方法无参数，main 使用固定 HTTPS 常量调用系统浏览器；renderer 仍不能发起任意外链或新窗口。
- 自动验证：Node.js 22.21.1 下定向 3 文件/19 项、lint、typecheck、全量 Vitest 29 文件/157 项、生产构建和 Windows 源码 Electron 完整冒烟通过；覆盖缓冲重复事件去重、切歌结束/重开、持续时间、上报失败不影响播放、身份字段拒绝，以及 Logo 按钮只调用无参数受限方法。E2E 进一步确认带 `trackId` 的 IPC 被拒绝，设置页显示 `buffer-end · 1234 ms`，Logo 控件具有明确可访问名称；构建只有既有 Zod PURE 注释位置警告。
- 当前状态：`RETEST`。Windows 真实网络缓冲和点击 Logo 后系统默认浏览器打开仍待人工复验；macOS Intel/arm64 未验证。
