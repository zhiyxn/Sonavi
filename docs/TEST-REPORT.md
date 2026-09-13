# P01 测试报告

更新日期：2026-09-13
状态：P01 工程与当前 Intel Mac 环境通过；跨平台实机项按表保留未验证

## 测试环境

- 当前主机：macOS 13.7.8 Intel x64（Darwin 22.6.0）
- Node.js：22.19.0（NVM）
- npm：10.9.3
- Electron：44.3.0
- 分支：`main`，仓库尚无提交

## 自动验证

| 命令 | 结果 | 证据/说明 |
| --- | --- | --- |
| `npm ci` | 通过 | 按 lockfile 安装 524 packages；无 engine 警告 |
| `npm audit` | 通过 | npm 官方审计库：0 vulnerabilities |
| `npm run lint` | 通过 | ESLint 10.10.0，0 warning |
| `npm run typecheck` | 通过 | main/preload、renderer、tests 三组通过 |
| `npm test` | 通过 | 3 个文件、7 项测试通过 |
| `npm run build` | 通过 | main、preload CJS、renderer 构建成功 |
| `npm run test:e2e` | 通过 | macOS Intel 真实 Electron、IPC、截图、关闭/重激活通过 |
| `npm run pack:dir` | 通过 | 生成未签名 macOS x64 目录包 |
| 包内 Electron 冒烟 | 通过 | 未签名 x64 `Sonavi.app` 的 IPC、截图、关闭/重激活通过 |
| `.github/workflows/ci.yml` | 未验证 | 已建立三架构矩阵；未推送、未触发远端 job |

## 分平台结果

| 验证项 | Windows 11 x64 | macOS 13 Intel x64 | macOS 13+ arm64 |
| --- | --- | --- | --- |
| 开发启动 | 未验证：无环境 | 通过：`npm run dev` 进入持续运行后人工结束 | 未验证：无环境 |
| 生产 renderer/main/preload 构建 | 未验证：无环境 | 通过 | 未验证：无环境 |
| 平台安装包 | 未验证：无环境 | x64 目录包通过；DMG 未生成/安装 | 未验证：无环境 |
| 原生窗口控件 | 未验证 | 实际窗口使用原生 frame；页面截图不含系统 chrome | 未验证 |
| Ctrl/Cmd 提示 | 组件测试验证 Ctrl；实机未验证 | 组件测试 + Electron 截图验证 Cmd | 组件测试验证 Cmd；实机未验证 |
| 菜单/关闭/重新激活 | 未验证 | 关闭窗口、保留进程、模拟 Dock activate 重建通过 | 未验证 |
| 字体无截断/重叠 | 未验证 | 1240×800 renderer 截图目视通过 | 未验证 |
| 真实 Navidrome/认证 | P02，不适用 | P02，不适用 | P02，不适用 |
| 实际音频播放 | P03，不适用 | P03，不适用 | P03，不适用 |

## P01 安全检查

- [x] renderer 源码不直接导入 Node/Electron，不访问 `process`。
- [x] preload 只暴露 `application.getInfo()`，不暴露原始 `ipcRenderer`。
- [x] `contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`、`webSecurity=true`。
- [x] IPC 限制主 frame、所属窗口与允许来源，并在 main/renderer 双侧做 schema 校验。
- [x] 权限请求、新窗口与应用外导航默认拒绝。
- [x] P01 不保存、不发送凭据，提交表单后清空密码字段。
- [x] 构建/目录包中的 CSP 与 sandbox CJS preload 路径实际启动确认。

## 截图证据

- Windows 11 x64：未验证，无 Windows 主机。
- macOS Intel x64：已生成并目视检查 `artifacts/screenshots/p01-current-platform.png` 与 `p01-packaged-macos-x64.png`；Playwright 页面截图不包含系统标题栏。
- macOS Apple Silicon arm64：未验证，无 Apple Silicon 主机。

## 当前结论

P01 的共享工程、安全边界、平台适配入口、三个构建命令、自动检查和当前 Intel Mac 最小打包已达到验收条件。结论限定为“P01 工程与当前环境通过”；Windows 11 x64 与 Apple Silicon macOS arm64 仍是同等正式目标，但因无环境未完成运行、截图和安装包验收，不能宣称双平台实机兼容已经完整通过。

## 构建产物证据

- `release/0.1.0/mac/Sonavi.app/Contents/MacOS/Sonavi`：Mach-O 64-bit executable x86_64。
- `Info.plist`：`CFBundleIdentifier=com.sonavi.desktop`、版本 0.1.0、`LSMinimumSystemVersion=13.0`。
- `app.asar`：包含 `/out/main/index.js`、`/out/preload/index.cjs`、`/out/renderer/index.html`。
- 未签名/未公证，使用 Electron 默认图标；这些属于开发测试包限制，不冒充 P10 发布产物。

## 已观察的非阻断提示

- `npm ci` 提示 electron-builder 与测试工具传递依赖中的旧包 deprecated（含 glob 7 与已修复但停止维护的 glob 10.5）；当前无 engine 冲突且官方审计为 0，后续上游升级时移除覆盖并复核。
- renderer 构建提示 Zod 注释位置无法由 Rollup 解释并被移除；构建与运行均通过，未影响 schema 行为。
