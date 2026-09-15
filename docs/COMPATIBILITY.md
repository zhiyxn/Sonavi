# Sonavi 兼容性矩阵

更新日期：2026-09-15

## 首版目标

| 目标 | 构建入口 | 当前证据 | 状态 |
| --- | --- | --- | --- |
| Windows 11 x64 | `npm run build:win` | `ce82e9e` CI 的源码/打包应用冒烟、NSIS 与包验证全通过；当前 Windows 主机对 `1f23427` 队列修复再次完成同组回归 | 正式目标，自动闸门通过，实机安装待验收 |
| macOS 13+ Intel x64 | `npm run build:mac:x64` | 13.7.8 Intel 主机曾完成 DMG、包验证、挂载临时安装和完整 Electron 冒烟；`ce82e9e` CI 在重启队列恢复超时，`1f23427` 持久化修复待新 CI | 正式目标，自动闸门待复验 |
| macOS 13+ Apple Silicon arm64 | `npm run build:mac:arm64` | `ce82e9e` 原生 CI 的源码冒烟、arm64 DMG 与包验证通过；包内冒烟因同步读取音频请求过早失败，`1f23427` 条件等待修复待新 CI | 正式目标，自动闸门待复验 |

Windows ARM64、Linux 与 macOS Universal 合并包不是首版强制交付。缺少的实机证据标为未验证，不改变 Windows/macOS 同等正式支持地位。

## 锁定工具链

| 项目 | 版本 | 兼容性依据/状态 |
| --- | --- | --- |
| Node.js | 22.19.0 | `.nvmrc` 与 npm 10.9.3；满足 electron-vite 的 Node 22.12+ 要求 |
| Electron | 44.3.0 | 官方 Electron 44 基线为 macOS 13+；提供 win32 x64、darwin x64/arm64 二进制 |
| electron-vite | 5.0.0 | main/preload/renderer 三构建目标均通过；main 内联 Zod |
| Vite | 7.3.6 | 位于 electron-vite 5 支持范围；生产构建通过 |
| electron-builder | 26.15.3 | 同一配置生成 NSIS x64、DMG x64 与 DMG arm64；本地 x64 DMG和远端另两目标构建有证据 |
| Vue / Pinia / TanStack Query | 3.5.42 / 4.0.3 / 5.102.8 | 共享 renderer，无平台分叉或原生模块 |
| Tailwind CSS / shadcn-vue 基础 | 4.3.3 / 项目持有源码 | 共享 tokens 和组件；当前 macOS Intel 截图通过 |

升级 Electron、electron-builder 或原生依赖时，必须重新验证三个目标架构、macOS 最低版本、safeStorage、签名/公证和包结构。不要使用旧聊天中的未核验版本号。

## 路径、依赖与包内容

- main 存储全部以 `app.getPath('userData')` 为根；不硬编码 `/Users`、`C:\\Users`、盘符或分隔符。
- 凭据、桌面状态与封面缓存使用 Node path/fs 和版本化文件；安装目录不写用户数据。NSIS 配置 `deleteAppDataOnUninstall: false`。
- npm scripts 使用 npm 与 Node.js 入口，不把 `rm`、`cp` 或 `export` 作为跨平台脚本。
- 当前没有项目自有原生 Node 模块；Electron 自身使用目标架构官方二进制。
- main 将 Zod 内联，ASAR 只包含 `out/` 与 `package.json`。当前 macOS x64 ASAR 为 1,959,330 字节，不含构建期 `node_modules`；验证上限 16 MiB。
- 文件/目录名采用稳定英文和明确大小写 import；含空格/中文的 Windows 安装路径仍需实机验证。
- macOS Info.plist 明确 `LSMinimumSystemVersion=13.0`，并删除 Sonavi 不需要的相机、麦克风、蓝牙与音频采集说明。任意权限请求仍由 main 默认拒绝。
- HTTP Navidrome 只在用户显式允许时进入连接逻辑；HTTPS 证书校验、webSecurity 与 CSP 不因 ATS 元数据或打包而放宽。

## 签名与安全存储

- 当前 macOS Intel DMG 的 codesign 状态为 `unsigned`；交叉生成的 arm64 DMG 为无身份的 linker `ad-hoc`。两者均未公证，只能用于开发测试。
- Windows `740981f` CI 包没有发布证书；本机交叉生成的实际应用 EXE 为 x64 且 PE Certificate Table 为空，不能推断已经签名。
- macOS Developer ID 预置最小 `allow-jit` 与 `allow-unsigned-executable-memory` entitlements，不启用无需求的 `disable-library-validation`。
- CredentialStore 使用 Electron 44 异步 safeStorage；当前 Intel Mac 的包内加密往返、进程重启恢复和删除通过。Windows、Apple Silicon、签名后 Keychain 与跨版本升级仍需验证。
- safeStorage 密文绑定系统用户/密钥链，不支持跨机器复制；失败时只保留会话，不回退明文。

## 当前本机产物

- 环境：macOS 13.7.8（22H730）Intel x64，Node 22.19.0，npm 10.9.3。
- DMG：`release/0.1.0/Sonavi-0.1.0-mac-x64.dmg`，137,343,264 字节。
- SHA-256：`f5afe1f70024d71cdf319b561f4a59d0fb7c8fb4ffe682b889b6f6855a648074`。
- 应用：Mach-O x64；`com.sonavi.desktop`；0.1.0；macOS 13.0；未签名。
- 包内与 DMG 临时安装 Electron 冒烟均通过；物理听音、系统媒体键、菜单栏逐项和签名后 Gatekeeper 未验证。
- 本机另行交叉生成 arm64 DMG 与 Windows NSIS，只用于结构诊断：arm64 包验证通过并记录 `ad-hoc`；Windows 应用 EXE 为 x64 且无 Certificate Table。它们不替代对应架构原生启动或安装验收。

`release/` 是忽略的本地目录，以上位置不是公开下载地址，也不会随提交上传。

## CI 状态

`.github/workflows/ci.yml` 使用 `windows-2025`、`macos-15-intel` 和 `macos-15`。run `34912793294`（`ce82e9e`）中三个 job 的 lint、typecheck 与 105 项测试均通过；Windows 完成源码冒烟、NSIS、包验证和包内冒烟，arm64 完成到包验证后在包内真实音频请求断言失败，Intel 在源码冒烟的暂停队列重启恢复超时。提交 `1f23427` 以条件等待替代同步请求检查，并在断开/退出前显式 flush 队列、关闭进程前验证非敏感队列状态确已落盘；仍需新 CI 才能确认两个 macOS job。

macOS 15 runner 不替代 macOS 13 最低版本实机；GitHub runner 不替代安装器 UI、托盘/Dock、物理媒体键、真实音频或升级验收。

## 官方依据

- Electron 44 / macOS 13：https://www.electronjs.org/blog/electron-44-0
- Electron 44.3.0：https://releases.electronjs.org/release/v44.3.0
- Electron code signing：https://www.electronjs.org/docs/latest/tutorial/code-signing
- electron-builder v26 macOS：https://www.electron.build/v26/docs/mac/
- electron-builder Windows signing：https://www.electron.build/docs/features/code-signing/code-signing-win/
- Apple notarization：https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
