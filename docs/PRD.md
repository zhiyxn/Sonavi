# Sonavi 产品需求

状态：P01～P07 已实现；P06 已通过三目标 CI，P07 已通过当前 Windows x64 源码与目录包代码闸门，三目标 CI、真实服务器与完整实机兼容性仍待验证
更新日期：2026-09-14

## 产品目标

Sonavi 是个人使用优先、非网页套壳的 Navidrome/Subsonic/OpenSubsonic 桌面音乐客户端。从第一版开始，Windows 与 macOS 是地位相同的正式支持平台：

- Windows 11 x64；
- macOS 13+ Intel x64；
- macOS 13+ Apple Silicon arm64。

同一仓库、同一工程和同一核心业务代码分别构建三种目标。当前开发主机只能证明其实际执行过的目标；其他目标保留在正式范围并标记待验证。

## 第一版共享功能范围

两个平台共用 Navidrome/Subsonic/OpenSubsonic 客户端、认证业务、音乐库、搜索、收藏、歌单、AudioEngine、播放队列、歌词、缓存、设置、组件、导航、页面布局、播放器和交互逻辑。

阶段顺序沿用 P01～P10：工程基础 → 认证连接 → 最短播放链路 → 播放核心 → 音乐库 UI → 收藏歌单 → 歌词上报 → 转码网络诊断 → 桌面集成性能 → 打包发布前审计。P01～P07 已按序落地；P06 实现提交 `a831be6` 的三目标 CI 已成功，P07 当前 Windows x64 代码闸门已通过。P02～P07 的真实服务和实机缺口继续保留，不提前实现 P08 网络诊断或 P09 后台播放。

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
- P04 不在本轮实现队列落盘、后台播放宿主或系统媒体键，这些仍属于 P09。

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

UI 技术路线保留原始开发提示中的 `shadcn-vue + Tailwind CSS`，并继续以项目内 Sonavi UI 包与 `tokens.css` 为视觉基准。shadcn-vue 以项目持有的组件源码方式增量引入，不重写既有页面。

## UX 与平台行为

两端共享石色/中性色、少量琥珀色、低动画和桌面应用布局。设计稿中的 macOS 外观只是视觉参考。

- P01 使用各平台原生窗口边框和控制按钮；不绘制假的红黄绿按钮。
- 快捷键提示由受限平台信息驱动：Windows 为 Ctrl，macOS 为 Cmd。
- 字体依次覆盖 Segoe UI、Microsoft YaHei UI、PingFang SC、Hiragino Sans GB、Noto Sans SC/CJK 与 system-ui。
- P01 中 Windows 关闭最后窗口即退出；macOS 关闭窗口但保留应用进程，可从 Dock 重新激活，真正退出使用应用菜单/Cmd+Q。
- “隐藏/关闭到托盘继续播放”与真正退出将在 P09 明确实现；P01 不声称支持后台播放。

## 非首版强制目标

Windows ARM64、Linux、macOS Universal 合并包、自动更新、公开签名/公证发布、离线下载、插件市场、均衡器与高级音频引擎不因本轮平台修正扩大范围。
