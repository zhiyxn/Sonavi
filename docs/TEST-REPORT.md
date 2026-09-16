# P10 打包、兼容性与发布前审计报告

日期：2026-09-16
状态：`v0.1.0-rc.3` 已在 release run `35040657787` 三目标全通过并发布为 GitHub Pre-release；正式签名/公证和各平台完整实机发布验收未完成

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

版本提交 `cc33168` 的普通 CI run `35040182258` 与标签 `v0.1.0-rc.3` 的 release run `35040657787` 均在 Windows x64、macOS Intel x64 与 macOS Apple Silicon arm64 完整通过。发布 job 创建了非草稿、非 Latest 的 Pre-release，共七个附件：三个安装包、三个 manifest 与 `SHA256SUMS.txt`；校验清单为 610 字节且恰好包含六行，对应六个文件名。Release 地址为 `https://github.com/zhiyxn/Sonavi/releases/tag/v0.1.0-rc.3`。

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
