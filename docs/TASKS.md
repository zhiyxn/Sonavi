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

## 当前阶段：P04 播放状态机与队列（本机代码闸门已完成）

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
- [ ] 提交并进入三目标 CI；当前 P04 工作区尚未提交。
- [ ] 物理扬声器/耳机听音验证；合成 WAV 的 `playing` 事件不等价于听音。

## 后续阶段（顺序保留）

- [ ] P02：真实服务器、Windows 11 与 Apple Silicon 外部环境验证（本机代码闸门已完成）。
- [ ] P03：外部服务器分页/格式及另两目标实机验证（本机实现已完成）。
- [ ] P04：Windows 11、Apple Silicon 与真实服务器队列/事件差异验证（本机代码闸门已完成）。
- [ ] P05：正式音乐库 UI 与搜索。
- [ ] P06：收藏与歌单管理。
- [ ] P07：歌词与播放上报。
- [ ] P08：转码、网络策略与诊断。
- [ ] P09：托盘/Dock、隐藏继续播放、真正退出、媒体键与性能。
- [ ] P10：安装包、签名/公证占位、兼容性与发布前审计。

## 尚需外部环境验证

- Windows 11 x64：依赖安装、开发启动、单元测试、生产构建、NSIS 打包、截图、菜单/关闭/重启。
- Apple Silicon macOS 13+：原生 arm64 依赖安装、开发启动、DMG 打包、截图、菜单/Dock/关闭与重激活。
- Intel Mac 的未签名 DMG 安装打开验证（目录包与开发启动不等于安装器验收）。
- P01、P02 与截至 `4d1777d` 的 P03 GitHub Actions 三平台矩阵均已通过。分页修复 `f2a39c9` 已提交并与本地 `origin/main` 对齐，本轮未取得其 CI 运行编号；P04 尚未提交/进入远端 CI。

## 当前闸门结论

P01 已达到验收条件。P02/P03 的本机代码闸门已通过；用户实际服务已证明连接、首批专辑和播放可用，分页修复通过 31 张专辑两页 Electron 冒烟。P04 的状态机、队列与当前 Intel Mac 代码闸门已通过，但真实服务器队列、Windows 11、Apple Silicon、格式差异和物理听音仍未验证，因此 P02～P04 均不能宣称双平台最终验收完成。
