# 项目交接

更新日期：2026-09-14

## 当前目标

P01～P06 已按顺序落地。P05 已通过三目标 CI；P06 实现提交 `a831be6` 已推送并通过当前 Windows x64 主机的代码、Electron fixture 和目录包闸门，当前三目标 CI 结果与真实服务器写操作尚未验证。目标系统实机和物理听音缺口继续保留，不提前实现 P07 歌词/上报或 P09 队列持久化/后台播放。

## 当前分支与最近已验证提交

- 分支：`main`
- P06 实现提交：`a831be6 feat(p06): 实现收藏与歌单管理`
- 远端：P06 实现已推送至 `origin/main`；本状态文档随后单独提交
- P05 CI：run `34798063277` 的 Windows x64、macOS Intel x64、macOS arm64 三个 job 全部成功；未发布或上传安装包

## 工作区未提交改动

本轮从干净的 `b8b61d5` 开始，先修正文档中的 P05 陈旧状态，再开发 P06；实现、测试和主体文档已提交为 `a831be6` 并推送。用户原有 `.gitignore` 与原始参考目录继续保留；`node_modules/`、`out/`、`release/`、`artifacts/` 和原始参考包不进入提交。

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
- P05 艺术家长列表窗口化；搜索结果的艺术家/专辑进入共享详情，歌曲复用 P04 队列。
- P06 以公共 `getStarred2` / `star` / `unstar` 实现艺术家、专辑和歌曲收藏；收藏页以及现有浏览/搜索页面共用服务器事实刷新策略。
- P06 以公共歌单端点实现列表、详情、创建、重命名、公开状态、删除、追加当前队列、按索引删除重复歌曲和整单播放；旧服务器空成功响应不用于伪造本地实体。
- P06 共享类型、Zod 输入/输出 schema、受信 IPC/preload、main 会话/权限错误路径均已接通；renderer 仍不接触凭据、原始 IPC 或任意 URL。

## 已执行自动验证

- `npm run lint`：通过，0 warning。
- `npm run typecheck`：通过，main/preload、renderer、tests 三组均通过。
- `npm test`：通过，14 个文件、67 项测试。
- `npm run build` / `npm run test:e2e` 内建构建：通过；main、sandbox CJS preload、renderer 均产出。
- `npm run pack:dir`：通过，重新生成含 P06 的 `release/0.1.0/win-unpacked`（Windows x64 目录包）。
- 生产构建冒烟：真实 Electron Session 连接本地 `127.0.0.1` fixture；既有 P02～P05 链路继续通过，新增验证收藏同步、歌单创建/读取/重命名/公开/追加/按索引移除重复歌曲/删除。
- 包内冒烟：Windows x64 `win-unpacked` 完整复跑 P06 流程，并通过 960×640 无应用级横向溢出检查；截图为 `artifacts/screenshots/p06-windows-x64-package.png`。
- P05 远端 CI run `34798063277`：Windows x64、macOS Intel x64、macOS arm64 均完成 install、lint、typecheck、unit/component、Electron smoke 和对应平台打包。
- 当前 Windows x64 主机：生产构建、源码 Electron 冒烟、目录包冒烟、P05 截图、在线 `npm audit` 与 NSIS 生成通过；Node 使用 22.21.1，符合 engines 但不同于 `.nvmrc` 的精确 22.19.0。

## 已执行真实服务器与实机验证

用户已在实际服务完成连接、读取首批专辑并成功播放，证明基础真实服务链路可用；P06 未对该服务执行收藏或歌单写入。服务地址、账号和凭据没有写入项目或日志。物理扬声器/耳机听音、转码差异、Windows 11 正式版本及 macOS P06 实机仍未单独验证。

## 关键架构与安全决策

见 `docs/DECISIONS.md`。最关键的是：Windows/macOS 首版同等支持、共享一套 renderer、平台差异集中、原生窗口控件、renderer 无 Node/process；连接使用公共 token/salt 认证、禁止自动重定向和明文凭据回退。

## 当前问题和最小复现

当前没有已知的 P06 阻断问题。`getArtists` 按协议一次返回完整索引，renderer 已窗口化渲染，但超大真实资料库仍需验证 1 MiB 响应安全上限。P06 的歌曲数组通过 URL 重复参数传输，超大队列/歌单、不同服务器权限与空成功响应仍需真实服务复验；受控 fixture 不能代替这些差异。

## 未验证项

- P06 提交 `a831be6` 的 Windows x64、macOS Intel x64、macOS arm64 CI 结果。
- Windows 11 x64 的 P06 人工运行、安装、UI、菜单与关闭行为。
- macOS Intel 与 Apple Silicon arm64 的 P06 人工运行、安装、UI、菜单与关闭行为。
- Intel Mac 的未签名 DMG 安装、签名、公证。
- 真实 Navidrome/OpenSubsonic 与反向代理组合。
- Windows/macOS arm64 的 safeStorage 实机行为，以及签名后 macOS Keychain 升级稳定性。
- 真正退出时活动音频停止已验证；托盘、Dock 后台播放宿主仍属于 P09。

## 下一项可执行任务

先确认 P06 提交 `a831be6` 的三目标 CI；随后仅在用户明确授权的实际服务验证账号写权限、收藏同步、歌单 CRUD、超大队列与重复歌曲索引。缺少的 Windows 11 正式版本、macOS Intel/arm64、最低系统和物理听音证据不得标成已通过。P06 外部证据补齐前不要进入 P07 实现。

## 不应重做或覆盖的内容

- 不重新初始化项目，不建立第二套 Windows/Mac 前端。
- 不修改/删除 `Sonavi_UI_v0.1/` 与 `navidrome-vibe-coding-kit/` 原始解压参考。
- 不把任何平台改成“后续适配”。
- 不提前实现 P07～P10，也不放宽 Electron 安全设置；P06 不顺带实现歌词、播放上报、后台宿主或队列持久化。
