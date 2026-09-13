# P01 收口与 P02 连接基础测试报告

更新日期：2026-09-13
状态：P01 三目标自动化通过；P02 第一增量在 Intel Mac 通过，真实服务器与另两类实机待验证

## 测试环境

- 当前主机：macOS 13.7.8 Intel x64（Darwin 22.6.0）
- Node.js：22.19.0（NVM）
- npm：10.9.3
- Electron：44.3.0
- 分支：`main`
- P01 远端提交：`959e742030c3d5795f2632a5f092e81472c1b056`
- 当前 P02 增量：工作区未提交

## P01 远端 CI 证据

GitHub Actions run：`34749707166`，结论 `success`，运行页面：https://github.com/zhiyxn/Sonavi/actions/runs/34749707166

| 目标 | Runner | Job ID | 结果 | 已执行步骤 |
| --- | --- | --- | --- | --- |
| Windows x64 | `windows-2025` | `103703858252` | 通过 | checkout、Node、`npm ci`、lint、typecheck、unit/component、Electron smoke、Windows x64 打包 |
| macOS Intel x64 | `macos-15-intel` | `103703858433` | 通过 | checkout、Node、`npm ci`、lint、typecheck、unit/component、Electron smoke、macOS x64 打包 |
| macOS Apple Silicon arm64 | `macos-15` | `103703858562` | 通过 | checkout、Node、`npm ci`、lint、typecheck、unit/component、Electron smoke、macOS arm64 打包 |

这些是 P01 提交的自动化 runner 证据。Windows Server runner 不等于 Windows 11 桌面人工验收，macOS 15 runner 不等于 macOS 13 最低版本与真实设备 UI/安装验收。

## 当前 P02 自动验证

| 命令/检查 | 结果 | 证据/说明 |
| --- | --- | --- |
| `npm run lint` | 通过 | ESLint 10.10.0，0 warning |
| `npm run typecheck` | 通过 | main/preload、renderer、tests 三组通过 |
| `npm test` | 通过 | 8 个文件、30 项测试通过 |
| `npm run build` | 通过 | main、preload CJS、renderer 构建成功 |
| `npm run test:e2e` | 通过 | 真实 Electron Session 连接本地三端点 fixture，并验证 IPC、renderer 无 `process`、safeStorage 与 macOS 生命周期 |
| `npm run pack:dir` | 通过 | 生成未签名 macOS x64 目录包；首次受限网络失败后获准下载官方 Electron 文件并复跑成功 |
| 包内 Electron 冒烟 | 通过 | 未签名 x64 `Sonavi.app` 的连接 IPC、safeStorage、截图、关闭/重激活通过 |

## P02 覆盖范围

- URL：HTTPS 默认、自定义端口、中文/编码子路径、`/rest` 后缀、拒绝嵌入账号/查询/片段、HTTP 显式风险确认。
- 认证：官方示例 token 值、UTF-8 `md5(password + salt)`、每请求随机 salt、URL 无 `p` 明文参数。
- 协议：`ping`、扩展探测、音乐文件夹；服务端数字 ID 转为 string；旧服务器缺少扩展端点可降级。
- 错误：DNS、拒绝连接、超时、TLS、重定向、HTTP 401/403/5xx、Cloudflare challenge、HTML、非法 JSON、超大响应、协议认证/认证方式/权限/版本。
- 存储：系统加密可用时文件中无明文密码；不可用时不创建凭据文件；当前 Intel Mac 异步 safeStorage 加解密往返通过。
- 边界：连接 IPC 校验主 frame/窗口/来源与输入；preload 只暴露 `connection.test`；renderer 对返回值再次校验；Electron Session 已连接仅监听 `127.0.0.1` 的受控三端点 fixture。

## 分平台结果

| 验证项 | Windows 11 x64 | macOS 13 Intel x64 | macOS 13+ arm64 |
| --- | --- | --- | --- |
| P01 CI 自动化 | Windows x64 runner 通过 | Intel runner 通过 | arm64 runner 通过 |
| P02 当前增量远端 CI | 未运行 | 未运行 | 未运行 |
| P02 开发/生产启动 | 未验证：无实机 | 通过 | 未验证：无实机 |
| P02 目录包 | 未验证：无实机 | x64 目录包启动通过；DMG 未安装 | 未验证：无实机 |
| P02 safeStorage | 单元失败路径通过；实机未验证 | 异步加密往返通过 | 单元失败路径通过；实机未验证 |
| P02 UI 截图 | 未验证 | 开发构建与目录包截图目视通过，无截断/重叠 | 未验证 |
| 真实服务器 | 未验证 | 未验证：无授权测试服务/账号 | 未验证 |

## 安全检查

- [x] `contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`、`webSecurity=true` 与 CSP 保持不变。
- [x] renderer 源码不导入 Node/Electron，不访问 `process` 或原始 `ipcRenderer`。
- [x] 连接 IPC 不是任意网络代理；输入和输出均有运行时 schema。
- [x] 密码不进入 Pinia、localStorage、日志或认证 URL，提交结束后清空输入框。
- [x] Electron Session 不自动跟随重定向，不关闭 TLS/证书验证。
- [x] JSON 响应限制为 1 MiB，网页/非法协议响应不能伪装连接成功。
- [x] safeStorage 不可用、加密失败或写入失败时不回退明文。
- [x] 当前未实现音频、托盘或后台播放，没有提前扩大阶段。

## 截图证据

- macOS Intel x64：已生成并目视检查 `artifacts/screenshots/p02-current-platform.png` 与 `p02-packaged-macos-x64.png`；Playwright 页面截图不包含系统标题栏。
- Windows 11 x64：未验证，无 Windows 11 实机。
- macOS Apple Silicon arm64：未验证，无 Apple Silicon 实机。

## 当前结论

P01 已满足工程验收门槛，并新增了三个正式目标架构的远端自动化通过证据；跨平台人工安装/UI 验收仍待补齐。P02 第一增量的连接、认证、错误诊断、受限 IPC 和加密保存基础已实现并在当前 Intel Mac 验证。P02 尚不能关闭：真实服务器、保存凭据跨重启恢复/删除、P02 版本的远端三目标 CI，以及 Windows 11/Apple Silicon 实机行为仍未验证。

## 已观察的非阻断提示

- renderer 构建继续提示 Zod 注释位置无法由 Rollup 解释并移除；构建、schema 行为与运行均通过。
- macOS 目录包未签名；Electron 官方说明未稳定签名的不同构建可能触发 Keychain 重复授权，需在 P10 签名验收中复核。
