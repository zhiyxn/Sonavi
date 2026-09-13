# Sonavi 工作指导

## 当前产品范围（最高优先级）

Sonavi 从第一版开始正式、同等支持 Windows 与 macOS：

- Windows 11 x64；
- macOS 13+ Intel x64；
- macOS 13+ Apple Silicon arm64。

任何“Windows 优先、macOS 后续适配”或“macOS 优先、Windows 后续扩展”的旧描述均已撤销。Windows ARM64、Linux 与 macOS Universal 合并包不是首版强制目标。缺少某平台实机时，将结果写为“未验证”，不得缩减产品范围或声称已兼容。

原始解压资料 `Sonavi_UI_v0.1/` 与 `navidrome-vibe-coding-kit/` 只作历史与视觉参考；当前执行以本文件和根目录 `docs/` 为准，不修改原始资料来伪造历史。

## 固定技术与组织边界

- 一个仓库、一套 Electron + electron-vite + Vue 3 + TypeScript + Tailwind CSS + shadcn-vue 工程、一套 renderer 和核心业务代码，分别构建 Windows 与 macOS。
- Navidrome/Subsonic/OpenSubsonic 客户端、认证、音乐库、搜索、收藏、歌单、AudioEngine、播放队列、歌词、缓存与设置必须共享。
- 平台差异只进入必要的适配模块，例如 `src/main/platform/` 中的窗口、菜单、快捷键、托盘/Dock、路径与系统生命周期；不得复制页面或在各 Vue 组件散布平台判断。
- renderer 不使用 Node.js、文件系统、`process` 或原始 `ipcRenderer`。平台信息与业务能力由受限、类型明确、带运行时校验的 preload API 提供。
- UI 沿用 `Sonavi_UI_v0.1/tokens.css` 的石色、琥珀色与低动画方向；Tailwind CSS 复用这些 tokens，shadcn-vue 组件源码由项目持有并按 Sonavi 风格调整；首轮使用原生窗口框架，不绘制伪系统按钮。
- Pinia 管客户端状态，TanStack Vue Query 管服务器查询；只有一个 AudioEngine。P01 只建立接口，不提前实现播放器。
- 公共 Subsonic/OpenSubsonic 协议优先，不依赖 Navidrome 私有 Web API。
- 使用 electron-builder 的同一配置构建 Windows x64、macOS x64 与 macOS arm64；不得以一台主机的交叉产物代替对应系统运行验收。

## 强制安全边界

- 保持 `contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`、`webSecurity=true` 和严格 CSP。
- preload 仅暴露明确业务方法；main 校验 IPC 发送者、参数、会话与权限。默认拒绝导航、新窗口与权限请求。
- 凭据只由 main 管理。后续统一通过 CredentialStore 调用当前锁定 Electron 的 `safeStorage`；不可用或加密失败时不回退明文。
- 禁止在代码、renderer store、localStorage、日志、认证 URL 中保存或输出密码、认证 token、salt/token 组合、Cookie 或 Authorization。
- 不关闭 TLS/证书验证，不用放宽 Electron 安全设置解决兼容性问题。
- 音频必须流式传输，不得整首读入内存或 Base64 经 IPC。
- 禁止生成恶意代码、推送、发布、上传安装包、索取签名密钥、修改真实服务或删除用户数据，除非用户明确授权。

## 开发环境与跨平台规则

- Node.js 由 NVM 管理，默认版本为 `v22.19.0`。运行 `node`、`npm`、`npx`、`pnpm` 前先确保当前环境已加载 NVM 并执行 `nvm use`；项目声明不同版本时以项目为准。
- 路径使用 Node/Electron 的平台无关 API；用户数据目录由 Electron `app.getPath('userData')` 获取，不硬编码用户目录、盘符或路径分隔符。
- 脚本必须可由 Windows PowerShell 和 macOS shell 调用；跨平台逻辑写成 Node.js 脚本，不把 `rm`、`cp`、`export` 等单一 shell 命令当作通用脚本。
- 新依赖必须核对 Windows/macOS 及 x64/arm64 支持。引入原生模块前记录各目标架构构建条件。

## 标准工作流

执行前检查清单：

- [ ] 中文回复
- [ ] 已读取 `AGENTS.md`、`docs/PRD.md`、`docs/ARCHITECTURE.md`、`docs/TASKS.md`、`docs/HANDOFF.md`
- [ ] 已检查分支、`git status`、现有文件与脚本
- [ ] 已选择符合任务的工具并保护用户未提交修改
- [ ] 已确认任务安全边界与当前 P01～P10 阶段

流程：研究上下文（禁止编码）→ 记录计划 → 增量实施 → 自动与实机验证 → 更新知识文档 → 交付。只完成当前阶段的可验证范围；P01～P10 顺序保持不变，不因平台修正提前实现后续播放器功能。

质量要求：

- 新行为应有测试；`lint`、`typecheck`、`test`、`build` 脚本必须执行真实检查。
- 失败时修根因，不删除测试、不降检查强度、不滥用 `any` 或 `@ts-ignore`。
- 自动测试、模拟服务、Electron 冒烟、真实服务器、物理听音与对应系统实机是不同证据层级。
- 无法执行的测试必须标“未验证”；macOS 截图不能代表 Windows UI 通过，反之亦然。
- 完成阶段前更新 `docs/TEST-REPORT.md` 与 `docs/HANDOFF.md`，记录命令、结果、环境、未验证项和下一入口。

提交与知识存储：重要架构、安全、兼容性决定写入 `docs/DECISIONS.md`；当前进展写入 `docs/TASKS.md` 与 `docs/HANDOFF.md`。未经要求不创建提交。
