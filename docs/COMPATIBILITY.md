# Sonavi 兼容性矩阵

核验日期：2026-09-14

## 正式目标

| 系统 | 架构 | 构建入口 | 运行状态 | 截图状态 |
| --- | --- | --- | --- | --- |
| Windows 11 | x64 | `npm run build:win` | 当前 Windows x64 build 26200 的源码/目录包冒烟与 NSIS 生成通过；安装器实装及系统版本人工确认待验证 | renderer 截图已检查 |
| macOS 13+ | Intel x64 | `npm run build:mac:x64` | P09 源码、生产构建、x64 目录包与包内桌面生命周期冒烟已运行通过 | P09 深色宿主与 x64 包截图已检查 |
| macOS 13+ | Apple Silicon arm64 | `npm run build:mac:arm64` | 待 Apple Silicon 实机验证 | 待验证 |

Windows ARM64、Linux、macOS Universal 合并包不属于首版强制交付。表中“待验证”不会降低其正式支持地位。

## 当前工具链

| 项目 | 锁定版本 | 兼容性依据/状态 |
| --- | --- | --- |
| Node.js | 22.19.0 | 满足 electron-vite/Vite 的 Node 22.12+ 要求 |
| npm | 10.9.3 | lockfile 与脚本包管理器 |
| Electron | 44.3.0 | 官方 Electron 44 要求 macOS 13+；发布三种目标预构建二进制 |
| electron-vite | 5.0.0 | 官方文档要求 Node 20.19+ 或 22.12+、Vite 5+ |
| Vite | 7.3.6 | electron-vite 5 的实际 peer 范围为 Vite 5/6/7；使用兼容线最新版本 |
| Tailwind CSS / Vite 插件 | 4.3.3 | 无原生模块；共享 renderer 构建通过 |
| shadcn-vue 基础 | 当前官方 Vite/Tailwind v4 结构 | 组件源码入库；Reka UI 2.10.4 支持 Vue 3.4+ |
| electron-builder | 26.15.3 | 配置明确包含 Windows x64、macOS x64/arm64 |
| TypeScript | 6.0.3 | typescript-eslint 8.70 的实际 peer 上限为 `<6.1.0`；未强装不兼容的 TS 7 |

来源：

- Electron 44 / macOS 13：https://www.electronjs.org/blog/electron-44-0
- Electron 44.3.0：https://releases.electronjs.org/release/v44.3.0
- electron-vite 环境要求：https://electron-vite.org/guide/
- electron-builder 架构说明：https://www.electron.build/docs/architecture/

## 依赖与路径审查

- P01 运行时代码没有引入项目自有原生 Node 模块；Electron 自身按目标架构下载官方二进制。
- 依赖安装前的 peer 解析发现 Vite 8 与 TypeScript 7 分别超出 electron-vite/typescript-eslint 支持范围，已锁到 Vite 7.3.6 与 TypeScript 6.0.3；未使用 `--force` 或 `--legacy-peer-deps`。
- Vue Test Utils 2.5.0 的新传递依赖要求 Node 22.22.2，超过项目既定 22.19.0；P01 使用仍满足 Vue 3 测试需求的 2.4.6，避免忽略 engine 警告。
- npm 官方审计发现 Vue Test Utils 2.4.6 → js-beautify 的 glob 10.4.5 CLI 注入公告；项目将该条兼容传递依赖精确覆盖为已修复的 glob 10.5.0。Sonavi 不调用 glob CLI，但仍消除已知高危项。
- lockfile 的解析地址统一为 npm 官方注册表，不继承单一开发机的镜像配置；最终 `npm ci` 可复现，`npm audit` 为 0 vulnerabilities。
- renderer 路径由 Vite 处理；main 使用 `node:path`、`fileURLToPath` 和 `app.getPath('userData')`（后续存储）规则，不硬编码用户目录或盘符。
- npm scripts 不含 `rm`、`cp`、`export` 或 PowerShell 专用语法；复合逻辑使用 npm 脚本/Node.js。
- 文件名采用稳定英文小写目录和明确大小写 import；仍需在 Windows/默认大小写不敏感 APFS 之外的大小写敏感环境回归。
- 空格/中文工作区路径：代码没有 shell 拼接路径；尚未在包含空格/中文的 Windows 路径安装验证。
- P02 CredentialStore 已使用 Electron 44 的异步 `safeStorage`；当前 Intel Mac 的加密往返、真正应用进程重启后的恢复/删除与通用失败路径已验证。Windows 11、Apple Silicon 和签名后 Keychain 稳定性仍待验证；密文不得假设可跨机器复制，禁止明文回退。
- P03 新增依赖均为跨平台 JavaScript/CSS 包，没有加入单平台原生依赖；版本已精确锁定。`sonavi-media` 使用 Electron 44 官方 protocol/Session 能力，Windows x64 与 macOS arm64 的实际媒体播放仍需各自运行验证。
- P04 未增加依赖或原生模块。状态机、队列、随机历史和 UI 都位于共享 TypeScript/Vue renderer；使用浏览器标准 HTMLAudioElement、EventTarget 与 Web Crypto `randomUUID`。当前 Intel Mac 已验证，Windows 11 与 Apple Silicon 仍需实机验证相同媒体事件次序和音频输出。
- P05 未增加依赖或原生模块。`getAlbumList2`、`getArtists`、`getArtist`、`search3` 使用共享 Electron Session 客户端；窗口化列表、防抖和 Query 取消位于共享 Vue renderer，Windows/macOS 不存在页面分叉。
- P06 未增加依赖或原生模块。收藏与歌单复用共享 OpenSubsonic 客户端、Zod、TanStack Query 和 Vue renderer；重复查询参数由平台无关 URL API 构造，Windows/macOS 不存在业务或页面分叉。
- P07 未增加依赖或原生模块。歌词、播放上报控制器与界面均复用共享 TypeScript/Vue renderer；时间使用毫秒安全整数和 HTMLAudioElement 秒进度转换，URL 参数继续由平台无关 URL API 构造。Windows/macOS 不存在歌词或 scrobble 业务分叉。
- P08 未增加依赖或原生模块。代理使用 Electron 44 的 `Session.setProxy` / `closeAllConnections`，设置路径来自 `app.getPath('userData')`；转码 URL 继续由平台无关 URL API 构造。API、封面和音频共用同一 Chromium 网络栈，没有平台专属 renderer 分支。
- P09 未增加依赖或原生 Node 模块。Tray、BrowserWindow、powerMonitor、Media Session、screen 与 `userData` 均来自当前 Electron/Chromium；运行时代码只按 `process.platform` 处理托盘图标模板和现有窗口选项，renderer 无平台分支。electron-builder 通过 `extraResources` 将同一品牌 PNG 放入三目标包供托盘使用。
- P09 桌面状态使用 Node 跨平台 path/fs API 和原子临时文件替换；窗口位置按当前显示器工作区裁剪。封面缓存目录/文件名均为 SHA-256 十六进制，不依赖路径分隔符、大小写或原资源名；单账号 128 MiB，音频不落盘。
- 品牌图标使用单一 1254×1254 PNG 源文件；electron-builder 26.15.3 在各自构建流程生成 Windows/macOS 图标资源，不引入图像处理依赖或平台专属 renderer 代码。当前 Windows x64 目录包转换通过，从 `Sonavi.exe` 提取的 32×32 系统图标及包内 renderer 品牌位均已目视确认；NSIS/开始菜单与 macOS x64/arm64 转换仍需对应安装器、CI 或实机验证。

## 当前主机

本轮主机为 macOS 13.7.8（22H730）Intel x64，Node.js 22.19.0、npm 10.9.3。已验证 P09 lint、三套类型检查、96 项测试、生产构建、真实 Electron 受控 fixture、macOS x64 目录包及包内完整冒烟；关闭隐藏/同宿主恢复、Media Session、深色主题、暂停队列重建、封面缓存、10,000 条合成列表和快速切页测量均通过。最终源码启动到连接 UI 约 1325 ms，20 轮设置/首页切换工作集增量 52,224 KiB、媒体请求增量 0；最终 x64 包对应约 1411 ms、51,604 KiB、0。数字是本机单次受控采样，不是跨平台基准。未生成或安装 DMG，也未使用真实服务器、物理听音或手工媒体键/托盘菜单。此前 Windows x64 证据不等于 Windows P08/P09 验证。

## CI 状态

`.github/workflows/ci.yml` 使用 `windows-2025` x64、`macos-15-intel` x64 和 `macos-15` arm64 三个独立 runner。P06 提交 `a831be6` 的 run `34810276941` 三个 job 全部成功。品牌提交 `36802ec` 的 run `34811268194` 中 Windows x64 与 macOS Intel x64 成功，macOS arm64 Electron smoke 失败且公开 API 无日志权限；P07 实现提交 `9e599fa` 已推送。当前未提交的 P08/P09 尚未触发 CI，不能沿用旧提交结果。macOS 15 CI 不能替代 macOS 13 最低版本实机验证，任何 runner 也不能替代真实托盘/菜单栏、媒体键、安装器、物理听音与完整人工验收。

来源：https://docs.github.com/en/actions/reference/runners/github-hosted-runners
