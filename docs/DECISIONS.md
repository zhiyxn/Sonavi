# 架构决策记录

## D001：Windows 与 macOS 从首版起同等支持

- 日期：2026-09-13
- 状态：已接受，覆盖旧约定

撤销所有“Windows 优先、macOS 后续适配”及相反方向的单平台优先约定。首版正式目标是 Windows 11 x64、macOS 13+ x64 与 macOS 13+ arm64。验证证据按平台分别记录，缺少环境时写“未验证”，不改变范围。

## D002：单仓库、单 renderer、最小平台适配

- 日期：2026-09-13
- 状态：已接受

共享客户端、认证、数据、播放、缓存、设置、页面与组件。实际操作系统差异集中到 `src/main/platform/` 和未来少量 main 系统服务中。禁止分别复制 Windows/Mac 页面，也不预建与真实需求无关的适配框架。

## D003：P01 使用原生窗口装饰

- 日期：2026-09-13
- 状态：已接受

BrowserWindow 使用 `frame: true` 与 `titleBarStyle: default`。设计图的 macOS 标题栏不进入共享 renderer，避免 Windows 假按钮和 macOS 双重控制。定制标题栏如有明确需求，须在后续阶段重新决策并双平台验证。

## D004：Electron 44.3.0 与 macOS 13 基线

- 日期：2026-09-13
- 状态：已接受

截至核验日，Electron 官方稳定版本页列出 44.3.0；Electron 44 官方说明 macOS 13 Ventura 或更高版本为最低运行要求。因此 P01 锁定 `electron@44.3.0`，与既定 macOS 13 基线一致。electron-vite 锁定 5.0.0，Node 锁定 22.19.0，满足其 Node 22.12+ 要求。升级 Electron 时必须重新核对三个目标架构、最低系统与 safeStorage 行为。

来源：

- https://releases.electronjs.org/release/v44.3.0
- https://www.electronjs.org/blog/electron-44-0
- https://electron-vite.org/guide/

## D005：P01 不实现后台播放承诺

- 日期：2026-09-13
- 状态：已接受

P01 当时采用 Windows 关闭即退出、macOS 关闭后可重建窗口的基础行为；该段生命周期决定已由 D017 的 P09 正式规则取代。P01 界面当时的 AudioEngine 仍是占位。

## D006：原始解压资料保持只读参考

- 日期：2026-09-13
- 状态：已接受

`Sonavi_UI_v0.1/` 和 `navidrome-vibe-coding-kit/` 保留原貌。它们包含历史单平台优先描述，不再是执行规范；根 `AGENTS.md` 与根 `docs/` 是当前唯一执行文档。这一选择既保存原始依据，也避免改写历史参考包。

## D007：公共 Subsonic token 认证与 main 网络边界

- 日期：2026-09-13
- 状态：已接受

P02 首选 Subsonic 1.13+ 的 token/salt 认证：每次请求生成至少 6 字符的随机 salt，并计算 UTF-8 `md5(password + salt)`。密码不作为 `p` 参数发送；连接 URL 不跟随重定向，避免认证参数被带到未确认目标。renderer 只能调用固定的连接测试 IPC，不能发起任意 URL 请求。响应同时检查 HTTP 层、内容类型、1 MiB 大小上限、JSON 结构与 `subsonic-response.status`。

来源：

- https://opensubsonic.netlify.app/docs/api-reference/
- https://opensubsonic.netlify.app/docs/endpoints/ping/
- https://opensubsonic.netlify.app/docs/endpoints/getopensubsonicextensions/
- https://opensubsonic.netlify.app/docs/endpoints/getmusicfolders/

## D008：safeStorage 不可用时仅会话使用

- 日期：2026-09-13
- 状态：已接受

CredentialStore 使用当前锁定 Electron 44.3.0 类型中存在的异步 `isAsyncEncryptionAvailable`、`encryptStringAsync` 与 `decryptStringAsync`。只有系统加密成功后才写入 userData；不可用、加密失败或文件写入失败均返回 `session-only`，绝不落盘明文。恢复时遵循 `shouldReEncrypt` 完成密钥轮换；显式“退出并忘记账号”才删除本机密文。safeStorage 密文与当前系统用户/密钥链绑定，不设计跨机器复制。未签名 macOS 开发包的加密往返只作为本机开发证据，不能替代签名后升级稳定性验证。

来源：https://www.electronjs.org/docs/latest/api/safe-storage

## D009：保留 shadcn-vue + Tailwind CSS 技术路线

- 日期：2026-09-13
- 状态：已接受

原始 `navidrome-vibe-coding-kit/PROMPTS.md` 已明确指定 `shadcn-vue + Tailwind CSS`。P03 核对当前官方文档后锁定 Tailwind CSS 4.3.3 与 `@tailwindcss/vite` 4.3.3，建立 `components.json`、`@` alias、`cn()` 和项目持有的 Button 组件源码。Sonavi UI 包与 `tokens.css` 仍是视觉事实来源，Tailwind theme 映射既有 tokens；不为采用组件工具而重写已完成的连接页。

来源：

- https://www.shadcn-vue.com/docs/installation/vite
- https://www.shadcn-vue.com/docs/components-json
- https://tailwindcss.com/docs/installation/using-vite

## D010：P03 使用不透明媒体 scheme 与流式响应

- 日期：2026-09-13
- 状态：已接受

renderer 不获得上游地址、用户名、salt 或 token，只获得绑定当前 main 会话的随机媒体句柄。`sonavi-media` scheme 在 ready 前注册，并由 default Session 的 `protocol.handle` 处理。main 使用 Electron Session、`redirect: manual` 和 `format=raw` 请求封面/音频，只转发安全响应头及 200/206/416，以保留背压的流返回；不缓冲整首歌曲，不跨 IPC 传 Base64，不通过 `bypassCSP` 放宽安全策略。新连接会轮换会话 ID；退出、忘记账号和真正退出会撤销旧媒体句柄并中止活动请求。

来源：https://www.electronjs.org/docs/latest/api/protocol

## D011：P04 以 queueEntryId 和 generation 隔离播放状态

- 日期：2026-09-14
- 状态：已接受

AudioEngine 使用单一枚举状态而非跨组件布尔组合，并以 generationId 隔离每次媒体来源。切歌会释放旧 HTMLAudioElement 的事件监听；play/pause 命令另有递增序号，迟到的旧 Promise 不能把当前曲目或加载中暂停改为错误。全局仍只有一个引擎和一个活动音频宿主，页面组件不创建 Audio。

队列唯一性以随机 `queueEntryId` 为准，服务端 `trackId` 只标识歌曲，所以重复歌曲可独立删除和重排。队列项携带当前 server/account/session 范围，不跨失效会话恢复媒体句柄。随机顺序在当前队列生命周期内稳定，上一首沿实际播放历史返回。自然 ended 遵循单曲循环；手动下一首忽略单曲循环。P04 当时未持久化队列；P09 的恢复设计见 D017。

## D012：P05 使用公共只读端点和可取消搜索

- 日期：2026-09-14
- 状态：已接受

首页使用 `getAlbumList2(type=newest)`，全部专辑使用可分页的 `getAlbumList2(type=alphabeticalByName)`；艺术家与详情使用 `getArtists` / `getArtist`，搜索使用 `search3`。这些端点同时属于 Subsonic/OpenSubsonic 公共协议，不依赖 Navidrome 私有 Web API。`getArtists` 的完整响应在 renderer 采用窗口化渲染，真实超大资料库仍需验证响应大小边界。

搜索在 renderer 防抖并由 TanStack Query 发出取消信号；renderer 只能通过随机 requestId 和固定 preload 方法取消 main 内对应请求。sessionId、requestId、查询长度和分页均由 main 校验，会话轮换时统一中止旧请求。P05 不实现收藏或歌单写操作。

来源：

- https://opensubsonic.netlify.app/docs/endpoints/getalbumlist2/
- https://opensubsonic.netlify.app/docs/endpoints/getartists/
- https://opensubsonic.netlify.app/docs/endpoints/getartist/
- https://opensubsonic.netlify.app/docs/endpoints/search3/

## D013：P06 写入后重新读取服务器事实

- 日期：2026-09-14
- 状态：已接受

收藏使用公共 `getStarred2` / `star` / `unstar`，歌单使用 `getPlaylists` / `getPlaylist` / `createPlaylist` / `updatePlaylist` / `deletePlaylist`，不调用 Navidrome 私有 Web API。renderer 只通过固定、类型化 preload 方法提交当前会话及受限业务参数；main 校验发送者、会话和参数后才用其持有的凭据调用协议端点。

部分旧协议服务器的写端点（尤其 `createPlaylist`）成功时可以不返回实体，因此客户端不依赖 mutation 响应构造本地对象，也不乐观伪造成功。写入成功后仅失效当前会话相关查询并重新读取服务器事实；权限、会话或服务器失败保留已有数据。歌单添加参数保留顺序和重复歌曲，删除按协议的零基 `songIndexToRemove` 精确定位重复项。

来源：

- https://opensubsonic.netlify.app/docs/endpoints/getstarred2/
- https://opensubsonic.netlify.app/docs/endpoints/star/
- https://opensubsonic.netlify.app/docs/endpoints/unstar/
- https://opensubsonic.netlify.app/docs/endpoints/getplaylists/
- https://opensubsonic.netlify.app/docs/endpoints/getplaylist/
- https://opensubsonic.netlify.app/docs/endpoints/createplaylist/
- https://opensubsonic.netlify.app/docs/endpoints/updateplaylist/
- https://opensubsonic.netlify.app/docs/endpoints/deleteplaylist/

## D014：用户指定图片作为统一品牌源

- 日期：2026-09-14
- 状态：已接受

用户提供的 1254×1254 不透明 PNG 直接作为 Sonavi 当前标志，不做生成式改绘。仓库保留 `build/icon.png` 作为打包品牌源，并保留内容相同的 renderer 资源用于侧栏品牌位和页面图标；两份文件以 SHA-256 校验确认与用户源图一致。

Windows 与 macOS 继续使用同一源图，分别由 electron-builder 的现有平台构建流程转换为所需应用图标格式，不建立平台专属品牌设计。此变更只接入品牌资源，不代表已完成 P10 的安装器、签名、公证或发布验收。

## D015：P07 按能力选择歌词端点，并以真实播放累计时间上报

- 日期：2026-09-14
- 状态：已接受

结构化歌词只在连接阶段探测到 `songLyrics` 扩展时通过 `getLyricsBySongId` 获取，否则使用兼容性更广的 `getLyrics`；端点选择和凭据都留在 main。首轮只实现扩展 v1 的整行时间戳，不请求 v2 `enhanced=true`，以免在当前阶段引入逐词 cue、翻译和发音层的额外产品语义。

`scrobble(submission=false)` 只在队列项实际进入 `playing` 后发送。完成上报不直接信任进度条位置，而累计相邻的真实正向播放进度；seek 跳跃不计时。阈值固定为曲长 50% 与 240 秒中的较小者，同一 `queueEntryId` 最多发送一次 now-playing 和一次 submission，避免 timeupdate、组件重绘及重复曲目 ID 造成重复上报。上报失败不打断播放，P07 不实现离线补发。

来源：

- https://opensubsonic.netlify.app/docs/endpoints/getlyricsbysongid/
- https://opensubsonic.netlify.app/docs/endpoints/getlyrics/
- https://opensubsonic.netlify.app/docs/endpoints/scrobble/

## D016：P08 使用单一 Electron Session、显式播放策略与能力约束转码 seek

- 日期：2026-09-14
- 状态：已接受

API、封面与音频统一使用 `session.defaultSession`，代理配置只有 system、direct、fixed_servers 三种互斥状态。代理切换执行 `setProxy` 后调用 `closeAllConnections`，并撤销现有媒体句柄、停止当前播放；代理应用失败即失败，不静默改为直连。手动代理首版不接受 URL 内嵌凭据，避免代理密码进入 renderer、日志或设置文件。

播放策略分为原始、MP3 兼容转码和自动。码率仅允许 128/192/256/320 kbps。自动策略不是无限格式探测器：已知 Chromium 媒体类型先使用原始流并最多回退一次 MP3，未知类型直接转码。实际策略和原因随 TrackSummary 返回，避免界面把所有格式写成“兼容”。

音乐转码 seek 只在服务器连接探测已返回 `transcodeOffset` 扩展时开放。每次 seek 由 main 生成新的 `stream(timeOffset)` 不透明句柄；AudioEngine 用偏移加片段进度维持完整歌曲时间线，歌词和 scrobble 不读取片段局部时间。未声明能力时禁用，而不是发送猜测参数。

诊断日志采用 main 内存环形结构，只保留阶段、状态、内容类型、分类、耗时和建议，最多 200 条且导出不超过 256 KiB。URL、账号、认证参数、代理地址、资源 ID 和响应正文不记录。TLS 和证书验证保持 Electron 默认安全行为。

来源：

- https://opensubsonic.netlify.app/docs/endpoints/stream/
- https://opensubsonic.netlify.app/docs/extensions/
- https://www.electronjs.org/docs/latest/api/session
- https://www.electronjs.org/docs/latest/api/structures/proxy-config

## D017：P09 隐藏同一播放宿主、Media Session 与账号隔离缓存

- 日期：2026-09-14
- 状态：已接受；取代 P01 的关闭窗口生命周期规则

Windows 与 macOS 默认关闭动作统一为隐藏既有 BrowserWindow，不销毁承载唯一 AudioEngine 的 renderer。用户可将关闭动作改为 `quit`；托盘/菜单栏提供独立“真正退出”，macOS Cmd+Q 和应用退出菜单同样调用 `app.quit()`。最小化保留原生行为。Windows 从托盘、macOS 从菜单栏或 Dock 显示同一窗口，不复制 UI，也不在组件散布平台判断。

媒体键与系统媒体信息只使用 Chromium Media Session，不注册 Electron `globalShortcut` 的媒体键，避免双重触发。应用内部只绑定无修饰键 Space，并排除输入框、文本区、选择框、按钮、链接、contenteditable 和 textbox。睡眠/锁屏只暂停；恢复/解锁清理旧连接和媒体句柄、刷新数据并保持暂停，不绕过用户意图自动续播。

`DesktopStateService` 只在 `userData` 保存主题、音量、关闭动作、窗口状态和暂停队列的纯元数据。队列文件不含 sessionId、密码、认证 URL 或媒体句柄，以 main 从规范服务地址和用户名生成的 SHA-256 账号哈希隔离；恢复必须先有当前有效连接并重新生成媒体句柄。忘记账号会删除队列与该账号封面缓存。

封面缓存位于账号哈希目录，资源 ID 也只作哈希文件名；单项 5 MiB、单账号 128 MiB并按最近访问时间淘汰。只有图片、HTTP 200、无 Range、Content-Length 已知且在上限内才可缓冲。音频不进入缓存并继续流式传输，因此该能力不构成离线下载。

来源：

- https://www.electronjs.org/docs/latest/api/tray
- https://www.electronjs.org/docs/latest/api/browser-window
- https://www.electronjs.org/docs/latest/api/power-monitor
- https://developer.chrome.com/docs/media-and-audio/media-session

## D018：P10 只在原生目标验证包，并把签名状态作为显式证据

- 日期：2026-09-15
- 状态：已接受

Windows x64、macOS x64 和 macOS arm64 继续由同一 electron-builder 配置生成，但每个候选必须在对应系统运行 `verify:package` 与打包应用 Electron 冒烟。验证器记录安装包 SHA-256、单一目标架构、应用标识、版本、核心资源与签名状态；CI 不上传包，跨主机生成文件也不等同于实机安装兼容。

main 的唯一外部运行时依赖 Zod 在 electron-vite 中内联，electron-builder 排除全部 `node_modules`，避免把约 55 MiB 构建期依赖和 source map 带进 ASAR。ASAR 设 16 MiB 发布前上限作为回归门槛。macOS 删除 Electron 模板中 Sonavi 未使用的相机、麦克风、蓝牙与音频采集说明；Developer ID 候选只预置 JIT/可执行内存 entitlements，不为当前能力添加 `disable-library-validation`。

签名、公证凭据只由本机密钥链或受保护 CI secret 提供。无凭据时产物必须标记为 unsigned/ad-hoc 开发测试包；正式候选使用 `SONAVI_REQUIRE_SIGNING=1` 使验证器拒绝非发行签名文件，并另行验证 macOS 公证 ticket。不会要求用户关闭 Gatekeeper、SmartScreen、TLS 或 Electron 安全开关。

来源：

- https://www.electronjs.org/docs/latest/tutorial/code-signing
- https://www.electron.build/v26/docs/mac/
- https://www.electron.build/docs/features/code-signing/code-signing-win/
- https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution

## D019：区分无证书包、linker ad-hoc seal 与正式发行签名

- 日期：2026-09-15
- 状态：已接受

Apple Silicon Electron 主可执行文件即使 electron-builder 明确跳过应用签名，也可能携带 linker 生成的 ad-hoc seal。它没有签名身份、不封装应用资源，不能按完整已签名 bundle 执行资源封印校验，更不能声明为 Developer ID 签名。验证器只对该 seal 校验代码页并记录 `ad-hoc`；ASAR、图标、Info.plist、DMG 与 SHA-256 继续由独立检查覆盖。`SONAVI_REQUIRE_SIGNING=1` 同时拒绝 `unsigned`、`ad-hoc` 与非 Developer ID 身份。

Windows 无证书开发包先从 PE Optional Header 的 Certificate Table 判断是否存在 Authenticode 数据。不存在时直接记录 `unsigned`，不依赖 PowerShell 模块；存在时才在 Windows 目标机调用 `Get-AuthenticodeSignature` 校验证书状态和发布者。目标路径通过子进程环境变量传入，不拼接到 PowerShell 命令文本。

来源：

- https://developer.apple.com/documentation/security/seccodesignatureflags/adhoc
- https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/get-authenticodesignature

## D020：暂停队列保存必须可串行等待并在断开前 flush

- 日期：2026-09-15
- 状态：已接受

暂停队列仍只保存非敏感曲目元数据、当前位置和播放模式，不保存 sessionId、凭据或媒体 URL。renderer 的变更保存继续使用短防抖，但由单一串行协调器持有最新快照，避免旧写入覆盖新写入；断开连接前必须取消待触发 timer、提交最新队列并等待受限 IPC 返回。

真正退出由 main 发出固定的 `prepare-to-quit` 业务命令，renderer 完成同一 flush 后通过固定、校验 sender 的 IPC 确认，main 才继续退出；renderer 无响应时使用 5 秒超时兜底，避免应用无法退出。资源释放移到 `will-quit`，不得在可被取消的 `before-quit` 阶段提前销毁媒体和桌面集成状态。

Electron 冒烟不以固定睡眠推断落盘完成。测试在关闭隔离测试进程前读取该测试专属 `userData` 的 `desktop-state.v1.json`，只确认非敏感暂停队列的当前曲目已经持久化；真实音频流请求同样等待 fixture 实际收到 `/stream.view`，而不是用 UI 已进入 playing 代替网络事实。

## D021：候选下载只由标签驱动的完整原生闸门创建

- 日期：2026-09-15
- 状态：已接受

普通 push/PR CI 保持 `contents: read` 且不上传安装包。只有用户明确授权并推送与 `package.json` 完全一致的 `v*-rc.*` 标签时，独立发布工作流才在 Windows x64、macOS Intel x64 与 macOS arm64 原生 runner 重新执行依赖审计、lint、typecheck、测试、源码 Electron 冒烟、目标包构建、包验证和打包应用冒烟。任一目标失败都不会进入发布 job。

发布 job 使用局部 `contents: write` 权限，只从各目标临时 artifact 中提取三个安装包和三份验证 manifest，重新计算统一 `SHA256SUMS.txt`，创建或修复同标签 GitHub Pre-release。未签名 Windows、未签名 Intel macOS 与 ad-hoc Apple Silicon 包的说明固定进入 Release notes；不得标为 Latest 或正式稳定版，也不得引导用户关闭 SmartScreen、Gatekeeper、TLS 或其他安全保护。普通 electron-builder 命令继续使用 `--publish never`，仓库不保存发布凭据。

来源：

- https://docs.github.com/en/actions/concepts/security/github_token
- https://cli.github.com/manual/gh_release_create
- https://github.com/actions/upload-artifact/releases

## D022：媒体句柄使用会话密钥加密的无状态 token

- 日期：2026-09-16
- 状态：已接受；取代固定容量 FIFO 句柄表

renderer 继续只接收 `sonavi-media://media/<opaque-token>`，但 token 不再引用 main 中的全局 2,000 项 Map。main 使用进程内随机 AES-256-GCM 密钥加密媒体类型、会话、资源 ID、流策略和会话 epoch；URL 不暴露资源 ID、服务地址或认证参数。这样大库浏览、封面加载和大队列不会淘汰仍待播放的音频句柄，也不会让内存随每个资源句柄持续增长。

每个会话维护小型 epoch 与签发计数。断开、忘记账号、代理切换或生命周期清理时递增 epoch，使该会话此前签发的全部 token 立即失效；全局清理则轮换进程密钥。解密、认证标签、URL 结构、字段类型、会话存在性任一校验失败都拒绝请求。句柄只在当前进程有效，重启队列仍必须由 main 重新生成。

OpenSubsonic JSON 默认响应上限仍为 1 MiB；只有必须一次返回完整索引的 `getArtists` 使用独立 16 MiB 上限。该调整保持明确的内存边界，不把真实大型资料库问题扩散为所有端点的无限响应读取。

## D023：renderer 错误提醒使用 Sonner（危险确认部分已取代）

- 日期：2026-09-17
- 状态：错误通知部分保留；危险操作确认部分由 D025 取代

应用根节点只挂载一个项目持有的 shadcn-vue Sonner `Toaster`，并加载 `vue-sonner` 官方样式。瞬时错误由统一工具调用 `toast.error`，使用稳定 ID 合并同一错误；会阻断当前页面的查询失败仍保留带重试按钮的状态卡，toast 不作为唯一恢复路径。

最初以无限时长的 Sonner warning toast 承担删除歌单和退出并忘记账号的二次确认；P12-MI-019 复核基础组件职责后，确认流程改由 D025 的 AlertDialog 承担。Sonner 继续只负责非阻断通知。

来源：

- https://www.shadcn-vue.com/docs/components/sonner
- https://vue-sonner.vercel.app/

## D024：数据页使用会话缓存并由用户明确刷新当前视图

- 日期：2026-09-17
- 状态：已接受

首页、专辑、艺术家、搜索、收藏和歌单在应用外壳中保留已访问组件实例；设置页不进入该缓存。对应 TanStack Query 成功数据在当前连接会话内保持新鲜，禁用组件挂载和窗口聚焦自动重取，避免栏目切换造成重复的 OpenSubsonic 请求。搜索输入与结果、歌单当前详情等局部页面状态随实例保留。

每个数据页提供明确刷新按钮，但只调用当前列表、当前分页或当前详情的 `refetch`，不清除其他页面缓存。服务器写操作成功后仍按资源键失效并读取服务器事实；网络设置变化清除查询并轮换页面缓存，恢复/解锁、断开和忘记账号继续使用既有全局清理边界。该策略降低无意义请求，但不将服务端数据持久化到磁盘，也不跨连接会话共享。

## D025：基础交互组件优先使用项目持有的 shadcn-vue 源码

- 日期：2026-09-18
- 状态：已接受；取代 D023 中由 Sonner 承担危险确认的部分

renderer 的通用输入、复选、标签、选择、滑块和危险确认分别使用项目持有的 shadcn-vue Input、Checkbox、Label、Select、Slider 与 AlertDialog 源码。组件通过官方 CLI 引入，再按 Sonavi tokens、`@lucide/vue`、中文界面和 `exactOptionalPropertyTypes` 规则适配；依赖继续精确锁定，不因 CLI 自动改写而放宽版本范围。Sonner 只用于错误等非阻断通知，危险操作必须使用具有模态焦点管理和明确确认/取消语义的 AlertDialog。

业务导航、专辑/艺术家/歌单实体卡片、队列曲目和虚拟列表行仍可保留语义化原生按钮，因为这些是业务组合而不是通用控件重复实现。Slider 向 AudioEngine 提交前统一归一化浮点步进值，避免转码 `timeOffset` 因二进制小数尾差变成不稳定参数。该决定只统一 renderer 交互层，不改变 main IPC、安全边界或服务器写入条件。

## D026：封面上游有界并发与列表查询可归因诊断

- 日期：2026-09-18
- 状态：已接受

renderer 的列表图片使用浏览器原生懒加载，只在可视区域附近解析受限 `sonavi-media` URL；main 媒体协议再对所有缓存未命中的封面上游读取设置全局 6 并发上限。并发槽位覆盖完整响应读取，在成功、错误、消费者取消、会话撤销和服务释放时幂等归还。音频流不进入该队列，缓存命中也不占用上游槽位。

`getAlbumList2` 每个查询运行最多自动重试一次；未知写操作（特别是 scrobble）继续不自动重试，避免服务端已经执行但响应丢失时重复计数。手动重试由用户明确触发并重置尝试序号。

网络诊断导出最初升级为 schema v2，后由 D027 的缓冲事件扩展为 v3。列表请求只允许记录由 main 构造并再次过滤的 `listType`、页码、页大小和尝试序号；不得接受或写入 URL、账号、资源 ID、查询文本、凭据、token、Cookie、Authorization 或响应正文。该上下文用于区分 `newest` 与 `alphabeticalByName` 及自动重试，不扩大 renderer 权限。

## D027：播放缓冲只通过严格、无身份字段的诊断通道记录

- 日期：2026-09-18
- 状态：已接受

HTMLAudioElement 的 `waiting` 与 `stalled` 仍由 AudioEngine 统一转换为 `buffering`。独立 renderer 控制器对状态边沿去重：首次进入记录 `buffer-start`，离开缓冲、切换队列项或作用域销毁时记录 `buffer-end` 与单调时钟持续时间。诊断导出 schema 升级为 v3，并增加 `playback-buffer` 阶段；缓冲事件不伪装成音频 HTTP 请求，也不改变播放状态。

renderer→main 只允许严格的 `{ event, durationMs }`，事件限于 `buffer-start` / `buffer-end`，开始持续时间固定为 0，结束持续时间限制在一小时内。schema 拒绝所有未知字段，因此 queueEntryId、trackId、sessionId、URL、账号、凭据和任意文本不能进入该通道。上报失败被吞并为非阻断诊断缺失，不得影响 AudioEngine。

Logo 外链采用同一最小权限原则：preload 只暴露无参数 `openProjectHomepage()`；main 内固定目标为 `https://github.com/zhiyxn/Sonavi` 并调用系统 `shell.openExternal`。不得让 renderer 传入 URL，也不放宽现有新窗口与导航拒绝策略。

## D028：大型艺术家索引与音频断流使用有界、可诊断的恢复策略

- 日期：2026-09-19
- 状态：已接受

真实 macOS schema v3 诊断显示，其他 API、封面和 scrobble 正常时，`getArtists` 仍可连续触发八次固定 12 秒超时；同一日志还记录了一次持续 102 秒后以 `net::ERR_HTTP2_PROTOCOL_ERROR` 中断的 MP3 转码流，以及导出时尚未结束的缓冲区间。该证据不支持全局放宽 API 超时或关闭 TLS/HTTP2。

`getArtists` 单独使用一次 45 秒有界请求，renderer 禁止该查询的 TanStack 自动重试，只保留用户明确刷新。其他 API 继续使用 12 秒超时，艺术家响应仍受 16 MiB 上限保护。这样不会以四个连续全量索引请求加重慢服务器负载。

AudioEngine 对连续 `buffering` 设置 30 秒看门狗；超时后释放旧 HTMLAudioElement 与上游请求并进入带原因的错误态。player 只对 `stream` 或 `buffer-timeout`、且能保持时间线的 `native` / `transcode-offset` 队列项自动恢复一次；播放启动失败不自动重试，无法安全保持位置的转码流也不擅自从头播放。第二次失败保留显式“重试播放”，避免无限循环。

API 诊断升级为 schema v4。若请求已收到响应头但正文读取超时，记录 HTTP 状态、内容类型、响应头耗时和已读取字节数；这些字段只包含受限枚举或数字，不记录 URL、响应正文、资源 ID、账号、凭据、Cookie、Authorization 或 token。
