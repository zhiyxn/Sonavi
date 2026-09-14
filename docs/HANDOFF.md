# 项目交接

更新日期：2026-09-14

## 当前目标

P01 已完成；P02～P04 的当前本机代码闸门已完成，继续等待真实服务器、Windows 11、Apple Silicon 和 P04 远端 CI 证据。没有提前实现 P05 正式音乐库或 P09 队列持久化/后台播放。

## 当前分支与最近已验证提交

- 分支：`main`
- 最近提交：`f2a39c9 fix(p03): 支持专辑列表分页加载`
- 远端：本地显示 `origin/main` 与 `f2a39c9` 一致；当前环境没有 `gh` CLI，本轮未查询该提交 CI 编号
- 当前 P04 源码、测试和文档尚未提交；未发布或上传安装包

## 工作区未提交改动

工作区包含 P04 AudioEngine、队列 UI、测试和文档改动，均未提交。用户原有 `.gitignore` 与原始参考目录继续保留；`node_modules/`、`out/`、`release/`、`artifacts/` 和原始参考包不进入提交。

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

## 已执行自动验证

- `npm run lint`：通过，0 warning。
- `npm run typecheck`：通过，main/preload、renderer、tests 三组均通过。
- `npm test`：通过，11 个文件、56 项测试。
- `npm run build` / `npm run test:e2e` 内建构建：通过；main、sandbox CJS preload、renderer 均产出。
- `npm run pack:dir`：通过，生成 `release/0.1.0/mac/Sonavi.app`（未签名目录包）。
- 生产构建冒烟：真实 Electron Session 连接本地 `127.0.0.1` fixture；31 张专辑分两页加载，3 首专辑替换队列、重复追加、前后切歌、播放/暂停/seek 均通过。既有凭据、媒体和 macOS 生命周期检查继续通过。
- P01 与 P02 远端 CI：Windows x64、macOS Intel x64、macOS arm64 均完成 install、lint、typecheck、unit/component、Electron smoke 和对应平台打包。

## 已执行真实服务器与实机验证

用户已在实际服务完成连接、读取首批专辑并成功播放，证明基础真实服务链路可用；分页修复和 P04 多曲队列尚待用户在该服务复验，服务地址、账号和凭据没有写入项目或日志。物理扬声器/耳机听音、转码差异仍未单独记录。Windows 与 Apple Silicon 无可用实机。

## 关键架构与安全决策

见 `docs/DECISIONS.md`。最关键的是：Windows/macOS 首版同等支持、共享一套 renderer、平台差异集中、原生窗口控件、renderer 无 Node/process；连接使用公共 token/salt 认证、禁止自动重定向和明文凭据回退。

## 当前问题和最小复现

当前没有已知的 P04 阻断问题。受控 Audio/HTTP fixture 已验证队列决策和基础状态事件，但无法制造所有平台真实解码器的缓冲、断流与事件时序差异，仍需实际服务和另两类实机验证。

## 未验证项

- Windows 11 x64 全部人工运行、安装、UI、菜单与关闭行为。
- Apple Silicon macOS arm64 全部人工运行、安装、UI、菜单与关闭行为。
- Intel Mac 的未签名 DMG 安装、签名、公证。
- 真实 Navidrome/OpenSubsonic 与反向代理组合。
- Windows/macOS arm64 的 safeStorage 实机行为，以及签名后 macOS Keychain 升级稳定性。
- 真正退出时活动音频停止已验证；托盘、Dock 后台播放宿主仍属于 P09。

## 下一项可执行任务

先在用户实际服务复验“加载更多专辑”，再打开多曲专辑确认整张专辑队列、追加重复项、上一首/下一首、删除当前项、随机/循环和音量。确认后提交 P04 并运行三目标 CI；外部证据无法取得时，下一开发阶段按顺序进入 P05 正式音乐库与搜索，但不得把缺少的 P02～P04 实机验证标成已通过。

## 不应重做或覆盖的内容

- 不重新初始化项目，不建立第二套 Windows/Mac 前端。
- 不修改/删除 `Sonavi_UI_v0.1/` 与 `navidrome-vibe-coding-kit/` 原始解压参考。
- 不把任何平台改成“后续适配”。
- 不提前实现 P05～P10，也不放宽 Electron 安全设置；P04 不顺带实现 P09 的后台宿主或持久化。
