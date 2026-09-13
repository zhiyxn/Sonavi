# Sonavi 兼容性矩阵

核验日期：2026-09-13

## 正式目标

| 系统 | 架构 | 构建入口 | 运行状态 | 截图状态 |
| --- | --- | --- | --- | --- |
| Windows 11 | x64 | `npm run build:win` | 待 Windows 实机验证 | 待验证 |
| macOS 13+ | Intel x64 | `npm run build:mac:x64` | 开发模式、生产构建、x64 目录包已运行通过 | renderer 截图已检查 |
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
- 后续 CredentialStore 使用 Electron 44 `safeStorage`；必须分别验证 Windows/macOS 加密可用性、失败处理和不可跨机器复制，禁止明文回退。

## 当前主机

本轮主机为 macOS 13.7.8 Intel x64（Darwin 22.6.0），Node.js 22.19.0 x64。已验证 electron-vite 生产构建、开发模式启动、真实 Electron 冒烟、x64 目录包、包内 IPC 以及关闭窗口/Dock 激活重建；Mach-O 为 x86_64，`LSMinimumSystemVersion=13.0`。未生成/安装 DMG，也未签名或公证。此证据不能替代 Windows 11 或 Apple Silicon 实机结果。

## CI 计划

`.github/workflows/ci.yml` 使用 `windows-2025` x64、`macos-15-intel` x64 和 `macos-15` arm64 三个独立 runner。每个 job 执行 lockfile 安装、lint、typecheck、unit/component、Electron smoke 和本平台打包命令，不上传产物。GitHub 官方当前 runner 表确认后两个标签分别是 Intel 与 arm64；CI 配置尚未推送或运行，因此三项状态仍是“未验证”。macOS 15 CI 也不能替代 macOS 13 最低版本实机验证，Windows Server runner 不能替代 Windows 11 桌面人工验收。

来源：https://docs.github.com/en/actions/reference/runners/github-hosted-runners
