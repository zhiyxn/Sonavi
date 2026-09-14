# Sonavi 任务清单

更新日期：2026-09-14

## P01：工程基础 + 双平台基础修正（已完成）

- [x] 读取原始 UI、开发包、Git 状态与旧平台约定。
- [x] 建立根级 AGENTS、PRD、ARCHITECTURE、DECISIONS、DESIGN-MAP、COMPATIBILITY 等执行文档。
- [x] 建立单套 Electron/main/preload/renderer/shared 工程。
- [x] 建立共享连接页、应用外壳与未启用 AudioEngine 占位。
- [x] 建立 Windows/macOS 最小平台适配入口与原生窗口规则。
- [x] 建立类型化应用信息 IPC、CSP、导航/权限限制。
- [x] 建立 Windows x64、macOS x64、macOS arm64 构建脚本与 electron-builder 配置。
- [x] 安装锁定依赖并生成 lockfile；`npm ci` 可复现。
- [x] 执行 lint、typecheck、unit/component test、renderer build。
- [x] 在当前 Intel Mac 执行开发启动、Electron/截图冒烟与最小 x64 目录打包。
- [x] 验证未签名 x64 目录包的架构、最低系统、asar、IPC 与 Dock 重激活。
- [x] 建立并远端运行 Windows x64、macOS Intel x64、macOS arm64 CI 矩阵；P01 提交三个 job 全部通过。
- [x] 更新 TEST-REPORT/HANDOFF 为实测结果并判断 P01 闸门。

## P02：连接、认证与 CredentialStore（本机代码闸门已完成）

- [x] 核对当前 OpenSubsonic、Navidrome 与 Electron safeStorage 官方文档。
- [x] 实现 HTTPS 默认、显式 HTTP 风险确认、自定义端口与子路径规范化。
- [x] 实现每请求随机 salt 的 token 认证；URL 不携带明文密码。
- [x] 实现 `ping`、`getOpenSubsonicExtensions`、`getMusicFolders` 连接探测。
- [x] 实现 HTTP/协议双层校验、1 MiB 响应上限与错误分类。
- [x] 实现受信任发送者检查、输入/输出 schema 和受限 preload 连接 API。
- [x] 实现 CredentialStore 加密保存；safeStorage 不可用或失败时不写明文。
- [x] 受控 fixture 覆盖 URL、认证、能力降级、文件夹 ID、错误分类和存储失败。
- [x] 当前 Intel Mac 完成生产 Electron、连接 IPC、safeStorage 往返、截图和目录包验证。
- [x] 实现已保存凭据的跨重启恢复、密钥轮换重加密与显式删除，密码继续只留在 main。
- [x] 退出、忘记账号和切换会话时撤销旧媒体句柄并中止活动媒体请求。
- [ ] 使用用户授权的真实 Navidrome/OpenSubsonic 测试账号验证 HTTPS、反向代理与权限差异。
- [x] P02 提交进入远端三平台 CI；run `34760475489` 三目标成功。
- [ ] Windows 11 x64 与 macOS arm64 实机验证连接 UI、网络错误和 safeStorage。

P02 基础提交：`282ce86 feat(p02): 建立安全连接与凭据保存基础`。跨重启恢复/删除和会话清理由 `4d1777d` 补齐并已通过三目标 CI；外部环境与另两类实机证据仍待补充。

## P03：专辑到真实播放的最短链路

- [x] 核对 Electron protocol/Session、OpenSubsonic 专辑/封面/stream 与 shadcn-vue/Tailwind 官方资料。
- [x] 恢复原始提示中 `shadcn-vue + Tailwind CSS` 技术路线，并继续映射 Sonavi tokens。
- [x] 实现 `getAlbumList2`、`getAlbum` 与 string ID 规范化。
- [x] 实现 main 会话轮换、随机媒体句柄与受限音乐库 IPC/preload API。
- [x] 实现 `sonavi-media` 注册、CSP 白名单、Electron Session 流式转发和重定向拒绝。
- [x] 覆盖单段 Range、200/206/416、异常 MIME 与网络失败；生产代码不使用 `arrayBuffer`/Base64。
- [x] 实现简单专辑列表、详情、歌曲播放按钮与单一 HTMLAudioElement AudioEngine。
- [x] 用本地受控服务和合成 WAV 完成真实 Electron 点击播放与截图。
- [x] 当前 Intel Mac 完成未签名 x64 目录包构建和包内播放冒烟。
- [x] 真实 HTMLAudioElement 完成播放、暂停、原始流 seek 与恢复播放验证。
- [x] 断开连接会停止 renderer 播放、清查询缓存、撤销句柄并取消活动上游流。
- [x] `getAlbumList2` 使用受校验的 `offset/size` 分页；界面每次加载 30 张并提供“加载更多专辑”。
- [x] 用户在实际服务上完成连接、首批专辑读取和歌曲播放，未向项目保存服务地址或凭据。
- [ ] 在实际服务复验第二页加载，并继续验证封面、原始格式/转码与 seek 差异。
- [ ] Windows 11 x64 与 macOS arm64 分别运行、播放和截图验证。
- [x] P03 与生命周期修复已推送；提交 `4d1777d` 的 run `34762062759` 三目标成功。
- [ ] 物理扬声器/耳机听音验证；自动化 audio `playing` 事件不等价于听音。

## P04：播放状态机与队列（本机代码闸门已完成）

- [x] 定义 `idle/loading/playing/paused/buffering/seeking/ended/error` 状态与快照/事件契约。
- [x] 建立唯一 HtmlAudioEngine；页面组件不创建 Audio，不以多个布尔值推测播放状态。
- [x] 使用 generation 与命令序号隔离旧元素事件、快速切歌和迟到的 play Promise。
- [x] 队列项分离 `queueEntryId` 与 `trackId`，携带 server/account/session 范围并允许重复歌曲。
- [x] 支持整张专辑替换队列、追加、选择、删除当前/非当前、清空和上移/下移重排。
- [x] 支持顺序、稳定随机历史、上一首/下一首、单曲循环与列表循环。
- [x] 明确自然 ended 遵循单曲循环、手动下一首忽略单曲循环；空队列回 idle。
- [x] 支持音量、加载中暂停、暂停 seek、播放失败/缓冲/断流状态。
- [x] 单元测试覆盖重复歌曲、删除当前项、随机上一首、循环、空队列、重排、快速切歌、连续点击和组件卸载不中断。
- [x] 真实 Electron fixture 与未签名 macOS x64 目录包完成 3 首专辑队列、重复追加、前后切歌、播放/暂停/seek 冒烟。
- [x] 目视检查 macOS Intel 开发构建与目录包截图；队列浮层、播放器和中文无截断/重叠。
- [ ] 使用用户实际服务验证多曲专辑、连续切歌、缓冲/断流和不同音频格式。
- [ ] Windows 11 x64 与 macOS arm64 分别运行队列、媒体事件、声音与截图验证。
- [x] 提交为 `3b3fca2 feat(p04): 实现播放状态机与队列`。
- [x] 本地与 `origin/main` 均指向 `3b3fca2`；本轮未核实对应三目标 CI 编号。
- [ ] 物理扬声器/耳机听音验证；合成 WAV 的 `playing` 事件不等价于听音。

## P05：正式音乐库 UI 与搜索（已实现并进入三目标 CI）

- [x] 首页与专辑页共享 LibraryPanel；首页使用 `newest`，全部专辑使用 `alphabeticalByName` 分页。
- [x] 实现 `getArtists`、`getArtist`、`search3` 的协议解析、main 服务、IPC 与 preload 固定方法。
- [x] 艺术家列表使用固定行高窗口化，只渲染可见区与 overscan；详情显示服务器返回的真实专辑。
- [x] 搜索输入 300ms 防抖，TanStack Query 按会话/查询分页缓存，并通过受限取消 IPC 中止过期主进程请求。
- [x] 搜索结果覆盖艺术家、专辑、歌曲；专辑/艺术家可进入详情，歌曲接入 P04 的共享播放队列。
- [x] 完成首页、专辑、艺术家、搜索、设置导航；收藏与歌单清楚标记 P06，未提前写入服务端。
- [x] 覆盖加载、空、错误、重试、缺失封面、长标题截断与搜索无结果界面。
- [x] 单元测试覆盖 10,000 位艺术家的窗口化和 renderer 搜索取消边界。
- [x] 当前 Intel Mac Electron 冒烟走通艺术家、艺术家详情、专辑详情和防抖搜索，并生成截图。
- [x] 当前 Intel Mac 生成未签名 x64 目录包，并在包内复跑完整 P05 Electron 冒烟。
- [ ] 使用用户实际服务验证大量艺术家、混合语言搜索、无结果和多页结果。
- [x] 当前 Windows x64 主机完成生产构建、源码与目录包 Electron 冒烟、搜索截图和 NSIS 生成；安装器实际安装与物理听音未验证。
- [ ] macOS arm64 实机运行、搜索和截图验证。
- [x] 提交为 `b8b61d5 feat(p05): 完善音乐库与搜索`；run `34798063277` 的 Windows x64、macOS Intel x64、macOS arm64 三个 job 全部成功。

## P06：收藏与歌单管理（本机代码闸门已完成）

- [x] 核对 OpenSubsonic `getStarred2`、`star`、`unstar`、`getPlaylists`、`getPlaylist`、`createPlaylist`、`updatePlaylist`、`deletePlaylist` 官方文档。
- [x] 扩展共享类型、Zod schema 与固定 IPC/preload 契约；所有 ID、名称、布尔值、歌曲数组和索引均有运行时校验。
- [x] 扩展 OpenSubsonic 客户端和 LibraryService，兼容写端点空成功响应及旧版 `createPlaylist` 不返回实体。
- [x] 实现收藏页，并在现有艺术家、专辑和歌曲界面提供收藏/取消收藏操作。
- [x] 实现歌单列表/详情、创建、重命名、公开状态、删除、从当前播放队列追加、按索引移除及整单播放。
- [x] mutation 成功后只失效当前会话相关查询；失败时保留已有数据并显示安全错误，不乐观伪造服务端成功。
- [x] 单元、组件与 Electron fixture 覆盖收藏、歌单 CRUD、重复歌曲、权限/会话失败和断开清理。
- [x] 执行 lint、typecheck、test、build、当前平台 Electron 冒烟和目录包验证；更新 TEST-REPORT/HANDOFF。
- [ ] 真实服务器、Windows 11、macOS Intel 与 Apple Silicon 分别验证写权限和服务端差异。

## P07：歌词与播放上报（本机代码闸门已完成）

- [x] 核对 OpenSubsonic `getLyricsBySongId`、`getLyrics` 与 `scrobble` 官方协议。
- [x] 定义歌词和播放上报共享类型、Zod schema 与固定 IPC/preload 契约。
- [x] main 根据已探测的 `songLyrics` 能力选择结构化或旧版歌词端点，凭据继续只由 main 使用。
- [x] renderer 实现同步高亮、非同步歌词、歌词变体及加载/空/错误/重试界面。
- [x] 按真实播放累计时间发送 now-playing 与完成上报，忽略 seek 跳跃并按队列项去重。
- [x] 补充协议、服务、组件、上报控制器与 Electron fixture 测试。
- [x] 执行 lint、typecheck、test、build、当前平台 Electron 冒烟与目录包验证，并更新 TEST-REPORT/HANDOFF。
- [ ] 在真实服务器、Windows 11、macOS Intel 与 Apple Silicon 分别验证歌词差异和 scrobble 行为。

## 后续阶段（顺序保留）

跨阶段品牌资产：

- [x] 将用户指定 PNG 原样纳入仓库，接入共享侧栏、页面图标及 electron-builder Windows/macOS 图标配置。
- [ ] 在 Windows 安装器、macOS Intel/Apple Silicon 应用包、Dock/Finder/开始菜单中分别目视验证缩放与系统遮罩效果；该项继续属于 P10 发布验收。

- [ ] P02：真实服务器、Windows 11 与 Apple Silicon 外部环境验证（本机代码闸门已完成）。
- [ ] P03：外部服务器分页/格式及另两目标实机验证（本机实现已完成）。
- [ ] P04：Windows 11、Apple Silicon 与真实服务器队列/事件差异验证（本机代码闸门已完成）。
- [ ] P05：真实服务器、Windows 11 与 Apple Silicon 外部环境验证（本机代码闸门已完成）。
- [ ] P06：真实服务器与各目标实机验证（实现提交 `a831be6` 的三目标 CI 已成功）。
- [ ] P07：三目标 CI、真实服务器与各目标实机歌词/scrobble 验证（本机代码闸门已完成）。
- [ ] P08：转码、网络策略与诊断。
- [ ] P09：托盘/Dock、隐藏继续播放、真正退出、媒体键与性能。
- [ ] P10：安装包、签名/公证占位、兼容性与发布前审计。

## 尚需外部环境验证

- Windows 11 x64：依赖安装、开发启动、单元测试、生产构建、NSIS 打包、截图、菜单/关闭/重启。
- Apple Silicon macOS 13+：原生 arm64 依赖安装、开发启动、DMG 打包、截图、菜单/Dock/关闭与重激活。
- Intel Mac 的未签名 DMG 安装打开验证（目录包与开发启动不等于安装器验收）。
- P05 提交 `b8b61d5` 的 GitHub Actions run `34798063277` 已在 Windows x64、macOS Intel x64、macOS arm64 三个 job 成功；CI 仍不替代对应桌面系统与最低系统版本实机验收。

## 当前闸门结论

P01 已达到验收条件。P02～P07 的本机代码闸门已通过；用户实际服务已证明连接、首批专辑和播放可用，P07 的结构化歌词、高亮、旧版映射、now-playing/submission 与 seek 去重通过 75 项测试、受控 Electron fixture 和 Windows x64 目录包。P06 实现提交 `a831be6` 的三目标 CI 已成功；P07 尚未提交或进入 CI。真实服务器写权限/歌词差异、Windows 11 人工验收、macOS Intel/Apple Silicon、格式差异和物理听音仍未完成，因此不能宣称 P02～P07 双平台最终验收完成。
