# 项目交接

更新日期：2026-09-13

## 当前目标

P01 已完成；P02/P03 的当前本机代码闸门已完成，继续等待外部服务器、另两类实机和远端 CI 证据。没有提前实现 P04 队列或 P05 正式音乐库。

## 当前分支与最近已验证提交

- 分支：`main`
- 最近提交：`4d1777d fix(p01-p03): 补齐凭据与媒体生命周期`
- 远端：`origin/main` 与本地提交一致；run `34762062759` 三目标成功
- 当前专辑分页修复尚未提交；未发布或上传安装包

## 工作区未提交改动

工作区包含 P03 专辑分页的源码、测试和文档改动，均未提交。用户原有 `.gitignore` 与原始参考目录继续保留；`node_modules/`、`out/`、`release/`、`artifacts/` 和原始参考包不进入提交。

## 已完成代码

- P01 的单套 Electron 44/electron-vite 5/Vue 3/TypeScript 工程、安全窗口与平台适配保持不变。
- 三目标 GitHub Actions 构建矩阵；不上传产物，P01 提交的三个 job 均成功。
- P02 固定端点 OpenSubsonic 客户端：URL 规范化、token/salt 认证、能力探测、音乐文件夹与错误分类。
- P02 连接 IPC/preload/renderer 流程；renderer 无任意网络或 Node 能力。
- P02 CredentialStore 加密保存、跨进程重启恢复、密钥轮换重加密、幂等删除与 `session-only` 失败策略。
- 连接 IPC 新增受限 restore/disconnect/forget；退出、忘记账号和会话轮换会清查询/播放状态、撤销旧句柄并中止活动媒体流。
- 协议 fixture、凭据文件、共享 UI 与真实 Electron 冒烟测试。
- 原始提示中明确指定的 Tailwind CSS 4 + shadcn-vue 基础：`components.json`、Vite 插件、theme/token 映射、alias、`cn()` 与 Button 组件源码。
- P03 `getAlbumList2` / `getAlbum`、带 `offset/size` 校验的分页音乐库 IPC、每页 30 张的加载更多界面与 Pinia 会话状态。
- P03 随机会话/媒体句柄、`sonavi-media` scheme、严格 CSP、Electron Session 流式 `getCoverArt` / `stream` 与 Range。
- 单一 HTMLAudioElement AudioEngine 和共享 PlayerBar；未实现 P04 队列。

## 已执行自动验证

- `npm run lint`：通过，0 warning。
- `npm run typecheck`：通过，main/preload、renderer、tests 三组均通过。
- `npm test`：通过，9 个文件、43 项测试。
- `npm run build` / `npm run test:e2e` 内建构建：通过；main、sandbox CJS preload、renderer 均产出。
- `npm run pack:dir`：通过，生成 `release/0.1.0/mac/Sonavi.app`（未签名目录包）。
- 生产构建冒烟：真实 Electron Session 连接本地 `127.0.0.1` fixture；31 张专辑分两页加载完毕后仍可打开详情并完成播放/暂停/seek。既有凭据、媒体和 macOS 生命周期检查继续通过。
- P01 与 P02 远端 CI：Windows x64、macOS Intel x64、macOS arm64 均完成 install、lint、typecheck、unit/component、Electron smoke 和对应平台打包。

## 已执行真实服务器与实机验证

用户已在实际服务完成连接、读取首批专辑并成功播放，证明基础真实服务链路可用；本轮问题由固定 30 张且无分页入口引起。分页修复尚待用户在该服务复验，服务地址、账号和凭据没有写入项目或日志。物理扬声器/耳机听音、转码差异仍未单独记录。Windows 与 Apple Silicon 无可用实机。

## 关键架构与安全决策

见 `docs/DECISIONS.md`。最关键的是：Windows/macOS 首版同等支持、共享一套 renderer、平台差异集中、原生窗口控件、renderer 无 Node/process；连接使用公共 token/salt 认证、禁止自动重定向和明文凭据回退。

## 当前问题和最小复现

用户实际服务暴露了首批专辑被截断的问题：`getAlbumList2` 固定 `size=30`，IPC/renderer 没有页信息。当前工作区已改为受校验的 `offset/size` 分页和显式加载更多，并用 31 张受控专辑验证第二页及后续播放；等待实际服务复验。

## 未验证项

- Windows 11 x64 全部人工运行、安装、UI、菜单与关闭行为。
- Apple Silicon macOS arm64 全部人工运行、安装、UI、菜单与关闭行为。
- Intel Mac 的未签名 DMG 安装、签名、公证。
- 真实 Navidrome/OpenSubsonic 与反向代理组合。
- Windows/macOS arm64 的 safeStorage 实机行为，以及签名后 macOS Keychain 升级稳定性。
- 真正退出时活动音频停止已验证；托盘、Dock 后台播放宿主仍属于 P09。

## 下一项可执行任务

请先在同一实际服务点击“加载更多专辑”，确认超过 30 张且最后一页正确收口；随后提交/推送分页修复并观察三目标 CI。之后继续验证封面、原始格式/转码、seek 与错误映射，并在 Windows 11、Apple Silicon 环境分别运行 P03 冒烟和截图。

## 不应重做或覆盖的内容

- 不重新初始化项目，不建立第二套 Windows/Mac 前端。
- 不修改/删除 `Sonavi_UI_v0.1/` 与 `navidrome-vibe-coding-kit/` 原始解压参考。
- 不把任何平台改成“后续适配”。
- 不提前实现 P04～P10，也不放宽 Electron 安全设置。
