# Sonavi 架构

更新日期：2026-09-14

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
- `src/main/platform/`：最小平台差异。P01 只含原生窗口选项、菜单、快捷键标签和最后窗口生命周期。
- `src/preload/`：唯一 renderer 桥；暴露类型明确的应用信息、连接/恢复/退出和固定音乐库方法，不暴露原始 IPC 或 Node 对象。
- `src/shared/`：IPC channel、TypeScript 类型与 Zod 运行时 schema。
- `src/renderer/`：一套 Vue + Tailwind CSS 应用，shadcn-vue 组件源码与 Sonavi tokens 共用；平台展示数据来自 preload，不读取 `process`。
- `src/renderer/src/services/audio-engine/`：P04 的 AudioEngine 契约与唯一 HTMLAudioElement 宿主；切歌时释放旧宿主监听并以 generation/命令序号隔离迟到事件与 Promise。
- `src/renderer/src/stores/player.ts`：P04 队列与播放策略的唯一客户端状态源；组件不独立推测播放状态。
- `tests/`：平台策略、契约、共享 UI 与真实 Electron 冒烟。

## 安全模型

BrowserWindow 固定 `contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`、`webSecurity=true`、`webviewTag=false`、`allowRunningInsecureContent=false`、`navigateOnDragDrop=false` 并使用原生 frame。CSP 以 `default-src 'none'` 默认拒绝，仅逐项开放本地脚本/样式、媒体 scheme 与开发 localhost WebSocket，并拒绝 frame ancestor。main 默认拒绝权限请求、窗口打开和应用外导航。

应用信息、连接、音乐库与播放辅助 IPC 同时执行：主 frame/所属 BrowserWindow 检查、开发 origin 或打包后精确文件路径检查、输入/返回数据 Zod 校验。renderer 再校验返回值。连接 IPC 只接受服务器地址、用户名、一次性密码和两个布尔选项；音乐库 IPC 只接受不透明会话 ID、受限资源 ID、分页参数及 P06 明确列出的收藏/歌单变更；P07 歌词/上报只接受当前会话、曲目 ID、纯文本歌曲元数据、布尔 submission 和安全整数时间，不提供任意 URL 请求能力。

P02 的连接客户端位于 `src/main/services/opensubsonic/`，使用 Electron Session 的 Chromium 网络栈，禁止自动重定向并限制 JSON 响应为 1 MiB。认证按每次请求独立 salt 生成 token，明文密码不进入 URL、日志、renderer store 或持久化文件。`ping` 成功后探测 OpenSubsonic 扩展与音乐文件夹；旧服务器缺少扩展端点时可降级，认证和音乐库权限失败不能伪装成功。

统一 `CredentialStore` 位于 `src/main/services/credentials/`，只在 app ready 后调用 Electron 44 的异步 safeStorage。持久化文件放在 `app.getPath('userData')`，通过同目录临时密文文件替换保存；密码字段只写入系统加密密文。加密或写入失败时保留 main 进程会话凭据并明确返回 `session-only`，不回退明文。启动时可解密恢复，safeStorage 请求密钥轮换时先重加密；“退出并忘记账号”显式删除持久化文件。

P03 的 `MediaHandleRegistry` 只向 renderer 返回随机、不透明的 `sonavi-media://media/<uuid>`。自定义 scheme 在 app ready 前注册为 standard/secure/fetch/stream，但不启用 bypassCSP；处理器在 default Session 上注册。main 根据当前会话解析句柄并重新生成认证 URL，拒绝重定向、非法/多段 Range、非媒体内容类型与非 200/206/416 响应。响应体以保留背压的 Web Stream 传递，不调用 `arrayBuffer()`、不做 Base64 IPC。退出、忘记账号、切换账号与真正退出会撤销对应句柄并通过 AbortController 中止尚未完成的上游流。CSP 只为 `img-src` 和 `media-src` 增加该 scheme。

## P04 播放核心

AudioEngine 快照只有一个枚举状态：`idle/loading/playing/paused/buffering/seeking/ended/error`，同时携带 generation、曲目、进度、时长、音量与错误。只有 `HtmlAudioEngine` 创建 HTMLAudioElement；切换来源时先移除旧监听、停止并释放旧元素，再创建当前 generation 的唯一活动元素。每次来源切换递增 generation，每次 play/pause 递增命令序号，旧元素事件和迟到的 `play()` 拒绝不会覆盖新曲目或用户的加载中暂停操作。

Pinia player store 管理队列。每个条目使用随机 `queueEntryId`，将服务端 `trackId`、不透明媒体句柄和当前 `serverId/accountId/sessionId` 范围绑定在一起；重复 track 可以形成不同队列项。顺序与随机都以 queueEntryId 导航，随机模式在队列不变时保留稳定顺序，并以实际播放历史实现上一首。自然 ended 在单曲循环下重播当前项；手动下一首忽略单曲循环并选择后继。删除当前项优先选择其播放顺序中的后继、否则前项，并保留播放/暂停意图；空队列停止引擎并回到 idle。

P04 队列只存在于当前 renderer 会话。恢复持久化队列时必须重新向有效账号申请媒体句柄且默认暂停；该落盘能力、后台宿主、托盘和媒体键仍属于 P09，不在 P04 提前实现。

## P05 音乐库与搜索

首页与全部专辑共用 `LibraryPanel.vue`，仅以受限的 `AlbumListType` 区分 `newest` 和 `alphabeticalByName`；查询 key 包含 session 与类型，翻页结果按服务端 ID 去重。艺术家列表使用 `getArtists` 的协议索引，但 renderer 只挂载固定行高可见窗口和 overscan；艺术家详情通过 `getArtist` 复用同一专辑卡片语义。

搜索只调用公共 `search3`，艺术家、专辑和歌曲使用相同 offset/size 分页。输入在 renderer 防抖 300ms，TanStack Query 为每个查询提供 AbortSignal；renderer 生成随机 requestId，通过固定 `cancel-search` preload 方法请求 main 中止对应 AbortController。main 同时校验 sessionId/requestId，断开或轮换账号时取消该会话的全部活动搜索。搜索结果只返回纯文本元数据及随机媒体句柄，不允许 renderer 访问任意 URL。

设置页当前只呈现平台、服务器、协议与安全退出操作；托盘/Dock、后台播放及缓存设置仍按后续阶段实现。

## P06 收藏与歌单

收藏与歌单继续使用同一个 OpenSubsonic 客户端、LibraryService 和受限 preload。`getStarred2`、`star`、`unstar` 负责艺术家、专辑和歌曲收藏；成功写入后 TanStack Query 只失效当前 session 的收藏、音乐库、详情和搜索查询，失败则保留已有数据，不在客户端乐观伪造服务端状态。

歌单读取使用 `getPlaylists` / `getPlaylist`，写入使用 `createPlaylist` / `updatePlaylist` / `deletePlaylist`。协议重复参数由 URL 构造器按原顺序追加；创建/追加保留队列重复项，删除歌曲传递服务端歌单中的零基索引，从而能精确删除某一个重复项。旧服务器在创建或其他写操作成功时可以只返回空成功响应，因此 mutation 只返回受校验的 `{ changed: true }`，随后通过固定读取端点刷新服务器事实。

凭据仍只存在于 main；renderer 不能选择端点或参数名，只能提交受限 sessionId、资源 ID、名称、公开布尔值、歌曲 ID 数组和非负索引。P06 不持久化收藏/歌单副本，也不引入平台分叉、原生依赖、歌词、scrobble 或后台播放宿主。

## P07 歌词与播放上报

连接成功后，`ConnectionService` 在 main 内同时保存凭据和经过协议校验的服务器能力副本。`PlaybackService` 只在能力列表声明 `songLyrics` 时调用 `getLyricsBySongId`；否则调用兼容的 `getLyrics`。结构化响应保留多个歌词版本、语言、offset、同步标记和毫秒行时间；`xxx`/`und` 作为未指定语言处理。未请求 songLyrics v2 的 enhanced cue/翻译能力，旧版歌词按换行映射为非同步行。

`LyricsPanel.vue` 通过 TanStack Query 按 session + track 缓存歌词，直接读取唯一 player store 的 AudioEngine 进度；活动行判断使用 `startMs + offsetMs <= currentTimeMs`。浮层覆盖同步/非同步、多版本、加载、空、错误和重试状态，队列与歌词浮层互斥，避免窄窗口相互遮挡。

播放上报控制器不依赖播放器组件生命周期。队列项首次真正进入 `playing` 时发送 `scrobble(submission=false)` 并记录开始时间；仅累计相邻不超过 5 秒的正向播放进度，seek、倒退和大幅跳转不计入听取时长。累计达到 `min(duration × 50%, 240 秒)` 时发送一次 `submission=true`，两次上报使用同一播放开始时间，并按 `queueEntryId` 去重。失败只显示非阻断状态，不停止 AudioEngine。P07 不持久化上报队列，离线重试、后台宿主与队列恢复仍留待后续阶段。

## 平台生命周期规则

| 行为 | Windows | macOS | P01 状态 |
| --- | --- | --- | --- |
| 窗口装饰 | 系统原生边框/按钮 | 系统原生边框/按钮 | 已实现 |
| 菜单 | 文件/编辑/窗口 | 应用/编辑/窗口 | 已实现基础模板 |
| 快捷键提示 | Ctrl | Cmd | 已通过 preload 集中提供 |
| 关闭最后窗口 | 退出进程 | 关闭窗口，保留 Dock 应用 | 已实现 |
| 重新激活 | 重新启动后创建窗口 | Dock 激活时重建窗口 | macOS 已实现 |
| 托盘/隐藏继续播放 | P09 定义 | P09 定义 | 未实现 |
| 真正退出 | 关闭最后窗口或菜单退出 | 应用菜单/Cmd+Q | 已实现基础角色菜单 |

窗口重建不能在未来破坏单一 AudioEngine 宿主。P09 实现后台播放前必须先决定宿主生命周期，不能通过销毁 renderer 达成“隐藏”。

## 构建边界

`electron-vite` 只构建一套 main/preload/renderer。`electron-builder.yml` 为 Windows x64、macOS x64 和 macOS arm64 指定独立目标；脚本显式传入架构，不启用 Windows ARM64、Linux 或 universal。
