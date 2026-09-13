# 项目交接

更新日期：2026-09-13

## 当前目标

P01/P02 基础已完成，当前按 P01～P10 顺序执行 P03。目标是专辑到真实流式播放的最短链路，不提前实现 P04 队列或 P05 正式音乐库。

## 当前分支与最近已验证提交

- 分支：`main`
- 最近提交：`282ce86 feat(p02): 建立安全连接与凭据保存基础`
- 远端：`origin/main` 已包含该 P01 提交；GitHub Actions run `34749707166` 成功
- `282ce86` 已推送到 `origin/main`；三目标 CI run `34760475489` 当前为 `in_progress`；P03 增量未提交、未推送、未发布或上传安装包

## 工作区未提交改动

工作区包含本轮 P03 源码、测试和文档改动，均未提交。用户原有 `.gitignore` 与两个被忽略的原始参考目录继续保留；`node_modules/`、`out/`、`release/`、`artifacts/` 和原始参考包不进入提交。

## 已完成代码

- P01 的单套 Electron 44/electron-vite 5/Vue 3/TypeScript 工程、安全窗口与平台适配保持不变。
- 三目标 GitHub Actions 构建矩阵；不上传产物，P01 提交的三个 job 均成功。
- P02 固定端点 OpenSubsonic 客户端：URL 规范化、token/salt 认证、能力探测、音乐文件夹与错误分类。
- P02 连接 IPC/preload/renderer 流程；renderer 无任意网络或 Node 能力。
- P02 CredentialStore 加密保存与 `session-only` 失败策略。
- 协议 fixture、凭据文件、共享 UI 与真实 Electron 冒烟测试。
- 原始提示中明确指定的 Tailwind CSS 4 + shadcn-vue 基础：`components.json`、Vite 插件、theme/token 映射、alias、`cn()` 与 Button 组件源码。
- P03 `getAlbumList2` / `getAlbum`、音乐库 IPC、简单专辑列表/详情与 Pinia 会话状态。
- P03 随机会话/媒体句柄、`sonavi-media` scheme、严格 CSP、Electron Session 流式 `getCoverArt` / `stream` 与 Range。
- 单一 HTMLAudioElement AudioEngine 和共享 PlayerBar；未实现 P04 队列。

## 已执行自动验证

- `npm run lint`：通过，0 warning。
- `npm run typecheck`：通过，main/preload、renderer、tests 三组均通过。
- `npm test`：通过，9 个文件、当前 39 项测试（最终复跑后以 TEST-REPORT 为准）。
- `npm run build` / `npm run test:e2e` 内建构建：通过；main、sandbox CJS preload、renderer 均产出。
- `npm run pack:dir`：通过，生成 `release/0.1.0/mac/Sonavi.app`（未签名目录包）。
- 生产构建与目录包冒烟：真实 Electron Session 连接本地 `127.0.0.1` fixture；连接、专辑、封面、合成 WAV、实际 HTMLAudioElement `playing`、renderer 无 `process`、safeStorage、截图和 macOS 关闭/重激活均通过。
- P01 远端 CI：Windows x64、macOS Intel x64、macOS arm64 均完成 install、lint、typecheck、unit/component、Electron smoke 和对应平台打包。

## 已执行真实服务器与实机验证

尚未连接真实服务器（需要用户授权的测试服务/账号），也未做物理扬声器/耳机听音。macOS 13.7.8 Intel 上已执行 P03 生产 Electron 冒烟、renderer 截图、未签名 x64 目录包启动、合成 WAV 播放、safeStorage 往返，以及关闭窗口后 Dock 激活重建。Windows 与 Apple Silicon 无可用实机；P01 的对应 GitHub runner 自动化不等于 P03 实机验收。

## 关键架构与安全决策

见 `docs/DECISIONS.md`。最关键的是：Windows/macOS 首版同等支持、共享一套 renderer、平台差异集中、原生窗口控件、renderer 无 Node/process；连接使用公共 token/salt 认证、禁止自动重定向和明文凭据回退。

## 当前问题和最小复现

当前无已知阻断性代码问题。首次在受限网络下运行 `npm run pack:dir` 因无法解析 GitHub 失败；允许 electron-builder 下载官方 Electron 打包文件后复跑成功，不是项目代码失败。P01 已解决的依赖/preload 问题保持不变。

## 未验证项

- Windows 11 x64 全部人工运行、安装、UI、菜单与关闭行为。
- Apple Silicon macOS arm64 全部人工运行、安装、UI、菜单与关闭行为。
- Intel Mac 的未签名 DMG 安装、签名、公证。
- 真实 Navidrome/OpenSubsonic 与反向代理组合。
- Windows/macOS arm64 的 safeStorage 实机行为，以及签名后 macOS Keychain 升级稳定性。
- 已保存凭据的跨重启恢复/删除。
- 音频、托盘、Dock 播放宿主（分别属于后续阶段）。

## 下一项可执行任务

继续 P03 验证：优先使用明确授权的真实 Navidrome/OpenSubsonic 服务验证专辑、封面、原始格式/转码、seek 与错误映射；获得 Windows 11 或 Apple Silicon 环境后分别运行 P03 冒烟和截图。未补齐这些证据前不宣称 P03 跨平台验收完成，也不进入 P04。

## 不应重做或覆盖的内容

- 不重新初始化项目，不建立第二套 Windows/Mac 前端。
- 不修改/删除 `Sonavi_UI_v0.1/` 与 `navidrome-vibe-coding-kit/` 原始解压参考。
- 不把任何平台改成“后续适配”。
- 不提前实现 P04～P10，也不放宽 Electron 安全设置。
