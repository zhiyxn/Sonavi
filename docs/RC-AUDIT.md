# P11 Release Candidate 独立审查

日期：2026-09-16

## 结论

修复复核后的代码可以进入 Windows/macOS 真机测试，但不能据此判定可正式发布。

- Blocker：0
- Critical：0
- Major：4
- Minor：0
- Enhancement：0

原 Critical 已修复：媒体 URL 改为会话密钥加密、带 epoch 的无状态不透明 token，不再因全局 FIFO 上限淘汰队列音频；10,000 个后续封面句柄回归测试和源码/打包 Electron 冒烟均通过。仍开放的 4 个 Major 是需要真实环境证据的艺术家大库、scrobble、断网恢复和音频格式矩阵。

本轮在独立审查后按用户要求完成针对性修复，没有换框架或大重构；没有配置签名、公证、自动更新，也没有创建或发布 Release。

## 审查基线

- 分支：`main`，审查起点 `e304fb2`。
- 工作区原有未提交品牌资源：`build/icon.png`、`src/renderer/src/assets/sonavi-logo.png`；本轮保留并纳入构建/截图验证，没有另行改写。
- 审查期间发现用户新增的 `docs/Existing issues.md`，按真实 Windows 体验线索纳入审查，未改写该文件。
- 本轮主机：Windows NT 10.0.26200 x64（25H2）；Node.js 22.21.1，npm 10.9.4。
- `.nvmrc` 指定的 22.19.0 未安装；22.21.1 满足 `package.json` 的 `>=22.12.0 <23`，但该偏差已保留为测试环境事实。

## 本轮实际执行

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| `npm run lint` | 通过 | ESLint 0 warning |
| `npm run typecheck` | 通过 | node、web、test 三组通过 |
| `npm test` | 通过 | 24 个文件、115 项测试 |
| integration test | 无独立脚本 | 集成场景由 `npm test` 与 Electron fixture 覆盖；未虚构额外命令 |
| `npm run build` | 通过 | main/preload/renderer 构建成功；仅有 Zod PURE 注释位置提示 |
| `npm run test:e2e` | 通过 | 修复后源码 Electron 全链路冒烟；启动 694 ms；20 轮切页内存增量 51,720 KiB、媒体请求 +0 |
| `npm run build:win` | 通过 | 生成未签名 Windows x64 NSIS；未发布 |
| `npm run verify:package -- win-x64` | 通过 | x64、0.1.0-rc.3、unsigned、ASAR 1,862,401 字节；NSIS SHA-256 `72a5be09328afe0cceff365e85414880acd19e06c32cbae1265abebe0c5b9aac` |
| `npm run test:e2e:package -- win-x64` | 通过 | 打包应用全链路冒烟；启动 814 ms；内存增量 51,308 KiB、媒体请求 +0 |
| `npm audit --audit-level=high` | 通过 | 0 vulnerabilities |

本轮没有在 Windows 上交叉构建 macOS 包；未执行的 macOS 项目均记为未验证。此前 GitHub CI/Release 三目标全绿是历史自动化证据，不替代当前含未提交新 logo 的工作区，也不替代实机人工验收。

## 审查发现

### UI

- 生产代码未发现 Mock/fixture 数据入口；fixture 只存在于测试。
- 导航、收藏、歌单、播放、设置等可见动作均有事件处理；未连接侧栏的“连接服务器”已改为当前状态文本，不再伪装成按钮。
- 列表、搜索、艺术家、收藏、歌单和歌词有加载/空/错误状态；专辑详情补齐错误原因与原地重试。
- 中文字体栈覆盖 Segoe UI、微软雅黑、苹方和系统字体；歌曲、专辑、队列等主要长文本有截断。不同系统字体的人工边界仍需真机确认。
- 本轮 Electron 冒烟在 960×640 检查无应用级横向溢出并生成截图。1440×900 没有本轮精确尺寸截图，记为未验证。
- 播放状态增加固定最小宽度，工作区/队列/歌词使用低干扰滚动条，侧栏与播放器改用随主题变化的 chrome tokens；Windows 自动化截图已目视复核，跨系统字体仍待真机。

### Navidrome/OpenSubsonic

- fixture 覆盖登录、子路径、分页专辑、专辑/艺术家详情、搜索、收藏、歌单 CRUD、歌词、scrobble 请求和能力探测降级。
- API 与媒体都禁止自动重定向；子路径由规范化 URL 保留。
- `getArtists` 使用独立 16 MiB 有界响应上限，其他 JSON API 仍为 1 MiB；大型真实资料库需要在发生过错误的服务器复验。
- fixture 已观察 `submission=false/true` 的 scrobble 请求；除累计阈值外，真实 ended 也触发一次去重 submission。用户真实服务器的实际端点响应和计数规则仍待复现。
- 真实 Navidrome 版本、权限组合、旧协议端点和反向代理矩阵未完成。

### 播放

- 本轮真实 `HTMLAudioElement` 只播放合成 PCM WAV。Range 200/206/416、原始 seek、暂停、前后切歌、随机、单曲/列表循环、重复歌曲队列项、快速切歌与转码时间线的自动化路径通过。
- 转码测试检查 `format=mp3`、码率和 `timeOffset` 请求，但 fixture 返回的仍是 WAV；它不构成真实 MP3 转码输出验证。
- MP3、AAC/M4A、FLAC、Opus/Ogg 没有本轮真实样本；WAV 也只覆盖单一合成 PCM 变体。代码按服务端 `contentType` 选择策略并有一次 MP3 回退，不按扩展名判断，但 MIME 白名单不能替代具体容器/codec 解码验证。
- 网络 `waiting/stalled` 进入 buffering；最终 error 后提供手动“重试播放”，可按当前进度重建原始流或 `transcodeOffset` 流。自动在线恢复和退避仍未实现，真实断网恢复只记为部分通过。

### 生命周期与桌面

- 路由切换不断歌、关闭隐藏同一 BrowserWindow、真正退出前队列 flush、重启后暂停恢复新句柄均有 Electron 冒烟证据。
- 最小化、实际系统托盘/Dock 点击、进程正常退出后残留检查、真实睡眠/锁屏/唤醒仍需人工真机。
- Media Session handler 和元数据有自动化覆盖；物理媒体键没有验证。

### 安全

- `contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`、`webSecurity=true`；无 webview，导航、新窗口和权限默认拒绝。
- preload 仅暴露固定业务方法；main 校验主 frame URL、IPC 参数、会话与能力；renderer 无 `process`。
- 凭据保留在 main/safeStorage；诊断不记录 URL、账号、token、资源 ID 或正文；请求不跟随重定向并使用 `no-referrer`。
- 媒体句柄在断开、忘记账号、代理切换和真正退出时撤销；封面缓存按服务地址+账号哈希隔离。
- CSP 由构建插件区分开发与生产：打包页面为 `connect-src 'self'`，不再允许任意 localhost WebSocket；开发环境仍保留 HMR 来源。

### 资源与性能

- AudioEngine 切歌会移除旧元素监听器、清空 `src` 并 `load()`；单元测试覆盖迟到事件和 Promise 隔离。
- 封面缓存单项 5 MiB、单账号 128 MiB并有 LRU 测试。
- 10,000 条合成艺术家验证窗口化渲染；媒体句柄另以 10,000 个后续封面创建验证队列音频不失效。真实大库响应、滚动与图片加载仍待复验。
- 20 轮切页只是一轮短采样，且测试没有 CPU/内存硬阈值；长时间播放、反复切歌监听器/句柄趋势和退出残留进程仍未验证。

## 平台未验证摘要

### Windows

- NSIS 安装向导、含空格/中文安装路径、开始菜单/卸载和保留 userData。
- 托盘菜单逐项、关闭/最小化的人工行为、正常退出后无残留进程。
- 物理媒体键、锁屏/睡眠/唤醒、真实扬声器听音。
- 真实 Navidrome 的艺术家失败/后续播放失败、scrobble 计数与全部音频格式样本。
- 1440×900 与 Windows 字体/缩放组合；本轮只自动验证 960×640。

### macOS

- 当前含新 logo 的工作区未在 Intel x64 或 Apple Silicon arm64 构建、启动或安装。
- macOS 13 最低版本、Intel x64 与 arm64 的 DMG 安装和运行。
- Cmd 快捷键、Dock/菜单栏、窗口关闭/最小化/真正退出、无残留进程。
- 物理媒体键、锁屏/睡眠/唤醒、真实扬声器听音。
- 真实 Navidrome、全部音频格式、1440×900 与苹方字体/缩放组合。

签名、公证和自动更新明确不在 P11 范围内，不计入本阶段问题数量。
