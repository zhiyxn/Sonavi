# P07 歌词与播放上报测试报告

更新日期：2026-09-14
状态：P01～P07 本机代码闸门通过；P07 实现提交 `9e599fa` 已推送，Windows x64 源码与目录包受控验证成功，三目标 CI、真实服务器歌词/scrobble 与目标系统实机待验证

## 测试环境

- 当前主机：Windows x64 build 26200
- Node.js：22.21.1 x64（NVM；符合 `>=22.12 <23` engines，非 `.nvmrc` 精确 22.19.0）
- npm：10.9.4（当前 NVM Node 自带；项目 `packageManager` 仍固定 10.9.3）
- Electron：44.3.0
- 分支：`main`
- P01 远端提交：`959e742030c3d5795f2632a5f092e81472c1b056`
- P02 提交：`282ce86`（已推送；GitHub Actions run `34760475489` 三目标成功）
- P03 生命周期修复提交：`4d1777d`（已推送；run `34762062759` 三目标成功）
- P03 分页修复提交：`f2a39c9`（本地与 `origin/main` 对齐；本轮未取得 CI 运行编号）
- P04 提交：`3b3fca2`（本地 `main` 与 `origin/main` 对齐；CI 编号未核实）
- P05 提交：`b8b61d5`（本地与 `origin/main` 对齐；run `34798063277` 三目标成功）
- P06 实现提交：`a831be6`（已推送至 `origin/main`；run `34810276941` 三目标成功）
- P07 实现提交：`9e599fa`（已推送至 `origin/main`；三目标 CI 待确认）

## P01 远端 CI 证据

GitHub Actions run：`34749707166`，结论 `success`，运行页面：https://github.com/zhiyxn/Sonavi/actions/runs/34749707166

| 目标 | Runner | Job ID | 结果 | 已执行步骤 |
| --- | --- | --- | --- | --- |
| Windows x64 | `windows-2025` | `103703858252` | 通过 | checkout、Node、`npm ci`、lint、typecheck、unit/component、Electron smoke、Windows x64 打包 |
| macOS Intel x64 | `macos-15-intel` | `103703858433` | 通过 | checkout、Node、`npm ci`、lint、typecheck、unit/component、Electron smoke、macOS x64 打包 |
| macOS Apple Silicon arm64 | `macos-15` | `103703858562` | 通过 | checkout、Node、`npm ci`、lint、typecheck、unit/component、Electron smoke、macOS arm64 打包 |

这些是 P01 提交的自动化 runner 证据。Windows Server runner 不等于 Windows 11 桌面人工验收，macOS 15 runner 不等于 macOS 13 最低版本与真实设备 UI/安装验收。

## 当前自动验证

| 命令/检查 | 结果 | 证据/说明 |
| --- | --- | --- |
| `npm run lint` | 通过 | ESLint 10.10.0，0 warning |
| `npm run typecheck` | 通过 | main/preload、renderer、tests 三组通过 |
| `npm test` | 通过 | 17 个文件、75 项测试通过 |
| `npm run build` | 通过 | main、preload CJS、renderer 构建成功 |
| `npm run test:e2e` | 通过 | 真实 Electron 连接本地 fixture；既有 P02～P06 流程与 P07 结构化歌词、高亮、now-playing/submission、seek 过滤全部通过 |
| `npm run pack:dir` | 通过 | 重新生成包含 P07 的 Windows x64 `release/0.1.0/win-unpacked` |
| 包内 Electron 冒烟 | 通过 | Windows x64 目录包完成连接、P02～P06 回归、P07 歌词/上报、会话/凭据、safeStorage、960×640 布局与截图 |
| 品牌图标 | 通过（Windows x64 目录包） | renderer Logo 加载检查通过；`Sonavi.exe` 提取出的 32×32 图标与指定橙色音符一致；NSIS 与 macOS 待验证 |

## P02/P03 覆盖范围

- URL：HTTPS 默认、自定义端口、中文/编码子路径、`/rest` 后缀、拒绝嵌入账号/查询/片段、HTTP 显式风险确认。
- 认证：官方示例 token 值、UTF-8 `md5(password + salt)`、每请求随机 salt、URL 无 `p` 明文参数。
- 协议：`ping`、扩展探测、音乐文件夹；服务端数字 ID 转为 string；旧服务器缺少扩展端点可降级。
- 错误：DNS、拒绝连接、超时、TLS、重定向、HTTP 401/403/5xx、Cloudflare challenge、HTML、非法 JSON、超大响应、协议认证/认证方式/权限/版本。
- 存储：系统加密可用时文件中无明文密码；不可用时不创建凭据文件；当前 Intel Mac 异步 safeStorage 加解密、应用进程重启恢复、显式删除和删除后重启不恢复均通过。
- 边界：IPC 校验主 frame/窗口/来源与输入；preload 只暴露应用信息、固定连接/恢复/退出和音乐库方法；renderer 对返回值再次校验，不获得原始 IPC、Node 或任意 URL 请求能力。
- P03 数据：`getAlbumList2` 使用受校验的 offset/size，每页 30 张；返回 items/nextOffset/hasMore，renderer 用 Infinite Query 累积并按 ID 去重；`getAlbum` 详情与会话生命周期保持不变。
- P03 媒体：renderer 只获得随机 `sonavi-media` URL；覆盖 GET/HEAD 方法限制、单段 Range、200/206/416、重定向/非媒体/网络失败拒绝，以及安全响应头白名单。
- P03 流：生产 handler 以保留背压的 ReadableStream 传递上游内容，不调用 `arrayBuffer()` 或 Base64 IPC；会话撤销会 Abort 活动上游请求。Electron 冒烟实际执行播放、暂停、2 秒 seek 与恢复播放。
- P04 状态：覆盖 idle/loading/playing/paused/buffering/seeking/ended/error、音量、加载中暂停、暂停 seek、流错误和 play Promise 失败。
- P04 generation：连续切歌后旧 Audio 事件与旧 play Promise 不影响新曲目；连续点击播放控制不创建第二个活动宿主。
- P04 队列：覆盖重复 track 的独立 queueEntryId、删除当前项、空队列、重排、稳定随机历史上一首、单曲/列表循环，以及播放器组件卸载不中断。
- P05 专辑：同一 LibraryPanel 按查询 key 隔离首页 `newest` 和全部专辑 `alphabeticalByName`，均使用 `offset/size` 分页、ID 去重及增量失败保留已加载数据。
- P05 艺术家：解析 `getArtists` 索引及 `getArtist` 专辑；10,000 项组件测试确认 DOM 只保留可见窗口与 overscan。
- P05 搜索：`search3` 同步分页艺术家/专辑/歌曲，输入 300ms 防抖；TanStack Query AbortSignal 通过受限 requestId IPC 中止 main 请求，断开/会话轮换也取消活动搜索。
- P05 边界：搜索、艺术家与专辑输入/输出均经 Zod 校验；renderer 仍只持有随机媒体句柄，不接触上游 URL 或凭据。
- P06 收藏：解析 `starred` 为显式布尔值；`getStarred2`、`star`、`unstar` 覆盖艺术家/专辑/歌曲参数映射，成功后按当前会话失效查询，失败不改写已有状态。
- P06 歌单：覆盖列表/详情、空歌单创建、重命名、公开状态、删除、按队列顺序重复追加、按零基索引精确移除重复歌曲和整单播放。
- P06 契约：共享类型、main IPC 输入/输出与 renderer 返回值均经 Zod 校验；重复 URL 参数保留原顺序，旧版写端点空成功响应可接受。
- P06 失败：单元与 Electron fixture 覆盖无会话和协议权限/错误映射；断开连接沿用既有查询清理、播放器停止、媒体句柄撤销与活动请求取消。
- P07 歌词：覆盖 `getLyricsBySongId` 多版本/同步时间/offset/未指定语言映射，以及 `getLyrics` 换行文本兼容；main 根据已验证的 `songLyrics` 能力选择固定端点。
- P07 界面：组件测试和 Electron fixture 覆盖结构化歌词读取、进度高亮、纯文本/空/错误基础状态与重试入口；960×640 歌词浮层目视无截断或应用级横向溢出。
- P07 上报：首次 `playing` 发送 now-playing；累计相邻真实播放进度达到 50%/240 秒阈值后发送 submission；测试覆盖 seek 跳跃忽略、同一队列项去重和重复 trackId 的不同 queueEntryId 隔离。
- P07 契约：歌词与上报请求/响应在 preload 两侧经 Zod 校验；凭据、salt/token 与上游 URL 继续不进入 renderer 或日志。

## 分平台结果

| 验证项 | Windows 11 x64 | macOS 13 Intel x64 | macOS 13+ arm64 |
| --- | --- | --- | --- |
| P01 CI 自动化 | Windows x64 runner 通过 | Intel runner 通过 | arm64 runner 通过 |
| P02 基础提交远端 CI | 三目标成功 | 三目标成功 | 三目标成功 |
| P02 开发/生产启动 | 未验证：无实机 | 通过 | 未验证：无实机 |
| P02 目录包 | 未验证：无实机 | x64 目录包启动通过；DMG 未安装 | 未验证：无实机 |
| P02 safeStorage | 单元失败路径通过；实机未验证 | 异步加密往返、跨进程恢复/删除通过 | 单元失败路径通过；实机未验证 |
| P02 UI 截图 | 未验证 | 开发构建与目录包截图目视通过，无截断/重叠 | 未验证 |
| P03 截至 `4d1777d` 远端 CI | 三目标成功 | 三目标成功 | 三目标成功 |
| P03 专辑/媒体/Audio 冒烟 | 未验证：无实机 | 生产构建与 x64 目录包播放/暂停/seek、会话清理通过 | 未验证：无实机 |
| P03 UI 截图 | 未验证 | 专辑详情与播放器目视通过，无截断/重叠 | 未验证 |
| P03 物理听音 | 未验证 | 未验证：自动播放事件不等同听音 | 未验证 |
| 真实服务器 | 未验证 | 用户实际服务的连接、首批专辑、播放成功；分页修复待复验 | 未验证 |
| P04 状态机/队列自动化 | 未验证：无实机 | 单元、开发 Electron 与 x64 目录包通过 | 未验证：无实机 |
| P04 队列 UI 截图 | 未验证 | 开发构建与目录包目视通过，无截断/重叠 | 未验证 |
| P04 实际服务/听音 | 未验证 | 未验证：等待多曲专辑和物理听音 | 未验证 |
| P05 音乐库/搜索自动化 | 当前 Windows x64 主机的源码与目录包冒烟通过 | 单元、生产 Electron 冒烟通过 | CI 通过；实机未验证 |
| P05 UI 截图 | 当前 Windows x64 主机截图目视通过；系统版本/安装器实装仍待确认 | 搜索页、共享导航、专辑/艺术家结果目视通过 | 未验证 |
| P05 实际服务 | 未验证 | 未验证：等待大量艺术家、分页与混合语言搜索 | 未验证 |
| P06 收藏/歌单自动化 | 当前 Windows x64 主机源码与目录包通过 | 未验证：P06 尚未在 Intel Mac 运行 | 未验证：无实机 |
| P06 UI 截图 | Windows x64 目录包截图目视通过；Windows 11 正式版本/安装器待验证 | 未验证 | 未验证 |
| P06 真实服务器写操作 | 未验证 | 未验证 | 未验证 |
| P07 歌词/上报自动化 | 当前 Windows x64 主机源码与目录包通过 | 未验证 | 未验证 |
| P07 UI 截图 | Windows x64 目录包歌词浮层目视通过；Windows 11 正式版本/安装器待验证 | 未验证 | 未验证 |
| P07 真实服务器歌词/scrobble | 未验证 | 未验证 | 未验证 |

## 安全检查

- [x] `contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`、`webSecurity=true` 与 CSP 保持不变。
- [x] `webviewTag=false`、`allowRunningInsecureContent=false`、`navigateOnDragDrop=false` 显式设置；CSP 使用 `default-src 'none'` 与 `frame-ancestors 'none'`。
- [x] renderer 源码不导入 Node/Electron，不访问 `process` 或原始 `ipcRenderer`。
- [x] 连接 IPC 不是任意网络代理；输入和输出均有运行时 schema。
- [x] 密码不进入 Pinia、localStorage、日志或认证 URL，提交结束后清空输入框。
- [x] Electron Session 不自动跟随重定向，不关闭 TLS/证书验证。
- [x] JSON 响应限制为 1 MiB，网页/非法协议响应不能伪装连接成功。
- [x] safeStorage 不可用、加密失败或写入失败时不回退明文。
- [x] `sonavi-media` 不启用 `bypassCSP`；CSP 只允许该 scheme 用于封面与媒体。
- [x] 媒体句柄不含凭据/上游 URL；新连接、断开、忘记账号和退出会使旧会话失效并中止活动流；重定向不会携认证信息跟随。
- [x] 音频响应流式传递，不整首缓冲或跨 IPC 传 Base64。
- [x] P04 队列只保存当前会话的不透明媒体句柄；断开时清空，不将失效账号队列恢复为可播放状态。
- [x] P05 新增 IPC 仍为固定端点，分页、ID、查询长度与 requestId 有运行时校验；未暴露任意网络能力。
- [x] 搜索取消只允许当前有效 sessionId + requestId，退出或切换会话时取消活动请求。
- [x] P06 收藏/歌单 IPC 仍为固定端点；资源 ID、名称、布尔值、歌曲数组和非负索引均有运行时上下界校验。
- [x] P06 凭据继续只由 main 使用；renderer 不获得认证参数、任意端点或原始服务 URL 请求能力。
- [x] P06 mutation 失败保留服务器查询数据；成功后只失效当前会话相关查询，不落盘或乐观伪造收藏/歌单实体。
- [x] P07 只暴露固定 `getLyrics` / `report` 方法；main 依据保存的能力选择端点，renderer 不能指定 URL、端点或认证参数。
- [x] P07 歌词文本、语言、offset、行时间以及 session/track/time/submission 均有运行时长度、类型和数值边界校验。
- [x] 播放上报失败不影响音频，不记录凭据；seek 跳跃不伪造听取时长，同一 queueEntryId 不重复提交。
- [x] 队列落盘、托盘、后台宿主和媒体键未提前实现，仍属于 P09。

## 截图证据

- macOS Intel x64：历史 P05 开发构建与目录包截图已检查；P06 未在该平台运行或截图。
- Windows x64：当前 build 26200 主机已生成并目视检查 `artifacts/screenshots/p07-windows-x64-package.png`、`p07-lyrics-windows-x64-package.png` 与历史 Logo 截图；歌词浮层在 960×640 无明显截断、重叠或应用级横向溢出，0:02 正确高亮第二行。P07 未生成/安装 NSIS，系统正式版本与物理听音仍待人工确认。
- macOS Apple Silicon arm64：未验证，无 Apple Silicon 实机。

## 当前结论

P07 歌词与播放上报已通过当前 Windows x64 主机的 lint、类型检查、75 项测试、生产构建、源码 Electron fixture、目录打包和包内完整冒烟，且既有 P02～P06 链路未回归。实现提交 `9e599fa` 已推送，三目标 CI 待确认；尚未对用户实际服务读取歌词或发送 scrobble，Windows 11 正式版本/安装器、macOS Intel/Apple Silicon、不同服务端歌词格式与上报语义仍未验证，因此当前结论是“本机代码闸门通过”，不是三平台最终验收完成。

## 已观察的非阻断提示

- renderer 构建继续提示 Zod 注释位置无法由 Rollup 解释并移除；构建、schema 行为与运行均通过。
- macOS 目录包未签名；Electron 官方说明未稳定签名的不同构建可能触发 Keychain 重复授权，需在 P10 签名验收中复核。
