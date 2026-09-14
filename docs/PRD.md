# Sonavi 产品需求

状态：P01～P10 已按序实现到当前发布前代码闸门；P10 的 macOS Intel 未签名 DMG 已验证，三目标最新 CI与正式签名/公证/实机发布验收未完成
更新日期：2026-09-15

## 产品目标

Sonavi 是个人使用优先、非网页套壳的 Navidrome/Subsonic/OpenSubsonic 桌面音乐客户端。从第一版开始，Windows 与 macOS 是地位相同的正式支持平台：

- Windows 11 x64；
- macOS 13+ Intel x64；
- macOS 13+ Apple Silicon arm64。

同一仓库、同一工程和同一核心业务代码分别构建三种目标。当前开发主机只能证明其实际执行过的目标；其他目标保留在正式范围并标记待验证。

## 第一版共享功能范围

两个平台共用 Navidrome/Subsonic/OpenSubsonic 客户端、认证业务、音乐库、搜索、收藏、歌单、AudioEngine、播放队列、歌词、缓存、设置、组件、导航、页面布局、播放器和交互逻辑。

阶段顺序沿用 P01～P10：工程基础 → 认证连接 → 最短播放链路 → 播放核心 → 音乐库 UI → 收藏歌单 → 歌词上报 → 转码网络诊断 → 桌面集成性能 → 打包发布前审计。P01～P10 已按序落地到当前代码闸门；P02～P09 的真实服务和实机缺口继续保留，P10 的签名、公证、最低系统和三目标安装验收也继续诚实标记为未验证。

## P01 验收范围

- 一套可运行 Electron + Vue + TypeScript 工程；
- 共享的 Sonavi 连接页与应用外壳；
- 安全的 main/preload/renderer 边界；
- 必要且集中的平台适配入口；
- Windows x64、macOS x64、macOS arm64 构建入口；
- 可真实执行的 lint、typecheck、test、build 与 Electron 冒烟；
- 分平台兼容性与验证记录。

P01 的上述验收项已经完成。P02 已实现公共 Subsonic/OpenSubsonic 连接、认证、能力探测、CredentialStore 加密保存/跨重启恢复/删除、会话退出与错误诊断。P03 实现真实专辑列表/详情、不透明媒体协议和流式播放/暂停/seek。P04 实现枚举播放状态机与内存队列。P05 实现首页、全部专辑、艺术家/详情、可取消分页搜索与设置入口；收藏歌单、持久化恢复、托盘和完整桌面集成仍按后续阶段推进，不能回退假数据。

## P04 验收范围

- 状态明确区分 `idle/loading/playing/paused/buffering/seeking/ended/error`，组件不使用独立布尔值猜测状态；
- renderer 全局只有一个 AudioEngine，切换页面或卸载播放器组件不会自动停止播放；
- generation/命令序号隔离连续快速切歌、加载中暂停和迟到的 `play()` Promise；
- 队列项使用本地 `queueEntryId`，并携带 server/account/session 范围；同一 `trackId` 可重复出现；
- 支持替换、追加、删除、清空、重排、上一首、下一首、顺序、稳定随机历史、单曲循环和列表循环；
- 自然 `ended` 在单曲循环时重播当前项，手动下一首仍切到下一项；恢复来源默认暂停且不复用失效媒体句柄；
- P04 阶段不实现队列落盘、后台播放宿主或系统媒体键；这些能力已在后续 P09 按独立边界实现。

## P05 验收范围

- 首页最近添加与全部专辑使用真实、可分页的公共协议数据，不伪造推荐或历史。
- 艺术家列表和详情来自 `getArtists` / `getArtist`；长列表只渲染可见窗口。
- 搜索使用 `search3`，具备 300ms 防抖、过期请求取消、分页、加载/空/错误/重试状态。
- 艺术家、专辑和歌曲结果进入共享详情或 P04 播放队列，元数据只按纯文本展示。
- 设置页保留安全断开与忘记账号；收藏/歌单写操作明确留在 P06。

## P06 验收范围

- 收藏列表与艺术家、专辑、歌曲上的收藏/取消收藏使用公共 `getStarred2`、`star`、`unstar`，成功后重新读取服务器事实，不乐观伪造成功。
- 歌单使用公共 `getPlaylists`、`getPlaylist`、`createPlaylist`、`updatePlaylist`、`deletePlaylist`；支持创建、重命名、公开状态、删除、追加当前队列、按歌曲索引移除与整单播放。
- 重复歌曲以歌单位置索引删除；创建或追加时保留当前队列顺序与重复项。
- 所有写操作由 main 持有凭据，renderer 只传当前会话、受限资源 ID、名称、布尔值、歌曲 ID 数组或非负索引；IPC 两侧均做运行时校验。
- 权限、会话或服务器失败保留已有查询数据并显示安全错误；P06 不实现本地离线副本、歌词、播放上报或队列持久化。

## P07 验收范围

- 服务器声明 `songLyrics` 扩展时使用公共 `getLyricsBySongId` 读取结构化歌词；否则使用公共 `getLyrics` 获取旧版非同步歌词，不依赖 Navidrome 私有接口。
- renderer 只取得受校验的歌词文本、语言、偏移量和毫秒时间戳；同步歌词按唯一 AudioEngine 的当前进度高亮，非同步歌词、无歌词、加载和安全错误均有明确界面。
- 实际进入 `playing` 后使用公共 `scrobble` 发送一次 now-playing；累计真实播放达到 `min(曲长 50%, 240 秒)` 后发送一次 submission，同一队列项不因 timeupdate、seek 或组件重绘重复上报。
- seek 跳跃不计入累计真实播放时长；上报失败不打断音频，也不暴露凭据、认证参数、服务 URL 或任意端点能力。
- P07 不实现歌词编辑/上传、本地歌词扫描、增强歌词 v2、离线缓存、转码策略、后台播放宿主或队列持久化。

## P08 验收范围

- 提供原始、MP3 兼容转码与自动播放策略，并提供受限码率设置；不承诺所有编解码器。
- 自动回退最多一次，用户能看到实际播放模式和原因；失败后进入明确错误态。
- 只有服务器声明 `transcodeOffset` 时允许转码 seek，并保证播放器、歌词和上报使用完整歌曲时间线。
- API、封面和音频使用同一 Electron Session 的系统/直连/手动代理策略；切换代理关闭旧连接，失败不直连兜底。
- 诊断区分 API、封面、原始音频和转码音频，记录脱敏状态、类型、分类、耗时和建议，并限制导出大小。
- P08 不实现认证代理、自动 PAC 编辑、证书忽略、离线缓存、托盘/Dock、后台 AudioEngine、媒体键或发布安装器。

## P09 验收范围

- 默认关闭动作在两端均为隐藏同一个 BrowserWindow 并继续播放，设置可改为真正退出；最小化始终保留播放宿主。
- Windows 托盘与 macOS 菜单栏共用“显示、播放/暂停、上一首、下一首、真正退出”能力；Dock/应用重新激活显示既有窗口，不重建 AudioEngine。
- 系统媒体键只走 Chromium Media Session，不同时注册 Electron 全局媒体快捷键；设置快捷键按 Windows `Ctrl+,` / macOS `Cmd+,` 区分，且它与空格播放键都不截获编辑控件。
- 锁屏/睡眠会暂停；恢复/解锁关闭旧网络连接、撤销旧媒体句柄并刷新数据，但不会绕过用户意图自动续播。
- Electron `userData` 保存主题、音量、关闭动作、窗口状态和非敏感暂停队列元数据；队列按 main 计算的账号哈希隔离，恢复时重新生成媒体句柄并保持暂停。
- 封面缓存按账号隔离，单项最多 5 MiB、单账号最多 128 MiB并按 LRU 淘汰；清空只作用当前账号。音频继续流式传输，不加入离线缓存。
- 固定 10,000 条合成艺术家数据验证窗口化 DOM 上限；源码与目录包记录启动、快速切页内存趋势和请求增量。真实资料库及另两目标需分别测量。
- P09 不实现自动更新、离线下载、安装签名、公证或 Release 发布，这些继续属于 P10/非首版范围。

## P10 验收范围

- 保持同一 electron-builder 配置和三个原生主机构建入口，安装包文件名包含版本、系统与架构；不生成 Universal 包。
- 构建后校验目标架构、应用标识、版本、最低系统、ASAR、运行时图标、签名状态和 SHA-256，并以打包应用复跑真实 Electron 冒烟。
- macOS 不声明未使用的相机、麦克风、蓝牙或音频采集权限；正式签名只使用最小 Electron JIT entitlements，不加入无需求的 library validation 例外。
- 构建期 `node_modules` 与 source map 不进入 ASAR；main 将唯一运行时 Zod 依赖内联，renderer/preload 安全边界不变。
- 用户数据继续只通过 `app.getPath('userData')`；同一隔离 userData 下的凭据、主题、音量、窗口与暂停队列跨进程重启恢复。首个 0.1.0 候选没有旧公开版本迁移样本，跨版本升级必须在后续候选实测。
- 未提供真实凭据时，包明确为未签名、未公证开发测试包；不得通过关闭 Gatekeeper、SmartScreen、TLS 或 Electron 安全开关完成验收。
- 未经用户授权不上传安装包、不创建 Release、不推送；完整发布闸门见 `docs/RELEASE-CHECKLIST.md`。

UI 技术路线保留原始开发提示中的 `shadcn-vue + Tailwind CSS`，并继续以项目内 Sonavi UI 包与 `tokens.css` 为视觉基准。shadcn-vue 以项目持有的组件源码方式增量引入，不重写既有页面。

## UX 与平台行为

两端共享石色/中性色、少量琥珀色、低动画和桌面应用布局。设计稿中的 macOS 外观只是视觉参考。

- P01 使用各平台原生窗口边框和控制按钮；不绘制假的红黄绿按钮。
- 快捷键提示由受限平台信息驱动：Windows 为 Ctrl，macOS 为 Cmd。
- 字体依次覆盖 Segoe UI、Microsoft YaHei UI、PingFang SC、Hiragino Sans GB、Noto Sans SC/CJK 与 system-ui。
- P09 起两端默认关闭窗口均隐藏同一个播放宿主；Windows 从托盘、macOS 从菜单栏或 Dock 重新显示。用户可在设置中改为关闭即真正退出。
- 最小化与隐藏不会销毁 renderer；“真正退出 Sonavi”、Windows 应用退出菜单及 macOS Cmd+Q 才终止进程与播放。

## 非首版强制目标

Windows ARM64、Linux、macOS Universal 合并包、自动更新、公开签名/公证发布、离线下载、插件市场、均衡器与高级音频引擎不因本轮平台修正扩大范围。
