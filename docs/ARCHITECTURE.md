# Sonavi 架构

更新日期：2026-09-20

## 单工程与共享边界

```text
共享 Vue renderer
  连接 / 音乐库 / 搜索 / 收藏 / 歌单 / 歌词 / 设置
  Pinia + TanStack Vue Query + 单一 AudioEngine
                    │
                    │ 受限、类型化 preload API
                    ▼
共享 Electron main ────────────────┐
  认证 / 协议客户端 / 网络 / 存储  │
  媒体协议 / 缓存 / 诊断           │
                    │              │
                    ▼              ▼
       src/main/platform/      Electron / OS
       窗口、菜单、快捷键、
       托盘/Dock、路径和生命周期
```

不创建 Windows/Mac 两套前端，不复制页面。只有当 Electron 或操作系统行为确实不同，适配代码才进入 `src/main/platform/`；共同行为留在共享 main、preload 或 renderer 层。

## 当前目录职责

- `src/main/`：窗口、安全策略、IPC 注册、OpenSubsonic 网络客户端与 CredentialStore；允许使用 Node.js/Electron。
- `src/main/platform/`：最小平台差异。包含原生窗口选项/菜单，以及 P09 的托盘、关闭隐藏、Dock/应用重激活、电源事件和真正退出生命周期。
- `src/preload/`：唯一 renderer 桥；暴露类型明确的应用信息、连接/恢复/退出、固定音乐库、播放辅助、网络与桌面状态方法，不暴露原始 IPC、任意网络或 Node 对象。
- `src/shared/`：IPC channel、TypeScript 类型与 Zod 运行时 schema。
- `src/renderer/`：一套 Vue + Tailwind CSS 应用，shadcn-vue 组件源码与 Sonavi tokens 共用；平台展示数据来自 preload，不读取 `process`。
- `src/renderer/src/services/audio-engine/`：P04 的 AudioEngine 契约与唯一 HTMLAudioElement 宿主；切歌时释放旧宿主监听并以 generation/命令序号隔离迟到事件与 Promise。
- `src/renderer/src/stores/player.ts`：P04 队列与播放策略的唯一客户端状态源；组件不独立推测播放状态。
- `tests/`：平台策略、契约、共享 UI 与真实 Electron 冒烟。
- `scripts/`：P10 跨平台 Node 发布前工具；解析本地产物、生成验证/发布校验清单、校验候选标签、收集明确允许的 Release 文件或启动打包应用冒烟，不持有签名凭据。只有标签驱动的 GitHub 发布 job 负责上传。

## P10 打包边界

electron-vite 将 main、sandbox preload 与 renderer 分别构建到 `out/`。main 的 Zod 运行时 schema 被内联，因此 electron-builder 的 ASAR 只包含 `out/` 与最小 `package.json`，不携带构建期 `node_modules`、测试或源码。`extraResources` 只加入共享品牌图标。包验证器在目标系统读取应用可执行文件与系统元数据：Windows 检查 PE x64 和 Authenticode，macOS 检查单架构 Mach-O、Info.plist、DMG 与 codesign；两端共同检查应用资源、版本、包大小和 SHA-256。

macOS Developer ID 签名使用 `build/entitlements.mac*.plist` 的最小 JIT/可执行内存能力；不声明相机、麦克风、蓝牙或音频采集，也不加入 `disable-library-validation`。无 Developer ID 时，Intel 可执行文件记录 `unsigned`，Apple Silicon Mach-O 自带的 linker ad-hoc seal 记录 `ad-hoc`；两者都不能通过 `SONAVI_REQUIRE_SIGNING=1`。只有 Developer ID 候选执行完整 bundle 严格校验并进入后续公证，仓库不保存秘密。Windows 先解析 PE Certificate Table，无表时直接记录 `unsigned`，存在签名数据时才由目标系统验证 Authenticode。`publish: null` 与所有构建命令的 `--publish never` 保证普通构建和验证不会创建 Release；只有匹配 `v*-rc.*`、通过版本校验和三个原生目标完整闸门的 `.github/workflows/release.yml` 可使用最小 `contents: write` 权限创建 Pre-release。

## 安全模型

BrowserWindow 固定 `contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`、`webSecurity=true`、`webviewTag=false`、`allowRunningInsecureContent=false`、`navigateOnDragDrop=false` 并使用原生 frame。CSP 以 `default-src 'none'` 默认拒绝，仅逐项开放本地脚本/样式、媒体 scheme 与开发 localhost WebSocket，并拒绝 frame ancestor。main 默认拒绝权限请求、窗口打开和应用外导航。

应用信息、连接、音乐库与播放辅助 IPC 同时执行：主 frame/所属 BrowserWindow 检查、开发 origin 或打包后精确文件路径检查、输入/返回数据 Zod 校验。renderer 再校验返回值。连接 IPC 只接受服务器地址、用户名、一次性密码和两个布尔选项；音乐库 IPC 只接受不透明会话 ID、受限资源 ID、分页参数及 P06 明确列出的收藏/歌单变更；P07 歌词/上报只接受当前会话、曲目 ID、纯文本歌曲元数据、布尔 submission 和安全整数时间，不提供任意 URL 请求能力。Logo 外链 IPC 不接受 URL，只允许 main 以固定常量打开 Sonavi GitHub 仓库；缓冲诊断 IPC 只接受严格对象中的事件枚举和受限毫秒时长，多余字段直接拒绝。

P02 的连接客户端位于 `src/main/services/opensubsonic/`，使用 Electron Session 的 Chromium 网络栈并禁止自动重定向。JSON 默认响应上限为 1 MiB；必须一次返回完整索引的 `getArtists` 单独使用 16 MiB 有界上限，其他端点不随之放宽。认证按每次请求独立 salt 生成 token，明文密码不进入 URL、日志、renderer store 或持久化文件。`ping` 成功后探测 OpenSubsonic 扩展与音乐文件夹；旧服务器缺少扩展端点时可降级，认证和音乐库权限失败不能伪装成功。

统一 `CredentialStore` 位于 `src/main/services/credentials/`，只在 app ready 后调用 Electron 44 的异步 safeStorage。持久化文件放在 `app.getPath('userData')`，通过同目录临时密文文件替换保存；密码字段只写入系统加密密文。加密或写入失败时保留 main 进程会话凭据并明确返回 `session-only`，不回退明文。启动时可解密恢复，safeStorage 请求密钥轮换时先重加密；“退出并忘记账号”显式删除持久化文件。

P03 的 `MediaHandleRegistry` 只向 renderer 返回不透明的 `sonavi-media://media/<token>`。token 由进程内随机 AES-256-GCM 密钥认证加密，携带媒体类型、会话、资源 ID、原始/转码策略、码率、可选时间偏移和会话 epoch；renderer 仍看不到上游地址或认证参数。音频句柄继续无状态，不会因大库浏览淘汰队列句柄；封面为减少同一资源在多个列表中的重复浏览器请求，按会话最多复用 10,000 个 token，超过上限只淘汰复用索引而不使已签发 token 失效。断开、忘记账号、代理切换与退出清空复用索引，并通过递增 epoch 或轮换密钥使旧 token 整体失效。自定义 scheme 在 app ready 前注册为 standard/secure/fetch/stream，但不启用 bypassCSP；处理器在 default Session 上注册。main 根据当前会话解析句柄并重新生成认证 URL，拒绝超长/篡改 token、重定向、非法/多段 Range、非媒体内容类型与非 200/206/416 响应。音频响应体始终以保留背压的 Web Stream 传递，不调用 `arrayBuffer()`、不做 Base64 IPC；P09 只有带已知 Content-Length 且不超过 5 MiB 的图片响应可被有界缓冲并写入封面缓存。

## P04 播放核心

AudioEngine 快照只有一个枚举状态：`idle/loading/playing/paused/buffering/seeking/ended/error`，同时携带 generation、曲目、进度、时长、音量与错误。只有 `HtmlAudioEngine` 创建 HTMLAudioElement；切换来源时先移除旧监听、停止并释放旧元素，再创建当前 generation 的唯一活动元素。每次来源切换递增 generation，每次 play/pause 递增命令序号，旧元素事件和迟到的 `play()` 拒绝不会覆盖新曲目或用户的加载中暂停操作。

Pinia player store 管理队列。每个条目使用随机 `queueEntryId`，将服务端 `trackId`、不透明媒体句柄和当前 `serverId/accountId/sessionId` 范围绑定在一起；重复 track 可以形成不同队列项。顺序与随机都以 queueEntryId 导航，随机模式在队列不变时保留稳定顺序，并以实际播放历史实现上一首。自然 ended 在单曲循环下重播当前项；手动下一首忽略单曲循环并选择后继。删除当前项优先选择其播放顺序中的后继、否则前项，并保留播放/暂停意图；空队列停止引擎并回到 idle。音频 error 会显示显式重试：原始流按当前进度重建，具备 `transcodeOffset` 的转码流从当前时间换取新句柄；该动作不等同于自动断网恢复。

P09 将非敏感队列元数据保存到 main 的 `desktop-state.v1.json`，不保存 sessionId、密码、认证参数或 `sonavi-media` URL。main 以服务地址和用户名计算账号哈希并校验当前连接；恢复时由 `LibraryService` 重新生成短期媒体句柄，renderer 以暂停状态和曲目起点重建队列。P04 的运行时队列和 AudioEngine 仍只有一份。

## P05 音乐库与搜索

首页与全部专辑共用 `LibraryPanel.vue`，仅以受限的 `AlbumListType` 区分 `newest` 和 `alphabeticalByName`；查询 key 包含 session、类型与页码，每页请求 30 张。renderer 使用项目持有的 shadcn-vue Pagination 源码显示页码、上一页和下一页；由于公共响应只有 `hasMore` 而没有总数，控件只公布已知页和下一可用页，不猜测远端总量。首页与专辑页分别在应用外壳保存当前页。艺术家列表使用 `getArtists` 的协议索引，但 renderer 只挂载固定行高可见窗口和 overscan；艺术家详情通过 `getArtist` 复用同一专辑卡片语义。首页、全部专辑、艺术家详情、搜索和收藏直接显示共享 `AlbumSummary.songCount`，该值沿用既有 main 解析与共享 schema 校验，不增加 renderer 侧请求或协议旁路。

搜索只调用公共 `search3`。请求结构分别携带受限的 `albumOffset` 与 `trackOffset`，main 映射为协议的 `albumOffset` / `songOffset`；艺术家固定使用 offset 0，三类 count 均最多 25。`SearchPanel` 的查询 key 包含 session、已提交关键词、专辑页和歌曲页；两个 shadcn-vue Pagination 分别依据 `albumHasMore` / `trackHasMore` 只公布已知页和下一可用页，翻页替换对应当前页而不在 DOM 中累积历史页。结果按艺术家、专辑、歌曲上下排列。输入与已提交关键词分离，只有按 Enter 或点击搜索按钮才更新查询；TanStack Query 为每个查询提供 AbortSignal，并对搜索与收藏读取明确设置 `retry: false`，避免一次 12 秒超时被默认放大为四次请求。renderer 生成随机 requestId，通过固定 `cancel-search` preload 方法请求 main 中止对应 AbortController。main 同时校验 sessionId/requestId 和两个偏移量，断开或轮换账号时取消该会话的全部活动搜索。搜索结果只返回纯文本元数据及随机媒体句柄，不允许 renderer 访问任意 URL。

完整艺术家索引仍使用公共 `getArtists` 和独立 16 MiB 上限，但真实大库按端点使用一次 45 秒有界超时；renderer 关闭该查询的自动重试，仅由用户明确刷新。其他 API 保持 12 秒超时，避免慢艺术家端点扩大所有请求的等待边界。

首页、专辑、艺术家、搜索、收藏与歌单组件由 `KeepAlive` 保留已访问实例，避免栏目切换重建搜索条件、歌单详情和查询观察器；设置页不缓存。服务器读取按 session 与资源键在当前连接会话内保持新鲜，禁用挂载和窗口聚焦自动重取，各页的刷新按钮直接 `refetch` 当前列表、当前分页或当前详情，不清空全局缓存。收藏/歌单写入仍按资源失效并重读服务器事实；代理变更、恢复/解锁、断开和忘记账号继续清除查询缓存，其中网络设置变更同时轮换页面缓存实例，确保不会复用旧网络上下文。

设置页在同一共享组件中呈现平台、服务器、协议、播放/网络策略、关闭动作、主题、当前账号封面缓存与安全退出；平台行为由 preload/main 适配，不在 Vue 组件读取 `process`。

renderer 根节点只挂载一个项目持有的 shadcn-vue Sonner `Toaster`。连接、设置、收藏/歌单 mutation、查询、播放和上报错误通过统一通知工具调用 `toast.error`，稳定 ID 避免同一错误重复堆叠；阻断当前页面的加载错误仍保留带重试按钮的状态卡。删除歌单与退出并忘记账号不再调用原生 `window.confirm`，而使用项目持有的 shadcn-vue AlertDialog；取消或关闭不执行操作，确认后才进入既有受限 IPC/服务调用，组件同时阻止重复确认。Input、Checkbox、Label、Select 与 Slider 同样由官方 shadcn-vue 源码引入并按 Sonavi tokens 和严格 TypeScript 规则适配；业务导航、实体卡片和虚拟列表继续保留语义化按钮。

## P06 收藏与歌单

收藏与歌单继续使用同一个 OpenSubsonic 客户端、LibraryService 和受限 preload。`getStarred2`、`star`、`unstar` 负责艺术家、专辑和歌曲收藏；成功写入后 TanStack Query 只失效当前 session 的收藏、音乐库、详情和搜索查询，失败则保留已有数据，不在客户端乐观伪造服务端状态。

歌单读取使用 `getPlaylists` / `getPlaylist`，写入使用 `createPlaylist` / `updatePlaylist` / `deletePlaylist`。协议重复参数由 URL 构造器按原顺序追加；创建/追加保留队列重复项，删除歌曲传递服务端歌单中的零基索引，从而能精确删除某一个重复项。旧服务器在创建或其他写操作成功时可以只返回空成功响应，因此 mutation 只返回受校验的 `{ changed: true }`，随后通过固定读取端点刷新服务器事实。

凭据仍只存在于 main；renderer 不能选择端点或参数名，只能提交受限 sessionId、资源 ID、名称、公开布尔值、歌曲 ID 数组和非负索引。P06 不持久化收藏/歌单副本，也不引入平台分叉、原生依赖、歌词、scrobble 或后台播放宿主。

## P07 歌词与播放上报

连接成功后，`ConnectionService` 在 main 内同时保存凭据和经过协议校验的服务器能力副本。`PlaybackService` 只在能力列表声明 `songLyrics` 时调用 `getLyricsBySongId`；否则调用兼容的 `getLyrics`。结构化响应保留多个歌词版本、语言、offset、同步标记和毫秒行时间；`xxx`/`und` 作为未指定语言处理。未请求 songLyrics v2 的 enhanced cue/翻译能力，旧版歌词按换行映射为非同步行。

`LyricsPanel.vue` 通过 TanStack Query 按 session + track 缓存歌词，直接读取唯一 player store 的 AudioEngine 进度；活动行判断使用 `startMs + offsetMs <= currentTimeMs`。浮层覆盖同步/非同步、多版本、加载、空、错误和重试状态，队列与歌词浮层互斥，避免窄窗口相互遮挡。

播放上报控制器不依赖播放器组件生命周期。队列项首次真正进入 `playing` 时发送 `scrobble(submission=false)` 并记录开始时间；仅累计相邻不超过 5 秒的正向播放进度，seek、倒退和大幅跳转不计入听取时长。累计达到 `min(duration × 50%, 240 秒)` 时发送一次 `submission=true`，两次上报使用同一播放开始时间，并按 `queueEntryId` 去重。失败只显示非阻断状态，不停止 AudioEngine。P07 不持久化上报队列，离线重试、后台宿主与队列恢复仍留待后续阶段。

## P08 转码、网络策略与诊断

`NetworkPolicyService` 是 main 中唯一播放/代理策略来源。播放策略生成每首曲目的实际 `streamMode`、`seekMode` 和用户可见原因：原始模式使用 `format=raw`；兼容模式固定使用 MP3 与受限码率；自动模式对已知媒体类型优先原始流并只附带一个兼容回退句柄，未知类型直接转码。HTMLAudioEngine 只在第一次解码错误切换 fallback，第二次失败进入错误态，避免无限重试。

播放器格式标签只复用已经通过 OpenSubsonic 响应 schema、共享 IPC schema 和 renderer 返回值校验的 `TrackSummary.contentType`。renderer 去除 MIME 参数后只映射受控音频类型；缺失、非音频或未知值统一显示“未知格式”，不会展示任意服务端文本，也不会解析不透明媒体 URL。标签将源格式与实际播放模式分开：原始流显示源格式，兼容转码明确显示源格式到 MP3 的关系；该展示不参与播放策略判断。

兼容转码只有在连接阶段验证的扩展名包含 `transcodeOffset` 时才允许 seek。renderer 通过固定方法提交 session、track 和秒数；main 复核会话与能力后生成带 `timeOffset` 的新不透明句柄。AudioEngine 保存 `timelineOffset`，对外进度始终为 `timelineOffset + segment.currentTime`，并保留歌曲总 duration；player store、歌词和播放上报因此共享完整歌曲时间线。未确认能力时 UI 禁用 seek 并解释，不猜测服务器行为。

API、封面和音频都使用 `session.defaultSession`，由 `NetworkPolicyService` 以 `system`、`direct` 或 `fixed_servers` 三种互斥配置统一控制。代理变更先调用 `setProxy`，再 `closeAllConnections`，随后撤销媒体句柄、停止播放和清查询缓存；任何失败都直接返回，不叠加系统/手动代理，也不降级直连。设置 JSON 位于 Electron `userData`，不含凭据。

`NetworkDiagnosticRecorder` 在 main 内维护最多 200 条结构化记录，阶段限定为 API、封面、原始音频、转码音频和播放缓冲。AudioEngine 的 `waiting` / `stalled` 状态经独立控制器收敛为一次 `buffer-start` 与一次 `buffer-end`；结束记录包含持续毫秒数，重复事件不产生重复开始。缓冲 IPC 不传 queueEntryId、trackId、URL、会话或任意文本。其余记录只含代理模式、HTTP 状态、内容类型、错误分类、耗时和建议；URL、账号、token/salt、代理地址、资源 ID 与响应正文从不进入记录。导出由 main 的保存对话框完成并限制在 256 KiB。证书错误只给出解释和建议，不关闭 TLS 校验。

schema v4 进一步区分响应头与正文阶段：正文中途超时时仍可保留状态码、内容类型、响应头耗时和已读字节数。schema v5 为封面增加 `queueMs` 与 `upstreamMs`，从总耗时中分别识别六并发调度等待与实际上游读取；字段仅为受限毫秒数，不含资源身份。已收到响应头后的 API 正文超时会返回专门的用户提示与诊断建议，不再误报为完全未收到服务器响应。AudioEngine 连续缓冲 30 秒会释放旧宿主；player 仅对可保持时间线的网络流错误或缓冲超时自动恢复一次，第二次失败回到显式手动重试。

列表中的 `DeferredCoverImage.vue` 只在元素进入视口外 240px 预加载区时才挂载真实 `<img>`；组件停用或卸载时断开观察并移除图片节点，使 Chromium 能取消尚未完成的等待请求。可见请求继续受 main 的全局六并发槽位和封面缓存约束；播放器及详情主封面不延迟，避免影响当前播放身份与详情首屏。

## P09 桌面宿主、状态与缓存

`DesktopIntegrationController` 保持一个强引用 BrowserWindow 和 Tray。默认关闭事件被拦截并隐藏既有窗口，因此 renderer 内唯一 AudioEngine 不会被销毁；设置为 `quit`、托盘“真正退出”或系统退出角色会进入 `app.quit()`，`before-quit` 再允许窗口关闭并释放媒体请求/句柄。托盘“重启 Sonavi”则直接复用控制器的幂等 `requestRestart()`，不经 renderer，不接受命令、路径或参数。最小化使用系统原生行为。macOS Dock/应用激活与托盘点击均显示并聚焦同一窗口；不存在 Windows/Mac 页面副本。

设置页重启使用独立的无参数 preload 方法。main 在校验可信发送者后让 `DesktopIntegrationController` 只安排一次 `app.relaunch()`，随后调用 `app.quit()` 进入同一 `before-quit` 路径：renderer 刷新暂停队列并回执，若 renderer 已异常则最长 5 秒后继续退出。新进程按既有加密凭据和暂停队列恢复规则启动。renderer 不能传入可执行文件、参数、路径或环境变量；若 main 自身完全无响应，该入口无法替代操作系统强制退出。

播放状态由 renderer 通过固定 IPC 同步给 main，仅用于更新托盘菜单；main 到 preload 的命令事件只接受固定枚举。系统媒体键与媒体信息使用 Chromium Media Session，项目不注册 `globalShortcut` 的媒体键，避免同一次按键被执行两次。设置按 preload 提供的平台修饰键匹配 `Ctrl+,` 或 `Cmd+,`，空格播放键与设置键都只在非编辑目标上生效。`powerMonitor` 的 suspend/lock 只发暂停，resume/unlock 会关闭旧连接、撤销媒体句柄并刷新队列句柄，但保持暂停。

`DesktopStateService` 在 Electron `userData` 下原子写入主题、音量、关闭动作、窗口 normal bounds/maximized 和暂停队列元数据。窗口恢复先按当前显示器工作区裁剪，避免拔掉显示器后窗口留在屏外。`CoverCacheService` 使用账号哈希目录和资源 ID 哈希文件名，单项 5 MiB、单账号 128 MiB，按文件访问时间执行 LRU；忘记账号和用户清理只删除当前账号目录。它不缓存音频，也不是离线播放层。

## 平台生命周期规则

| 行为 | Windows | macOS | P01 状态 |
| --- | --- | --- | --- |
| 窗口装饰 | 系统原生边框/按钮 | 系统原生边框/按钮 | 已实现 |
| 菜单 | 文件/编辑/窗口 | 应用/编辑/窗口 | 已实现基础模板 |
| 快捷键提示 | Ctrl | Cmd | 已通过 preload 集中提供 |
| 关闭窗口（默认） | 隐藏同一窗口到托盘 | 隐藏同一窗口到菜单栏/Dock | P09 已实现；Windows 待实机 |
| 重新激活 | 托盘点击显示既有窗口 | 菜单栏/Dock 激活显示既有窗口 | macOS Intel 已实测 |
| 最小化 | 保留 AudioEngine | 保留 AudioEngine | 共享原生行为；需分平台人工复验 |
| 托盘/菜单栏控制 | 播放/暂停/前后切歌/显示/安全重启/真正退出 | 同左 | 已实现；重启入口待两端真机点击复验 |
| 真正退出 | 设置关闭即退出、文件菜单或托盘退出 | 设置关闭即退出、Cmd+Q 或菜单栏退出 | 已实现；交互需分平台人工复验 |

当前关闭隐藏不会重建窗口或 AudioEngine；只有真正退出才销毁宿主。若窗口因崩溃被销毁，应用不会声称仍可继续播放。

## 构建边界

`electron-vite` 只构建一套 main/preload/renderer。`electron-builder.yml` 为 Windows x64、macOS x64 和 macOS arm64 指定独立目标；脚本显式传入架构，不启用 Windows ARM64、Linux 或 universal。
