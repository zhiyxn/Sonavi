# Sonavi

Sonavi 是一套同时正式面向 Windows 11 x64、macOS 13+ Intel x64 与 macOS 13+ Apple Silicon arm64 的 Navidrome 桌面客户端。两个平台共享同一套 Electron/Vue 工程、renderer 和业务代码；P01 工程基础已完成，当前执行 P02 连接认证，不包含音乐播放。

## 当前能力

- 原生系统窗口边框与控制按钮；
- 共享的真实连接表单与应用外壳；
- `main → preload → renderer` 类型化应用信息与连接 IPC；
- `contextIsolation`、sandbox、CSP、导航/窗口/权限限制；
- OpenSubsonic token/salt 认证、`ping`、能力探测、音乐文件夹与分层错误诊断；
- main 内 CredentialStore 与 safeStorage 加密保存；失败时仅会话使用，不写明文；
- 集中的 Windows/macOS 菜单、快捷键提示与窗口生命周期适配入口；
- AudioEngine 接口占位（没有伪播放）；
- lint、类型检查、单元/组件测试、Electron 冒烟和 electron-builder 配置。

## 开发环境

```sh
nvm use
npm ci
```

项目固定 Node.js 22.19.0 与 npm 10.9.3。`electron-vite@5` 和 Vite 8 要求 Node.js 20.19+ 或 22.12+；不要误用 `/usr/local/bin/node`。

## 开发与检查

```sh
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`test:e2e` 会先构建，再启动真实 Electron 窗口、验证 preload/连接 IPC、renderer 隔离、safeStorage 和当前 macOS 窗口生命周期，并将当前平台截图写入 `artifacts/screenshots/`。它不连接真实 Navidrome，也不等价于声音或另一操作系统的人工验收。

## 平台构建入口

在对应操作系统安装依赖并执行：

```sh
# Windows 11 x64：在 Windows x64 主机运行
npm run build:win

# macOS 13+ Intel：在 Intel Mac 运行
npm run build:mac:x64

# macOS 13+ Apple Silicon：在 Apple Silicon Mac 运行
npm run build:mac:arm64
```

产物写入 `release/<version>/`。当前配置生成未签名开发测试包，不发布 Release、不上传安装包。可以在当前主机用 `npm run pack:dir` 做最小目录打包检查，但跨平台打包成功不作为相应平台兼容证明。

`.github/workflows/ci.yml` 为 Windows x64、macOS Intel x64 与 macOS Apple Silicon arm64 建立独立检查/打包 job，不上传产物。P01 提交的三个 job 已通过；当前未提交的 P02 增量尚未进入远端 CI。

更多状态与边界见 [兼容性](docs/COMPATIBILITY.md)、[测试报告](docs/TEST-REPORT.md) 和 [交接](docs/HANDOFF.md)。
