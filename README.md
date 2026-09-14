# Sonavi

Sonavi 是一套同时正式面向 Windows 11 x64、macOS 13+ Intel x64 与 macOS 13+ Apple Silicon arm64 的 Navidrome 桌面客户端。两个平台共享同一套 Electron/Vue 工程、renderer 和业务代码；当前 P01～P06 已按顺序落地，P05 已通过三目标 CI，P06 已通过本地 Windows x64 代码与目录包闸门，真实服务器、提交后 CI 与各目标实机证据仍分别记录。

## 当前能力

- 原生系统窗口边框与控制按钮；
- 共享的真实连接表单与应用外壳；
- `main → preload → renderer` 类型化应用信息与连接 IPC；
- `contextIsolation`、sandbox、CSP、导航/窗口/权限限制；
- OpenSubsonic token/salt 认证、`ping`、能力探测、音乐文件夹与分层错误诊断；
- main 内 CredentialStore 与 safeStorage 加密保存、跨重启恢复和显式删除；失败时仅会话使用，不写明文；
- 分页 `getAlbumList2` / `getAlbum` 专辑浏览，以及不透明 `sonavi-media://` 封面/音频句柄；
- 单一 HTMLAudioElement AudioEngine、流式 `stream`、播放/暂停/seek、Range 200/206/416、会话取消与重定向拒绝；
- P04 枚举播放状态机、generation 隔离、专辑队列、重复追加、删除、清空、重排、顺序/随机、单曲/列表循环、上一首/下一首与音量；
- P05 首页、字母序专辑分页、艺术家/详情、窗口化长列表、可取消分页搜索和基础设置页；
- P06 服务器事实驱动的艺术家/专辑/歌曲收藏，以及歌单列表、详情、创建、编辑、删除、队列追加、按索引移除与整单播放；
- Tailwind CSS 4 与项目持有的 shadcn-vue 组件源码，共用 Sonavi tokens；
- 集中的 Windows/macOS 菜单、快捷键提示与窗口生命周期适配入口；
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

`test:e2e` 会先构建，再启动真实 Electron 窗口和本地受控 OpenSubsonic fixture，验证连接、分页专辑、封面、合成 WAV 流式播放、队列前后切换、preload 隔离、safeStorage 与当前平台生命周期，并将截图写入 `artifacts/screenshots/`。它不连接真实 Navidrome，也不等价于物理听音或另一操作系统的人工验收。

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

`.github/workflows/ci.yml` 为 Windows x64、macOS Intel x64 与 macOS Apple Silicon arm64 建立独立检查/打包 job，不上传产物。P05 提交 `b8b61d5` 的 run `34798063277` 三个目标全部成功；当前 Windows x64 主机另已通过生产构建、Electron 冒烟、目录包冒烟与 NSIS 生成。

更多状态与边界见 [兼容性](docs/COMPATIBILITY.md)、[测试报告](docs/TEST-REPORT.md) 和 [交接](docs/HANDOFF.md)。
