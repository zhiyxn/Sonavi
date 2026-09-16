# Sonavi 任务清单

更新日期：2026-09-16

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

## P08：转码、网络策略与诊断（当前 macOS Intel 代码闸门已完成）

- [x] 核对 OpenSubsonic `stream` / `transcodeOffset` 与 Electron Session 代理官方文档。
- [x] 实现原始、MP3 兼容转码与自动策略；码率限定为 128/192/256/320 kbps。
- [x] 自动策略只为已知直放类型保留一次转码回退句柄；AudioEngine 解码失败最多回退一次，不循环重试。
- [x] 转码参数仅由 main 生成；renderer 只持有不透明句柄，不能指定上游 URL、格式或认证参数。
- [x] 只有连接能力明确包含 `transcodeOffset` 时才开放转码 seek；否则禁用进度条并解释原因。
- [x] `timeOffset` 换流后 AudioEngine 使用片段偏移加本地进度形成完整歌曲时间线，歌词和上报继续读取同一时间线。
- [x] 系统代理、直连和手动代理三种模式互斥；API、封面与音频共享 `session.defaultSession`。
- [x] 代理切换调用 `setProxy` 后关闭旧连接，撤销媒体句柄并停止当前播放；失败不回退直连。
- [x] 实现 API、封面、原始音频、转码音频四阶段诊断，记录脱敏状态/类型/分类/耗时/建议。
- [x] 识别 HTTP 200 协议错误体、401/403、异常内容、证书/网络错误与断流；导出限制为 200 条、256 KiB 内。
- [x] 当前 macOS Intel 完成 88 项测试、生产构建、源码 Electron 冒烟、x64 目录包与包内完整冒烟、诊断截图。
- [ ] 在真实 Navidrome/OpenSubsonic 验证服务器支持的转码格式、码率、失败体和 `transcodeOffset` 行为。
- [ ] Windows 11 x64 与 macOS Apple Silicon arm64 分别验证代理、原始/转码播放、seek、诊断和截图。
- [ ] P08 提交后运行 Windows x64、macOS Intel x64、macOS arm64 三目标 CI。

## P09：桌面集成与性能（当前 macOS Intel 代码闸门已完成）

- [x] 使用一个 BrowserWindow/renderer 作为唯一 AudioEngine 宿主；默认关闭只隐藏，不销毁播放宿主。
- [x] 设置支持关闭时隐藏或真正退出；Windows/macOS 默认均为隐藏，托盘菜单提供单独“真正退出”。
- [x] Tray/菜单栏提供显示、播放/暂停、上一首、下一首、真正退出；macOS Dock/应用激活显示既有窗口。
- [x] 使用 Chromium Media Session 提供媒体信息和媒体键，不注册 Electron 全局媒体快捷键；Ctrl/Cmd+, 设置键按平台匹配，且与 Space 一样不截获编辑控件。
- [x] sleep/lock 只暂停；resume/unlock 清旧连接、撤销媒体句柄并以新句柄恢复暂停队列，不自动续播。
- [x] 在 `userData` 原子保存关闭动作、主题、音量、窗口状态与非敏感暂停队列；窗口状态按显示器裁剪。
- [x] 暂停队列按 main 计算的账号哈希隔离，不保存凭据/sessionId/媒体 URL，恢复时重新生成句柄并默认暂停。
- [x] 封面缓存按账号隔离，单项 5 MiB、单账号 128 MiB、LRU 淘汰并提供当前账号清空；音频不缓存。
- [x] 固定 10,000 条合成艺术家记录验证窗口化渲染少于 20 个按钮，测试阈值 1 秒。
- [x] 当前 macOS Intel 源码和 x64 目录包完成 P01～P09 冒烟、深色截图、关闭隐藏/恢复、队列跨重启和性能采样。
- [ ] Windows 11 x64 与 macOS arm64 分别验证托盘、关闭/最小化/真正退出、媒体键、锁屏/睡眠、窗口恢复、截图和性能。
- [ ] 当前 macOS Intel 人工点击托盘菜单、物理媒体键、锁屏/睡眠、真正退出与扬声器听音。
- [ ] 使用真实大型资料库记录首屏、滚动、快速切歌、请求与内存趋势；合成数据不可替代生产测量。
- [x] P08/P09 提交 `fb430a1` 已触发三目标 CI：Windows x64、macOS arm64 成功，macOS Intel 源码 Electron 冒烟失败，未形成全绿矩阵。

## 后续阶段（顺序保留）

跨阶段品牌资产：

- [x] 将用户指定 PNG 原样纳入仓库，接入共享侧栏、页面图标及 electron-builder Windows/macOS 图标配置。
- [ ] 在 Windows 安装器与 macOS Apple Silicon 应用包中目视验证缩放与系统遮罩；当前 Intel DMG 只验证了应用内截图，Finder/Dock 图标仍待人工验收。

- [ ] P02：真实服务器、Windows 11 与 Apple Silicon 外部环境验证（本机代码闸门已完成）。
- [ ] P03：外部服务器分页/格式及另两目标实机验证（本机实现已完成）。
- [ ] P04：Windows 11、Apple Silicon 与真实服务器队列/事件差异验证（本机代码闸门已完成）。
- [ ] P05：真实服务器、Windows 11 与 Apple Silicon 外部环境验证（本机代码闸门已完成）。
- [ ] P06：真实服务器与各目标实机验证（实现提交 `a831be6` 的三目标 CI 已成功）。
- [ ] P07：三目标 CI、真实服务器与各目标实机歌词/scrobble 验证（本机代码闸门已完成）。
- [ ] P08：真实服务器、Windows 11、Apple Silicon 与三目标 CI 外部验证（当前 macOS Intel 代码闸门已完成）。
- [ ] P09：Windows/Apple Silicon 实机、三目标 CI、人工托盘/媒体键/睡眠与真实大型资料库性能（当前 macOS Intel 代码闸门已完成）。
- [x] P10：增加三目标包元数据/架构/资源/签名/SHA-256 验证器与打包应用 Electron 冒烟入口。
- [x] P10：macOS 删除未使用隐私权限说明，增加最小签名 entitlements；ASAR 排除构建期依赖并设置 16 MiB 上限。
- [x] P10：当前 Intel Mac 生成未签名 x64 DMG，完成只读挂载、临时安装、包内完整冒烟与截图验证。
- [x] P10：补齐签名/公证接口说明、安装升级矩阵、发布闸门、回滚方式与 0.1.0 变更摘要。
- [x] P10 提交 `740981f` 已运行三目标 CI（run `34910450288`），准确取得 Windows 包验证、Intel 源码冒烟和 arm64 包验证三处失败证据。
- [x] 修复 Windows 无签名 PE 检测与 PowerShell 路径传递、arm64 linker ad-hoc 识别，以及 P08 转码 seek 请求等待竞态；本机 105 项测试、源码 Electron 冒烟与 x64/arm64 包验证通过。
- [x] P10 修复提交 `ce82e9e` 已运行第二轮三目标 CI（run `34912793294`）：Windows 全流程通过，arm64 包内冒烟在真实音频请求到达前断言，Intel 源码冒烟在重启暂停队列恢复处超时。
- [x] 修复提交 `1f23427` 为真实音频请求增加条件等待；暂停队列保存改为串行、可等待 flush，断开/退出前等待完成；E2E 在进程关闭前读取隔离 userData 确认非敏感队列已落盘。Windows 106 项测试、源码和打包应用完整冒烟通过。
- [x] `1f23427` 随文档提交 `51cf322` 运行三目标 CI（run `34934352140`）：Windows x64、macOS Intel x64 与 macOS arm64 的源码/包内冒烟、安装包和包验证全部通过。
- [x] 增加 `v*-rc.*` 标签驱动的候选发布工作流：强制标签/版本一致，在三个原生目标重新验证后只收集安装包、manifest 和统一 SHA-256 清单，并自动创建 GitHub Pre-release。
- [x] 推送 `v0.1.0-rc.1` 标签；release run `34937503560` 中 Windows x64 与 Apple Silicon arm64 通过，Intel 源码 Electron 冒烟失败，发布 job 按设计跳过，没有形成半发布 Release。
- [x] Electron 冒烟将脱敏失败栈写入 Check Summary 和公开检查注释；不增加自动重试、不删除断言。诊断注释定位了歌单写后刷新、断开时空队列覆盖，以及慢速 runner 上 4 秒测试音频自然切歌三处时序问题。
- [x] 推送 `v0.1.0-rc.2`；release run `35036809845` 的 Windows x64 与 Apple Silicon arm64 通过，Intel 源码 Electron 冒烟失败，发布 job 按设计跳过，没有创建 Release。
- [x] 修复异步歌单计数等待与断开队列持久化竞态，按断开前实际当前歌曲验证落盘/重启恢复；新增断开顺序回归测试。提交 `09b1ab0` 的 run `35039453442` 三目标全部通过。
- [x] 推送 `v0.1.0-rc.3`；release run `35040657787` 的三个 release gate 与发布 job 全部通过，GitHub Pre-release 已创建，三个安装包、三个 manifest 和 `SHA256SUMS.txt` 共七个附件齐全。
- [x] 推送 `v0.1.0-rc.4`（首个包含 P11 审查修复的候选）；release run `35063014155` 的三个 release gate 与发布 job 全部通过，Pre-release 已创建，三个安装包、三个 manifest 和 `SHA256SUMS.txt` 共七个附件齐全。
- [ ] Windows 11 x64 安装 NSIS 并完成人工图标、开始菜单、卸载保留 userData、桌面行为与物理听音验收。
- [ ] macOS Apple Silicon 原生构建/安装 arm64 DMG 并完成人工图标、Dock/菜单栏、桌面行为与物理听音验收。
- [ ] 使用正式证书验证 Windows Authenticode、macOS Developer ID、公证与 stapling；未经授权不索取或使用密钥。

## 尚需外部环境验证

- Windows 11 x64：依赖安装、开发启动、单元测试、生产构建、NSIS 打包、截图、菜单/关闭/重启。
- Apple Silicon macOS 13+：原生 arm64 依赖安装、开发启动、DMG 打包、截图、菜单/Dock/关闭与重激活。
- Intel Mac 的正式签名/公证 DMG、隔离属性下 Gatekeeper、Finder/Dock 图标及人工桌面行为；未签名 DMG 挂载、临时安装和包内启动已通过。
- P05 提交 `b8b61d5` 的 GitHub Actions run `34798063277` 已在 Windows x64、macOS Intel x64、macOS arm64 三个 job 成功；CI 仍不替代对应桌面系统与最低系统版本实机验收。

## P11：Release Candidate 独立审查、修复与测试准备（进行中）

- [x] 读取当前规范、架构、API、任务、交接、测试、兼容性与决策文档，并检查 git 状态、package scripts、electron-vite/electron-builder 和测试入口。
- [x] 在不修改产品代码的前提下完成 UI、Navidrome、播放、生命周期、双平台、安全和资源/性能静态审查。
- [x] 创建 `docs/RC-AUDIT.md`、`docs/TEST-MATRIX.md`、`docs/KNOWN-ISSUES.md`，并按 Blocker/Critical/Major/Minor/Enhancement 分类。
- [x] Windows 审查基线执行 lint、typecheck、109 项 Vitest、build、源码 Electron E2E、Windows x64 包构建/验证/包内 E2E和 npm audit，均通过。
- [x] 保留用户未提交的新 logo 与 `docs/Existing issues.md`，没有重构、签名、公证、自动更新或发布动作。
- [x] 修复 RC-C-001：媒体句柄改为会话密钥加密的无状态 token + epoch 撤销；10,000 个后续封面句柄不淘汰队列音频。
- [x] 为 `getArtists` 设置独立 16 MiB 有界响应上限；修复 ended scrobble、专辑详情错误重试和播放错误手动断点重试。
- [x] 修复生产 CSP、假按钮、状态位移、Windows 滚动条、主题 chrome、账号入口、自动分页、设置 Select 与托盘文案问题。
- [x] 修复加密媒体 URL 与转码 seek schema 不一致的回归；Windows 源码/打包 Electron 完整链路通过。
- [x] 修复后执行 lint、typecheck、24 文件/115 项 Vitest、build、源码 E2E、Windows x64 构建/包验证/包内 E2E，均通过。
- [ ] 复现真实 Windows 艺术家 API 失败、后续播放失败和 scrobble 不计数，收集脱敏诊断并确认根因。
- [ ] 用真实 MP3、AAC/M4A、FLAC、Opus/Ogg、WAV 样本在 Windows、macOS Intel 与 macOS arm64 分别验证原始播放、Range、seek 与转码回退。
- [ ] 完成两个 macOS 架构、Windows NSIS 安装、1440×900、字体/缩放、托盘/Dock、媒体键、睡眠/唤醒、长时播放和退出残留进程矩阵。

## 当前闸门结论

P01 已达到验收条件，P02～P10 已按序达到当时可用环境的代码闸门。P11 修复复核允许进入真机测试，当前为 0 Blocker、0 Critical、4 Major；仍不能判定为发布就绪。release run `35063014155` 已证明标签 `v0.1.0-rc.4`（提交 `acb7c8c`，含 P11 修复与新 logo）在 Windows x64、macOS Intel x64 与 macOS arm64 的源码 Electron、安装包、包验证及打包应用冒烟全流程通过，并发布为明确标注未签名/未公证的 Pre-release；真实服务器、真实格式、安装、手工桌面行为、最低系统和物理听音仍未完成，因此仍不能宣称发布就绪。
