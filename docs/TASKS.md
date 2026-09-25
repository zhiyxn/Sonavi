# Sonavi 任务清单

更新日期：2026-09-25

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
- [x] `getAlbumList2` 使用受校验的 `offset/size` 分页；界面每页加载 30 张并使用 shadcn-vue Pagination 显式翻页。
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

- [x] 首页与专辑页共享 LibraryPanel；首页使用 `newest`，全部专辑使用 `alphabeticalByName`，两者使用 shadcn-vue Pagination 并分别保留当前页。
- [x] 实现 `getArtists`、`getArtist`、`search3` 的协议解析、main 服务、IPC 与 preload 固定方法。
- [x] 艺术家列表使用固定行高窗口化，只渲染可见区与 overscan；详情显示服务器返回的真实专辑。
- [x] 搜索只在用户按 Enter 或点击搜索按钮时提交；TanStack Query 按会话/查询分页缓存，并通过受限取消 IPC 中止过期主进程请求。
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
- [ ] Windows 11 x64 NSIS/EXE 已由用户确认可正常安装、启动、真实播放和卸载，账号/设置数据保留未发现问题；人工图标、开始菜单与完整桌面行为仍待单独验收。
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

## P12：Windows + macOS 真机回归（进行中）

- [x] 建立只使用 `PASS` / `FAIL` / `BLOCKED` / `NOT TESTED` 的 P12 真机矩阵。
- [x] 从 `fe5b07a` 构建并验证 Windows x64 未签名 `0.1.0-rc.4` 测试包；没有发布或上传。
- [x] 启动 Windows `win-unpacked` 测试包进程。
- [ ] 执行 Windows 登录、音乐库、播放、网络、歌词和生命周期矩阵；正确账号认证与跨进程凭据恢复已由用户人工确认 `PASS`，其余继续测试。
- [ ] 完成 Windows 托盘、任务栏、媒体键、窗口状态和未签名包人工验证。
- [ ] 在 macOS Intel x64 与 Apple Silicon arm64 实机执行同一矩阵；当前缺少可控制实机，状态为 `BLOCKED`。
- [ ] P12-MI-001：打开队列定位当前歌曲已完成小范围代码修复与回归测试准备；待新 Windows 包真机复验后关闭。
- [ ] P12-MI-002：队列当前歌曲标题在浅色与深色主题下均有对比问题，已改为主题正文色并保留强调标记；按用户要求统一真机复验。
- [ ] P12-MI-003：主播放/暂停按钮图标对比不足已隔离通用按钮样式；按用户要求与本批其余问题统一构建、统一真机复验。
- [ ] P12-MI-004：点击播放器其他区域关闭队列已完成局部交互修复；按用户要求与本批其余问题统一构建、统一真机复验。
- [ ] P12-MI-005：七个页面栏目眉题的无意义重复序号已统一移除；按用户要求与本批其余问题统一构建、统一真机复验。
- [ ] P12-MI-006：艺术家完整索引已改为当前连接会话内复用，避免 30 秒后切页/聚焦重复慢请求；首次全量请求仍待真实服务器计时复验。
- [ ] P12-MI-007：可用按钮小手、禁用按钮不可操作光标已加入全局样式；按用户要求与本批其余问题统一构建、统一真机复验。
- [ ] P12-MI-008：已取得 operation=`scrobble`、无 HTTP 状态且 12014 ms 超时的真实脱敏诊断；修复上一首失败后新条目已在 playing 时漏发 now-playing 的状态机缺口，仍需原服务器复验超时根因与播放计数，不盲目重试未知结果。
- [ ] P12-MI-009：播放栏已改为优先显示当前歌曲封面，无封面保留占位符；按用户要求与本批其余问题统一构建、统一真机复验。
- [x] 本批统一自动闸门和 Windows x64 未签名包已完成：lint、typecheck、25 文件/130 项测试、生产构建、`build:win` 与包验证通过；待集中真机复验后逐项更新状态。
- [x] P12-MI-010：专辑详情返回恢复列表滚动位置已完成；Windows 当前构建 `LIB-02` 复验通过，macOS 待验。
- [x] P12-MI-011：首页、专辑、艺术家、搜索、收藏、歌单及详情切换后恢复各自滚动位置，设置页每次回到顶部；Windows 当前构建 `LIB-07` 复验通过，macOS 待验。
- [ ] P12-MI-012：搜索进入艺术家详情再打开专辑时保留艺术家菜单与返回上下文已完成；返回恢复原艺术家详情位置且不额外请求完整专辑列表，25 文件/134 项全量测试、lint、typecheck 与生产构建通过；当前运行包不包含，等待下一统一包真机复验。
- [x] P12-MI-013：专辑详情已改为固定外层页面、仅歌曲列表内部滚动并支持键盘焦点；Windows 当前构建 `LIB-02` 复验通过，macOS 待验。
- [ ] P12-MI-014：搜索已改为 Enter 或搜索按钮显式提交，输入过程不再自动请求；26 文件/136 项全量测试、lint 与 typecheck 通过，当前运行包不包含，等待下一统一包真机复验。
- [ ] P12-MI-015：艺术家列表页已关闭 workspace 外层滚动，虚拟列表按剩余高度自适应并独立滚动；定向测试 15/15、26 文件/137 项全量测试、lint 与 typecheck 通过，当前运行包不包含，等待下一统一包真机复验。
- [ ] P12-MI-016：首页与专辑已从滚动自动续载改为项目持有的 shadcn-vue Pagination；每页 30 张，支持页码、上一页/下一页，两个栏目分别保留当前页，翻页后置顶。26 文件/139 项测试、lint 与 typecheck 通过；按用户要求未重新构建或启动应用，当前运行包不包含该改动。
- [ ] P12-MI-017：错误提醒已统一接入 shadcn-vue Sonner；阻断页面的加载错误保留原地重试。删除歌单与退出并忘记账号改为持久 Sonner 的确认/取消动作，取消或关闭不执行，确认后才调用原有受限服务。28 文件/144 项测试、lint 与 typecheck 通过；未重新构建或启动应用。
- [x] P12-MI-018：首页、专辑、艺术家、搜索、收藏和歌单保留页面实例并复用当前连接会话查询缓存；Windows 当前构建 `LIB-07` 复验通过，macOS 待验。
- [ ] P12-MI-019：renderer 通用输入、复选、标签、选择、滑块和危险确认已统一为项目持有的 shadcn-vue Input、Checkbox、Label、Select、Slider 与 AlertDialog；Sonner 仅保留通知职责，导航、实体卡片和虚拟列表等业务组件继续使用语义化按钮。Node.js 22.21.1 下 lint、typecheck、28 文件/147 项测试、生产构建和 Windows 源码 Electron 完整冒烟通过；当前运行真机测试包不含该改动，等待统一打包复验。
- [ ] P12-MI-020：播放进度/音量 Slider 错位、播放控制区不在窗口几何中心、艺术家缓存页列表需滚动才重绘均已修复。Node.js 22.21.1 下 lint、typecheck、28 文件/148 项测试、生产构建和 Windows 源码 Electron 冒烟通过；等待当前源码预览人工复验。
- [ ] P12-MI-021：清空当前账号封面缓存与断开连接已增加 shadcn-vue AlertDialog 二次确认，Sonner 关闭按钮已移到右上。lint、typecheck、28 文件/148 项测试、生产构建与 Windows 源码 Electron 冒烟通过；待当前预览人工复验及下一统一包。
- [ ] P12-MI-022：专辑网格封面改为视口附近懒加载，main 对缓存未命中的封面上游请求设置全局 6 并发；`getAlbumList2` 每页最多自动重试一次，诊断增加脱敏 listType/page/size 与尝试序号（当前整体 schema v3）。lint、typecheck、28 文件/153 项测试、生产构建和 Windows 源码 Electron 冒烟通过；等待真实服务器复验。
- [ ] P12-MI-023：AudioEngine 缓冲状态增加脱敏 `buffer-start` / `buffer-end` 诊断和持续时间，严格 IPC 拒绝歌曲 ID、URL、会话及任意多余字段；Logo 区域通过 main 固定白名单在系统浏览器打开 Sonavi GitHub。lint、typecheck、29 文件/157 项测试、生产构建和 Windows 源码 Electron 完整冒烟通过；等待真实网络缓冲与浏览器打开真机复验。

## P13：稳定性修复（已停止，等待 P14）

- [x] 以 `docs/KNOWN-ISSUES.md` 为唯一 Bug 输入源核对优先级。
- [x] P13-CR-001：已用真实脱敏日志确认 FLAC 原始流 seek 后出现长时间缓冲，并用回归测试复现下游取消时上游 fetch 没有中止。
- [x] P13-CR-001：最小修复为媒体流取消时主动 `abort()` 上游请求；媒体协议定向测试 17/17 通过。
- [x] P13-CR-001：修复受控 Slider 在拖动期间被旧播放时间覆盖的问题；拖动保留临时值，松手仅提交一次 seek，播放器定向测试 18/18 通过。
- [x] P13-CR-001：移除“播放超过 3 秒时上一首重播当前歌曲”的隐式语义；seek 后上一首仍切换前一队列项，播放器定向测试 19/19 通过。
- [x] P13-CR-001：完整 lint/typecheck/test（29 文件/159 项）与生产构建已通过；Windows 人工 `PLAY-02` 复验通过并关闭。
- [x] P13-CR-002：深色连接页输入框已从固定白底改为主题背景；样式定向测试 5/5、全量 29 文件/160 项、lint、typecheck 与生产构建通过，Windows 目视复验通过。
- [x] P13-CR-003：renderer 清空队列和 main 无条件撤销媒体流/句柄均已修复；相关 3 文件/31 项、lint、typecheck、29 文件/162 项测试与生产构建通过，Windows 真机再次复验通过。
- [ ] 已登记 P13-MA-001～P13-MA-005 与 P13-MI-001；按优先级未实施。
- [x] Blocker/Critical 已全部清零，P13 停止并等待 P14；未处理 Major/Minor 或格式展示等新功能。

## P14：剩余稳定性问题（进行中）

- [ ] P13-MA-001：Windows 真机真实同步歌词 seek 自动滚动已通过；macOS Intel/arm64 未验证。
- [ ] P13-MA-002：Windows 真机主内容点击关闭队列已通过；macOS Intel/arm64 未验证。
- [x] P13-MA-003：Windows 当前构建已由 `LIB-02` / `LIB-07` 真机复验通过；macOS Intel/arm64 仍需分别验证。
- [ ] P13-MA-004：Windows 真机删除当前项和非当前项后队列保持展开已通过；macOS Intel/arm64 未验证。
- [ ] P13-MA-005：Windows 真机断开后无凭据回填并通过系统加密账号恢复会话已通过；macOS Intel/arm64 未验证。
- [ ] P13-MI-001：Windows 真机侧栏按钮聚焦时 `Ctrl+,` 已通过；macOS `Cmd+,` 未验证。
- [x] 6 个逻辑问题均完成最小代码修改和逐项自动闸门；不夹带功能增强。
- [x] 最终合并 lint、typecheck、29 文件/166 项测试与生产构建通过；包含全部修复的 Windows 源码预览已启动。

## P15：macOS 播放日志稳定性修复（进行中）

- [x] 分析 macOS schema v3 脱敏日志：171 条中 8 次 `getArtists` 固定超时、一次 MP3 转码流 HTTP/2 中断、导出时一段缓冲未结束；封面、专辑、歌词和 5 次 scrobble 均成功。
- [x] `getArtists` 改为独立 45 秒超时并关闭 renderer 自动重试；其他 API 保持 12 秒，完整索引继续受 16 MiB 上限保护。
- [x] AudioEngine 增加 30 秒缓冲看门狗，超时释放旧宿主；player 对可保持位置的流错误/缓冲超时按队列项最多自动恢复一次。
- [x] API 诊断升级 schema v4，正文读取超时时保留状态、内容类型、响应头耗时和已读字节数，不增加身份或正文数据。
- [x] 修正 Electron 冒烟对 P14 首页详情持久化语义的旧假设；不修改产品行为、不放宽断言。
- [x] Node.js 22.19.0 下 lint、typecheck、29 文件/172 项测试、生产构建与 macOS Intel 源码 Electron 完整冒烟通过；诊断裁剪导出分支同样固定为 schema v4。
- [ ] 在真实 macOS 服务器复验艺术家索引能否在单次 45 秒内完成、30 秒缓冲看门狗和一次自动恢复；HTTP/2 错误仍需对照反向代理/Navidrome 日志。
- [ ] Windows 11 x64 与 macOS arm64 实机复验；当前自动结果不替代对应平台结论。

## P12 流程重走：当前源码 macOS Intel x64（进行中，2026-09-19）

- [x] 以当前 `main` / `67126ea` 为重走基线，不回退旧 P12 起点 `fe5b07a`，保留 P13～P15 的后续修复。
- [x] 核对 macOS 13.7.8 Intel x64、Node.js 22.19.0、npm 10.9.3、Electron 44.3.0 与已安装依赖。
- [x] 执行 lint、三组 typecheck、29 文件/172 项 Vitest 和生产构建；全部通过，构建只有既有 Zod PURE 注释位置提示。
- [x] 执行当前源码 Electron 完整冒烟；沙箱内进程启动受限，在获准使用本机桌面环境后同一命令通过。
- [x] 生成 macOS x64 未签名 `0.1.0-rc.4` DMG；没有发布、上传或修改 GitHub Release。
- [x] 完成包验证：x64、`com.sonavi.desktop`、版本 `0.1.0-rc.4`、最低 macOS 13.0、ASAR 2,117,420 字节、签名状态 `unsigned`；DMG SHA-256 为 `5a37c6579b978d03c17607f9528d2fb05018dc14914c7cbb634929b9a24b17ec`。
- [x] 完成 macOS x64 打包应用 Electron 完整冒烟；启动样本 1189 ms，20 轮切页内存增量 52,652 KiB、媒体请求增量 0。
- [x] 已启动本轮验证后的 `release/0.1.0-rc.4/mac/Sonavi.app`，进入真实人工矩阵；启动动作本身不计作任何人工用例通过。
- [x] macOS Intel 未签名测试包已自动恢复加密账号并进入真实主界面；本轮 `A-01`、`A-06`、`UI-01` 为 `PASS`，未记录服务器或账号信息。
- [x] macOS Intel 应用外壳与首批只读音乐库复验通过：`UI-02`、`UI-03`、`LIB-01`、`LIB-03`、`LIB-05` 均为 `PASS`。
- [x] `P12R-MA-001`：搜索与收藏分别持有自己的专辑详情状态，进入详情不再切换左侧栏目，返回原来源并恢复缓存页面；自动回归通过，状态 `RETEST`，待 macOS Intel 真机复验 `LIB-07`。
- [x] `P12R-MA-002`：搜索与收藏分别持有艺术家详情及其专辑链路，左侧保持来源栏目并支持逐级返回；自动回归通过，状态 `RETEST`，待 macOS Intel 真机复验 `LIB-06`。
- [x] macOS Intel 第二批音乐库只读复验：`LIB-02`、`LIB-04` 为 `PASS`。
- [x] macOS Intel 基础播放批次通过：`PLAY-01`、`PLAY-02`、`PLAY-04`、`PLAY-05`、`PLAY-06`、`UI-04` 均为 `PASS`，覆盖真实听音、原始流 seek、快速切歌、队列交互、封面/主按钮和播放器布局。
- [x] `P12R-MA-003`：播放策略变化现在重取缓存媒体查询并为现有队列重建播放句柄；支持转码偏移时当前歌曲从原进度切换，不支持时当前流保持、下一曲使用新策略。队列不清空，状态 `RETEST`，待 macOS Intel 真机复验 `PLAY-03`。
- [x] `P12R-MI-001`：歌词容器保留纵向滚动与程序化定位，但隐藏 Firefox/WebKit 视觉滚动条；样式回归通过，状态 `RETEST`，待 macOS Intel 真机复验 `PLAY-11`。
- [x] 四项修复及当前/下一曲补充要求完成后通过 lint、三组 typecheck、29 文件/177 项 Vitest、生产构建、源码 Electron 冒烟、macOS x64 包验证及打包应用完整冒烟；当前 DMG SHA-256 为 `cf4f8d7ef6c98a4c16ae732b5ec961df4e4f50fa989cd99bca753efbfc762efb`。
- [x] macOS Intel 高级播放已确认 `PLAY-07`、`PLAY-08`、`PLAY-09` 为 `PASS`。
- [x] macOS Intel `SET-01`、`SET-02`、`SET-03`、`SET-04`、`UI-05` 与 `LIB-08` 已由本机真实应用自动操作确认 `PASS`：覆盖确认取消/执行、缓存清理、封面加载期间持续播放、安全断开/重连、设置跨重启、分页诊断和通知关闭。
- [ ] `SET-05` 的实时诊断隐私检查通过，schema v4 也有既有自动回归；但本轮未操作原生保存对话框生成真实导出文件，人工导出仍为 `BLOCKED`。
- [x] 完成检查后已关闭临时仅监听 `127.0.0.1` 的调试实例，确认端口关闭，并按普通方式重新打开未签名测试包。
- [ ] 继续执行 macOS Intel 音乐库、真实播放/听音、歌词、诊断、队列、设置与页面状态人工矩阵。
- [ ] 人工验证 macOS 菜单栏/Dock、`Cmd+,`、关闭隐藏/重新激活、真正退出、锁屏/睡眠与恢复。
- [ ] 真实服务器复验 P15 的单次 45 秒艺术家索引、30 秒缓冲看门狗和一次自动恢复；只导出 schema v4 脱敏诊断。
- [ ] Windows 11 x64 与 macOS arm64 本轮仍未执行，不用当前 macOS Intel 结果替代。

## P16：歌曲格式展示（代码完成，待真机复验，2026-09-19）

- [x] 确认公共协议返回的受校验 `contentType` 已随 `TrackSummary` 进入 renderer，无需新增端点、权限或媒体 URL 暴露。
- [x] 在播放器当前歌曲信息中展示规范化源格式；原始流明确显示源格式，兼容转码明确显示源格式到 MP3 的关系，缺失或异常类型安全降级为“未知格式”。
- [x] failure-first 回归先确认旧实现只显示播放模式；实现后定向 2 文件/31 项、lint、typecheck、29 文件/178 项全量测试、生产构建与源码 Electron 完整冒烟通过。
- [x] 更新产品、架构、决策、测试报告、人工用例和交接记录；2026-09-20 用户确认 `PLAY-12` 真实格式矩阵通过，本结果不替代未单独执行的平台验收。

## P17：设置页安全重启（代码完成，待真机复验，2026-09-19）

- [x] 研究现有退出准备、暂停队列持久化、桌面生命周期、IPC 与设置页确认交互。
- [x] 增加无参数、可信发送者限定的重启 IPC；main 安排 Electron relaunch 后复用最长 5 秒的既有安全退出准备流程，并防止重复安排。
- [x] 设置页增加 AlertDialog 二次确认；取消不调用 IPC，确认后才请求重启。
- [x] failure-first 回归覆盖确认边界和单次 relaunch/quit；lint、typecheck、30 文件/180 项全量测试、生产构建与源码 Electron 完整冒烟通过。
- [x] 更新产品、架构、决策、测试、人工用例和交接文档；Windows 11 x64、macOS Intel x64 与 macOS arm64 的实际确认重启均标为未验证。

## P18：搜索结果布局与专辑歌曲数量（代码完成，待真机复验，2026-09-20）

- [x] 首页、全部专辑、艺术家详情、搜索和收藏中的全部专辑列表统一展示受校验的 `songCount`；名称允许省略，但歌曲数量独立且不收缩。未新增请求、IPC 或私有 API。
- [x] 搜索框与按钮使用相同 50px 高度；宽屏下歌曲结果与艺术家/专辑发现区并排，窄屏时歌曲区优先展示。
- [x] 搜索由滚动续载改为项目持有的 shadcn-vue Pagination；每页最多 25 条同类结果，翻页替换当前页并回到页面顶部，末页禁用下一页。
- [x] failure-first 回归先确认旧界面没有分页控件；实现后 lint、三组 typecheck、31 文件/186 项 Vitest、生产构建与 Windows 源码 Electron 完整冒烟通过。
- [x] `LIB-09` 真实大型搜索结果、独立分页及五个专辑入口歌曲数量已由用户确认通过；本结果不替代 macOS Intel x64、macOS arm64 与对应安装包的单独验收。

## P19：慢响应与封面队列治理（Windows 封面/诊断通过，搜索/收藏失败路径待复验，2026-09-20）

- [x] 根据用户提供的 schema v4 脱敏日志确认：13 次 API 超时均已收到 HTTP 200 响应头但正文未完成；搜索与收藏默认重试分别形成四次请求批次，封面队列存在分钟级积压。
- [x] 搜索和收藏读取设置 `retry: false`，保留明确刷新/重试；专辑列表既有的一次自动重试及所有写操作策略不变。
- [x] 列表封面进入视口附近才挂载，页面停用或卸载时移除图片节点；同一会话/资源复用加密封面 URL，复用索引每会话最多 10,000 项并随会话撤销清空。
- [x] 诊断升级为 schema v5，封面分别记录排队与上游耗时；已收到响应头后的正文超时使用准确提示，不新增身份、URL 或正文数据。
- [x] failure-first 定向回归在旧实现上 8 项失败；实现后 6 文件/62 项定向测试、lint、三组 typecheck、32 文件/193 项全量测试、生产构建与 Windows 源码 Electron 完整冒烟通过。首次全量测试仅暴露 2 条旧即时 `<img>` 断言，已按延迟加载语义修正；首次与第二次 E2E 分别暴露拆分元数据旧定位和只渲染最近 20 条诊断的测试定位，均只修测试后通过。
- [x] Windows 真实服务 `LIB-08` / `SET-05` 复验通过：94 条封面记录全部成功，总耗时最大 4.99 秒，全部包含 `queueMs/upstreamMs`；schema v5 导出未发现敏感字段、URL、资源身份或响应正文。
- [ ] 本次日志不含 `search3` / `getStarred2`，因此“搜索/收藏失败时每次只产生一个 API 请求”仍需在可复现该失败的慢服务上单独取证；macOS Intel x64、macOS arm64 与新安装包仍未验证。

## P20：搜索纵向布局与独立分页（Windows 真实大型库通过，macOS 待复验，2026-09-20）

- [x] 搜索结果固定按艺术家、专辑、歌曲上下排列，移除桌面双栏与窄屏歌曲提前规则。
- [x] 专辑和歌曲分别维护页码、分页控件、末页状态与查询 key；切换其中一类只改变对应 offset，另一类页码保持不变。
- [x] 根据真机截图将两个分页器与上方专辑/歌曲内容的间距统一为 20px，并加入 Electron 几何回归断言。
- [x] 扩展既有搜索请求/返回 schema，以一次公共 `search3` 请求传递 `albumOffset` 与 `songOffset` 并返回各自 `hasMore`；艺术家固定取首批结果，没有新增 IPC 通道、私有 API 或服务端写入。
- [x] failure-first 搜索面板 2 项按预期失败；最终相关 6 文件/57 项、独立分页 2 文件/7 项、lint、三组 typecheck、32 文件/194 项全量测试、生产构建与 Windows 源码 Electron 完整冒烟通过。
- [x] `LIB-09` 已由用户确认通过，覆盖真实大型搜索结果的两类独立分页、布局与专辑歌曲数量；未单独执行的 macOS Intel x64、macOS arm64 与新安装包仍保持未验证。

## P21：系统托盘安全重启（Windows 当前构建入口通过，macOS 待复验，2026-09-20）

- [x] Windows 托盘与 macOS 菜单栏新增“重启 Sonavi”，与显示、播放控制和退出保持在同一共享菜单模板。
- [x] 托盘入口直接调用 main 中既有幂等 `requestRestart()`，不新增 IPC、renderer 权限、命令行、路径或参数。
- [x] failure-first 定向用例首先因菜单缺少重启项而失败；实现后定向 1 文件/5 项、lint、三组 typecheck、32 文件/194 项全量测试、生产构建与 Windows 源码 Electron 冒烟通过。
- [x] Windows 当前已构建入口实际点击托盘重启通过：重启后主界面正常显示与操作，真实播放正常，且只检测到一个 Sonavi Electron 主进程。
- [x] Windows 设置页取消/确认重启分支由用户确认通过；`LIFE-06` 在 Windows 记为 `PASS`。
- [x] Windows 当前源码人工清单全部完成：`LIB-02` / `LIB-07` 最后复验通过，汇总为 37 PASS、0 FAIL、0 BLOCKED、0 NOT TESTED。
- [x] 收藏上下文进入艺术家专辑后，专辑详情返回文案由易产生栏目歧义的“返回艺术家详情”改为“返回艺术家专辑”；定向 11 项、lint、typecheck、194 项全量测试和生产构建通过，导航目标不变。
- [x] 重启 Windows 当前构建后，“返回收藏”→“返回艺术家专辑”两级文案与逐级返回由用户目视确认，未发现问题。
- [x] 用户确认 macOS Intel x64 真机已试用当前版本，未发现问题；该结论作为当前版本实机烟测，不替代未逐项点名的完整矩阵。
- [x] macOS Intel x64 菜单栏安全重启已由用户真机确认，单实例、加密账号、暂停队列和主界面恢复未发现问题；`LIFE-06` 在 macOS Intel 记为 `PASS`。
- [x] 用户确认 Windows EXE 与 macOS x64 DMG 均能正常安装、启动、播放并卸载，账号/设置数据保留未发现问题；由于未提供文件哈希或构建提交，只记本次安装包实机证据，不冒充最新 `main` 的重新打包结果。
- [ ] Apple Silicon arm64 因用户没有实机保持“未验证”；不得用 Intel 结果或 CI 产物代替运行验收。

## v0.1.0-rc.5 候选发布（完成，2026-09-20）

- [x] 版本推进到 `0.1.0-rc.5`，新增按标签读取的候选版说明。
- [x] README 改为面向下载与使用者，移除内部阶段、开发命令和历史流水线细节。
- [x] README 增加浅色歌单与深色专辑详情截图；图片使用受控 fixture 数据，不包含真实账号或服务器信息。
- [x] 项目采用 MIT License，并同步更新 npm 包元数据。
- [x] Node.js 22.19.0 下 lint、三组 typecheck、32 文件/194 项测试、生产构建与候选标签校验通过。
- [x] 推送 `v0.1.0-rc.5` 标签；release run `35517541553` 的 Windows x64、macOS Intel x64 与 macOS arm64 原生 release gate 及发布 job 全部通过。
- [x] Pre-release 已创建且不是 Latest；三个安装包、三个 manifest 与 `SHA256SUMS.txt` 共七个附件齐全。
- [x] main run `35517517625` 的 macOS Intel 打包冒烟暴露测试时间竞态：4 秒 fixture 在断开确认期间自然前进，旧断言比较了动作前标题与动作时最新索引。测试现先暂停并等待稳定状态；产品持久化逻辑未修改。

## P22：应用单实例与重复启动唤醒（代码完成，2026-09-21）

- [x] 为 Electron 主进程建立跨平台单实例锁；锁获取失败的后续进程不初始化窗口、服务或 IPC。
- [x] 已有实例收到 `second-instance` 时只恢复、显示并聚焦原窗口；初始化期间的重复启动在窗口就绪后补执行一次唤醒。
- [x] failure-first 单元测试覆盖主/次实例、初始化竞态与监听器释放；lint、typecheck、33 文件/198 项全量测试和生产构建通过。
- [x] Windows 源码 Electron 完整冒烟实际启动第二进程，确认后续进程退出、原 BrowserWindow/webContents 唯一且重新可见；macOS Intel/arm64 与新安装包仍未验证。
- [x] 修复提交 `7a67f01` 已推送到 `main`；`v0.1.0-rc.5` 更新到该提交后，release run `35553393327` 与 main run `35553362610` 三平台全部通过，rc.5 七个附件已替换。

## P23：服务器管理（代码完成，2026-09-21）

- [x] 将单账号 `credentials.v1.json` 安全迁移为最多 20 个账号的 `credentials.v2.json`；密码继续逐项使用 Electron `safeStorage` 加密，迁移或写入失败不删除旧密文、不回退明文。
- [x] 共享契约只向 renderer 暴露不透明 profile ID、服务器地址和用户名；提供列出、连接、删除以及成功连接后设为默认的受限 IPC。
- [x] 增加“服务器”管理页，支持添加、更新凭据、一键切换和删除非当前服务器；切换失败保留当前会话，成功后安全清理旧媒体与查询状态。
- [x] 连接页可直接选择已保存服务器；现有“断开连接”和“退出并忘记账号”语义分别保持为保留凭据与删除当前账号。
- [x] failure-first 覆盖迁移、加密多账号存储、切换失败边界、UI 管理操作；lint、三组 typecheck、35 文件/204 项全量测试、生产构建和 Windows Electron 冒烟通过。
- [x] 更新 PRD、架构、决策、测试报告、人工用例和交接记录；真实多服务器、macOS Intel x64、macOS arm64 与新安装包保持“未验证”。

## P24：深色模式歌词高亮对比度（代码完成，待用户复验，2026-09-21）

- [x] failure-first 样式测试确认同步歌词错误使用深色 `accent-subtle`，在深色歌词面板上的对比度仅约 1.28:1。
- [x] 高亮文字改用主题 `accent`，深色面板对比度提高到约 5.15:1；不修改同步、seek、滚动或播放逻辑。
- [x] 定向 2 文件/11 项、lint、三组 typecheck、35 文件/205 项全量测试和生产构建通过。
- [x] 用户确认当前 Windows 深色模式真实歌词复验未发现问题；macOS Intel x64、macOS arm64 仍未单独人工验证，新 rc.5 三目标自动包内冒烟通过。

## P25：服务器切换二次确认（代码完成，待用户复验，2026-09-21）

- [x] “切换”按钮只打开 shadcn-vue AlertDialog；取消或关闭不触发连接、播放或查询状态变化。
- [x] 用户确认后才提交目标 profile ID，并继续复用 P23 的失败保留当前会话、成功清理旧媒体与查询状态逻辑。
- [x] failure-first 组件测试覆盖取消与确认；lint、三组 typecheck、35 文件/205 项全量测试、生产构建和 Windows Electron 冒烟通过。
- [x] 用户确认当前 Windows 真实服务器交互未发现问题；macOS 未单独人工验证，新 rc.5 三目标自动包内冒烟通过。

## P26：音乐库导航、内嵌搜索与艺术家分页（代码完成，待真机复验，2026-09-25）

- [x] 删除首页栏目及页面状态，连接成功、恢复连接、断开重连后的默认栏目统一为“专辑”。
- [x] 新增“音乐”栏目，使用公共 OpenSubsonic `search3` 空查询按歌曲 offset/count 服务端分页浏览。
- [x] 删除独立“搜索”栏目与页面，将显式提交搜索分别集成到音乐、专辑和艺术家页面。
- [x] 扩展严格搜索契约，为艺术家、专辑、歌曲分别传递 offset/count，并分别返回下一偏移与 `hasMore`。
- [x] 艺术家列表改用公共 `search3` 空查询分页，不再依赖无分页的 `getArtists` 完整索引；详情继续使用 `getArtist`。
- [x] 保留专辑/艺术家详情来源、收藏来源链、查询缓存、请求取消、播放与收藏行为。
- [x] 增加 failure-first 协议、服务、组件和应用外壳回归，并更新 Electron 冒烟。
- [x] 执行 Node.js 22 的 lint、typecheck、全量测试与生产构建；更新 PRD、架构、测试报告和交接记录。
- [ ] Windows 11 x64、macOS Intel x64、macOS arm64 与真实大型 Navidrome 服务分别验证；当前只完成 macOS Intel 自动 fixture 冒烟，不替代真实服务或人工验收。

## P27：艺术家自然滚动与搜索条吸顶（代码完成，待人工复验，2026-09-25）

- [x] 移除艺术家列表固定 480px 内部滚动和工作区 `overflow: hidden` 特例；每页最多 50 位艺术家进入工作区自然文档流。
- [x] 删除内部艺术家滚动状态，复用应用外壳按栏目/详情保存的工作区滚动位置。
- [x] 音乐、专辑和艺术家列表页搜索条统一吸顶到工作区顶部 12px。
- [x] 搜索条与结果内容统一保留 32px 间距，解决专辑搜索框紧贴首行内容的问题。
- [x] 艺术家翻页后滚回搜索条区域；不改变服务端分页、详情、收藏和播放行为。
- [x] failure-first 样式/应用外壳断言在旧实现上失败；合并 rc.5 基线后 lint、三组 typecheck、35 文件/205 项全量测试、生产构建和 macOS Intel Electron 冒烟全部通过。
- [ ] macOS Intel 当前真实应用、Windows 11 x64、macOS arm64 与真实 50 项艺术家分页分别人工验证吸顶、滚动位置和窄窗口布局。
