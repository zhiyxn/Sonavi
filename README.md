# Sonavi

Sonavi 是一套同时正式面向 Windows 11 x64、macOS 13+ Intel x64 与 macOS 13+ Apple Silicon arm64 的 Navidrome 桌面客户端。两个平台共享同一套 Electron/Vue 工程、renderer 和业务代码；当前 P01～P10 已按顺序落地到发布前代码闸门。macOS Intel 已完成未签名 x64 DMG 的生成、挂载、临时安装与全链路 Electron 冒烟；提交 `ce82e9e` 的第二轮 P10 CI 已使 Windows 全流程通过，但两个 macOS job 又暴露音频请求和暂停队列持久化时序问题。修复已提交为 `1f23427` 并通过 Windows 源码/打包应用回归，仍需新 CI 和对应实机安装验收。

## 当前能力

- 原生系统窗口边框与控制按钮；
- 用户指定的 Sonavi 标志已用于应用内品牌位、页面图标及 Windows/macOS 打包图标；
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
- P07 按服务器能力选择结构化/旧版歌词，同步行高亮、多版本切换，以及基于真实播放累计时间且过滤 seek 的 now-playing/submission 上报；
- P08 提供原始/MP3 兼容/自动播放策略、受能力约束的转码 seek、统一系统/直连/手动代理和脱敏连接诊断；
- P09 提供同一 AudioEngine 宿主的关闭隐藏/重新激活、托盘播放控制、明确真正退出、Media Session 媒体键、主题/音量/窗口/暂停队列持久化，以及账号隔离的限量封面缓存；
- Tailwind CSS 4 与项目持有的 shadcn-vue 组件源码，共用 Sonavi tokens；
- 集中的 Windows/macOS 菜单、快捷键提示与窗口生命周期适配入口；
- P10 安装包元数据、目标架构、ASAR、资源、签名状态与 SHA-256 验证，以及打包应用 Electron 冒烟入口；
- lint、类型检查、单元/组件测试、Electron 冒烟和 electron-builder 配置。

## 开发环境

```sh
nvm use
npm ci
```

项目固定 Node.js 22.19.0 与 npm 10.9.3，并锁定 electron-vite 5 与 Vite 7 兼容线；不要误用 `/usr/local/bin/node`。

## 开发与检查

```sh
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`test:e2e` 会先构建，再启动真实 Electron 窗口和本地受控 OpenSubsonic fixture，验证连接、分页专辑、封面、合成 WAV 流式播放、队列、歌词同步、scrobble、收藏/歌单、preload 隔离、safeStorage、Media Session、关闭隐藏/恢复、暂停队列恢复与当前平台性能采样，并将截图写入 `artifacts/screenshots/`。它不连接真实 Navidrome，也不等价于物理听音或另一操作系统的人工验收。

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

产物写入 `release/<version>/`。普通构建仍使用 `--publish never`，不会自行发布或上传。候选版本使用 `v*-rc.*` 标签触发独立 Release 工作流，在三个原生目标全部重新验证通过后创建 GitHub Pre-release；当前未签名/未公证文件只能作为明确标注的测试包。可以在当前主机用 `npm run pack:dir` 做最小目录打包检查，但跨平台打包成功不作为相应平台兼容证明。

每个目标构建后还应在同一目标系统执行：

```sh
npm run verify:package -- win-x64      # 或 mac-x64 / mac-arm64
npm run test:e2e:package -- win-x64    # 或 mac-x64 / mac-arm64
```

验证器生成本地 manifest，记录架构、应用标识、资源、签名状态与 SHA-256。签名、公证、安装和发布闸门见 [发布前清单](docs/RELEASE-CHECKLIST.md)。

`.github/workflows/ci.yml` 为 Windows x64、macOS Intel x64 与 macOS Apple Silicon arm64 建立独立检查/打包/包验证 job，不上传产物。修复提交 `1f23427` 随文档提交 `51cf322` 进入 run `34934352140`，三个 job 的源码冒烟、安装包、包验证和打包应用冒烟均通过。`.github/workflows/release.yml` 只响应与 `package.json` 完全匹配的候选标签，重新运行同等闸门后上传三个安装包、三份 manifest 与 `SHA256SUMS.txt`，并创建明确标注未签名/未公证的 Pre-release。

更多状态与边界见 [兼容性](docs/COMPATIBILITY.md)、[测试报告](docs/TEST-REPORT.md) 和 [交接](docs/HANDOFF.md)。
