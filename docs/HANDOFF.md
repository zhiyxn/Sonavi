# 项目交接

更新日期：2026-09-13

## 当前目标

仅完成 P01 工程基础及 Windows/macOS 双平台基础修正，不提前实现 P02 认证或播放器功能。

## 当前分支与最近已验证提交

- 分支：`main`
- 最近提交：P01 Windows/macOS 双平台工程基线（具体哈希以 `git log -1` 为准）
- 未执行推送、发布或安装包上传

## 工作区未提交改动

提交完成后工作区应无未提交项目文件。用户原有 `.gitignore` 与两个被忽略的原始参考目录已保留；本轮只向 `.gitignore` 追加生成物/秘密规则。`node_modules/`、`out/`、`release/`、`artifacts/` 和原始参考包不进入提交。

## 已完成代码

- 单套 Electron 44/electron-vite 5/Vue 3/TypeScript 工程配置。
- 原生窗口、安全策略、类型化应用信息 IPC。
- `src/main/platform/` 中 Windows/macOS 窗口、菜单、快捷键、生命周期适配。
- 共享连接页、应用外壳、Sonavi tokens 与跨平台字体 fallback。
- AudioEngine 空契约；没有 Audio 实例或假播放。
- Windows x64、macOS x64、macOS arm64 electron-builder 脚本。
- 三目标 GitHub Actions 构建矩阵；不上传产物，尚未远端执行。
- schema、平台策略、共享 UI 与 Electron 启动冒烟测试。

## 已执行自动验证

- `npm ci`：通过，lockfile 使用 npm 官方注册表，安装 524 packages；只有上游 deprecated 提示，无 engine 警告。
- `npm audit`：0 vulnerabilities；js-beautify 的 glob 高危版本已精确覆盖为 10.5.0。
- `npm run lint`：通过，0 warning。
- `npm run typecheck`：通过，main/preload、renderer、tests 三组均通过。
- `npm test`：通过，3 个文件、7 项测试。
- `npm run build` / `npm run test:e2e` 内建构建：通过；main、sandbox CJS preload、renderer 均产出。
- `npm run pack:dir`：通过，生成 `release/0.1.0/mac/Sonavi.app`（未签名目录包）。
- 包检查：Mach-O x86_64；`LSMinimumSystemVersion=13.0`；asar 含 main/preload/renderer 入口。

## 已执行真实服务器与实机验证

尚未连接真实服务器（P02）或播放音频（P03）。macOS 13.7.8 Intel 上已执行开发启动、生产 Electron 冒烟、renderer 截图、未签名目录包启动，以及关闭窗口后 Dock 激活重建。Windows 与 Apple Silicon 无可用实机。

## 关键架构与安全决策

见 `docs/DECISIONS.md`。最关键的是：Windows/macOS 首版同等支持、共享一套 renderer、平台差异集中、原生窗口控件、renderer 无 Node/process、P01 不承诺后台播放。

## 当前问题和最小复现

已解决三个实测问题：Vite 8 超出 electron-vite peer 范围、TypeScript 7 超出 typescript-eslint peer 范围，以及 sandbox preload 不能直接加载 ESM/外部 Zod。最终 preload 构建为无第三方运行时依赖的单文件 CJS。当前无已知阻断性问题。

## 未验证项

- Windows 11 x64 全部运行、打包、UI、菜单与关闭行为。
- Apple Silicon macOS arm64 全部运行、打包、UI、菜单与关闭行为。
- Intel Mac 的未签名 DMG 安装、签名、公证。
- 真实 Navidrome、safeStorage、音频、托盘、Dock 播放宿主（分别属于后续阶段）。

## 下一项可执行任务

在 Windows 11 x64 主机执行 `npm ci`、`npm run lint`、`npm run typecheck`、`npm test`、`npm run test:e2e` 与 `npm run build:win`，记录原生窗口、Ctrl 提示、菜单、关闭/退出和截图。没有 Windows 环境时，不开始 P02 来掩盖这一待验证项。

## 不应重做或覆盖的内容

- 不重新初始化项目，不建立第二套 Windows/Mac 前端。
- 不修改/删除 `Sonavi_UI_v0.1/` 与 `navidrome-vibe-coding-kit/` 原始解压参考。
- 不把任何平台改成“后续适配”。
- 不提前实现 P02～P10，也不放宽 Electron 安全设置。
