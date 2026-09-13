# Sonavi 任务清单

更新日期：2026-09-13

## P01：工程基础 + 双平台基础修正（已完成）

- [x] 读取原始 UI、开发包、Git 状态与旧平台约定。
- [x] 建立根级 AGENTS、PRD、ARCHITECTURE、DECISIONS、DESIGN-MAP、COMPATIBILITY 等执行文档。
- [x] 建立单套 Electron/main/preload/renderer/shared 工程。
- [x] 建立共享连接页、应用外壳与未启用 AudioEngine 占位。
- [x] 建立 Windows/macOS 最小平台适配入口与原生窗口规则。
- [x] 建立类型化应用信息 IPC、CSP、导航/权限限制。
- [x] 建立 Windows x64、macOS x64、macOS arm64 构建脚本与 electron-builder 配置。
- [x] 安装锁定依赖并生成 lockfile；`npm ci` 可复现。
- [x] 执行 lint、typecheck、unit/component test、renderer build。
- [x] 在当前 Intel Mac 执行开发启动、Electron/截图冒烟与最小 x64 目录打包。
- [x] 验证未签名 x64 目录包的架构、最低系统、asar、IPC 与 Dock 重激活。
- [x] 建立并远端运行 Windows x64、macOS Intel x64、macOS arm64 CI 矩阵；P01 提交三个 job 全部通过。
- [x] 更新 TEST-REPORT/HANDOFF 为实测结果并判断 P01 闸门。

## 当前阶段：P02 连接、认证与 CredentialStore

- [x] 核对当前 OpenSubsonic、Navidrome 与 Electron safeStorage 官方文档。
- [x] 实现 HTTPS 默认、显式 HTTP 风险确认、自定义端口与子路径规范化。
- [x] 实现每请求随机 salt 的 token 认证；URL 不携带明文密码。
- [x] 实现 `ping`、`getOpenSubsonicExtensions`、`getMusicFolders` 连接探测。
- [x] 实现 HTTP/协议双层校验、1 MiB 响应上限与错误分类。
- [x] 实现受信任发送者检查、输入/输出 schema 和受限 preload 连接 API。
- [x] 实现 CredentialStore 加密保存；safeStorage 不可用或失败时不写明文。
- [x] 受控 fixture 覆盖 URL、认证、能力降级、文件夹 ID、错误分类和存储失败。
- [x] 当前 Intel Mac 完成生产 Electron、连接 IPC、safeStorage 往返、截图和目录包验证。
- [ ] 实现已保存凭据的跨重启恢复/删除，密码继续只留在 main。
- [ ] 使用用户授权的真实 Navidrome/OpenSubsonic 测试账号验证 HTTPS、反向代理与权限差异。
- [ ] 让本增量进入远端三平台 CI；当前远端成功记录只覆盖 P01 提交。
- [ ] Windows 11 x64 与 macOS arm64 实机验证连接 UI、网络错误和 safeStorage。

## 后续阶段（顺序保留）

- [ ] P02：真实服务器连接、认证、CredentialStore 与错误诊断（进行中）。
- [ ] P03：专辑到真实播放的最短链路、媒体协议和 Range。
- [ ] P04：AudioEngine 状态机与播放队列。
- [ ] P05：正式音乐库 UI 与搜索。
- [ ] P06：收藏与歌单管理。
- [ ] P07：歌词与播放上报。
- [ ] P08：转码、网络策略与诊断。
- [ ] P09：托盘/Dock、隐藏继续播放、真正退出、媒体键与性能。
- [ ] P10：安装包、签名/公证占位、兼容性与发布前审计。

## 尚需外部环境验证

- Windows 11 x64：依赖安装、开发启动、单元测试、生产构建、NSIS 打包、截图、菜单/关闭/重启。
- Apple Silicon macOS 13+：原生 arm64 依赖安装、开发启动、DMG 打包、截图、菜单/Dock/关闭与重激活。
- Intel Mac 的未签名 DMG 安装打开验证（目录包与开发启动不等于安装器验收）。
- P01 GitHub Actions 三平台矩阵已通过；当前未提交 P02 增量尚未进入远端 CI。

## P01 闸门结论

P01 的单工程、安全边界、共享 UI、平台适配入口、三目标构建配置、三平台 CI 与当前 Intel Mac 最小打包均已达到验收条件。Windows 11 x64 与 Apple Silicon arm64 的人工运行/截图仍明确为待验证，不宣称双平台实机兼容已完整验收。当前按顺序进入 P02，不提前实现 P03 播放。
