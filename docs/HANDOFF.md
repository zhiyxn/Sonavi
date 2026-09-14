# 项目交接

更新日期：2026-09-14

## 当前目标

P01 已完成；P02～P05 的当前本机代码闸门已完成，继续等待真实服务器、Windows 11、Apple Silicon 及 P04/P05 远端 CI 证据。没有提前实现 P06 写操作或 P09 队列持久化/后台播放。

## 当前分支与最近已验证提交

- 分支：`main`
- 最近提交：`3b3fca2 feat(p04): 实现播放状态机与队列`
- 远端：本地 `main` 与 `origin/main` 均为 `3b3fca2`；本轮未核实对应 CI 编号
- 当前 P05 源码、测试和文档尚未提交；未发布或上传安装包

## 工作区未提交改动

工作区包含 P05 音乐库/搜索 UI、协议、IPC、测试和文档改动，均未提交。用户原有 `.gitignore` 与原始参考目录继续保留；`node_modules/`、`out/`、`release/`、`artifacts/` 和原始参考包不进入提交。

## 已完成代码

- P01 的单套 Electron 44/electron-vite 5/Vue 3/TypeScript 工程、安全窗口与平台适配保持不变。
- 三目标 GitHub Actions 构建矩阵；不上传产物，P01 提交的三个 job 均成功。
- P02 固定端点 OpenSubsonic 客户端：URL 规范化、token/salt 认证、能力探测、音乐文件夹与错误分类。
- P02 连接 IPC/preload/renderer 流程；renderer 无任意网络或 Node 能力。
- P02 CredentialStore 加密保存、跨进程重启恢复、密钥轮换重加密、幂等删除与 `session-only` 失败策略。
- 连接 IPC 新增受限 restore/disconnect/forget；退出、忘记账号和会话轮换会清查询/播放状态、撤销旧句柄并中止活动媒体流。
- 协议 fixture、凭据文件、共享 UI 与真实 Electron 冒烟测试。
- 原始提示中明确指定的 Tailwind CSS 4 + shadcn-vue 基础：`components.json`、Vite 插件、theme/token 映射、alias、`cn()` 与 Button 组件源码。
- P03 `getAlbumList2` / `getAlbum`、带 `offset/size` 校验的分页音乐库 IPC、每页 30 张的加载更多界面与 Pinia 会话状态；分页修复已提交为 `f2a39c9`。
- P03 随机会话/媒体句柄、`sonavi-media` scheme、严格 CSP、Electron Session 流式 `getCoverArt` / `stream` 与 Range。
- P04 枚举 AudioEngine 状态、generation/命令隔离、唯一活动 HTMLAudioElement 宿主和共享 PlayerBar。
- P04 队列按 `queueEntryId` 管理重复歌曲，携带 server/account/session 范围；支持替换、追加、选择、删除、清空、重排、顺序/随机、上一首/下一首、单曲/列表循环和音量。
- P04 队列只在当前 renderer 会话内存中；持久化恢复、托盘和后台宿主仍留到 P09。
- P05 首页/全部专辑分别使用 `newest` 与 `alphabeticalByName`；艺术家、艺术家详情和 `search3` 均走共享 OpenSubsonic 客户端。
- P05 搜索 300ms 防抖、分页缓存，并以随机 requestId + 固定 cancel IPC 中止过期请求；断开或切换会话也取消该会话的活动搜索。
- P05 艺术家长列表窗口化；搜索结果的艺术家/专辑进入共享详情，歌曲复用 P04 队列。收藏与歌单仍为 P06 禁用入口。

## 已执行自动验证

- `npm run lint`：通过，0 warning。
- `npm run typecheck`：通过，main/preload、renderer、tests 三组均通过。
- `npm test`：通过，13 个文件、60 项测试。
- `npm run build` / `npm run test:e2e` 内建构建：通过；main、sandbox CJS preload、renderer 均产出。
- `npm run pack:dir`：通过，重新生成含 P05 的 `release/0.1.0/mac/Sonavi.app`（未签名 x64 目录包）。
- 生产构建冒烟：真实 Electron Session 连接本地 `127.0.0.1` fixture；31 张专辑分两页加载，3 首专辑队列、艺术家/详情、专辑详情、300ms 搜索、播放/暂停/seek 均通过。既有凭据、媒体和 macOS 生命周期检查继续通过。
- 包内冒烟：刚生成的未签名 macOS x64 `Sonavi.app` 完整复跑上述 P05 流程，并通过 960×640 无应用级横向溢出检查。
- P01 与 P02 远端 CI：Windows x64、macOS Intel x64、macOS arm64 均完成 install、lint、typecheck、unit/component、Electron smoke 和对应平台打包。

## 已执行真实服务器与实机验证

用户已在实际服务完成连接、读取首批专辑并成功播放，证明基础真实服务链路可用；分页修复和 P04 多曲队列尚待用户在该服务复验，服务地址、账号和凭据没有写入项目或日志。物理扬声器/耳机听音、转码差异仍未单独记录。Windows 与 Apple Silicon 无可用实机。

## 关键架构与安全决策

见 `docs/DECISIONS.md`。最关键的是：Windows/macOS 首版同等支持、共享一套 renderer、平台差异集中、原生窗口控件、renderer 无 Node/process；连接使用公共 token/salt 认证、禁止自动重定向和明文凭据回退。

## 当前问题和最小复现

当前没有已知的 P05 阻断问题。`getArtists` 按协议一次返回完整索引，renderer 已窗口化渲染，但超大真实资料库仍需验证 1 MiB 响应安全上限是否需要后续兼容策略。受控 fixture 也不能代替各服务器的搜索排序和字段差异。

## 未验证项

- Windows 11 x64 全部人工运行、安装、UI、菜单与关闭行为。
- Apple Silicon macOS arm64 全部人工运行、安装、UI、菜单与关闭行为。
- Intel Mac 的未签名 DMG 安装、签名、公证。
- 真实 Navidrome/OpenSubsonic 与反向代理组合。
- Windows/macOS arm64 的 safeStorage 实机行为，以及签名后 macOS Keychain 升级稳定性。
- 真正退出时活动音频停止已验证；托盘、Dock 后台播放宿主仍属于 P09。

## 下一项可执行任务

先在用户实际服务复验全部专辑分页、艺术家详情、中文/英文搜索、多页及无结果，再复验 P04 多曲队列。确认后提交并推送 P05，运行三目标 CI；外部证据无法取得时，下一开发阶段按顺序进入 P06 收藏与歌单，但不得把缺少的实机验证标成已通过。

## 不应重做或覆盖的内容

- 不重新初始化项目，不建立第二套 Windows/Mac 前端。
- 不修改/删除 `Sonavi_UI_v0.1/` 与 `navidrome-vibe-coding-kit/` 原始解压参考。
- 不把任何平台改成“后续适配”。
- 不提前实现 P06～P10，也不放宽 Electron 安全设置；P05 不顺带实现收藏/歌单写操作或 P09 的后台宿主与持久化。
