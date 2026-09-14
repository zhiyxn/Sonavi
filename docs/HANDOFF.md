# 项目交接

更新日期：2026-09-14

## 当前目标

P01～P09 已按顺序落地。P09 的同一播放宿主隐藏/恢复、托盘、Media Session、桌面状态/暂停队列持久化、账号隔离封面缓存和性能采样已通过当前 macOS Intel 源码与 x64 目录包代码闸门；P08/P09 尚未提交、推送或运行三目标 CI。真实服务器/大型资料库、Windows 11、Apple Silicon、手工托盘/媒体键/睡眠和发布验收继续保留为未验证，不提前实现 P10。

## 分支与工作区

- 分支：`main`，开始 P08/P09 时与 `origin/main` 同为 `9b189a0`。
- 最近已提交阶段：`9e599fa feat(p07): 实现歌词与播放上报`。
- 当前工作区叠加包含 P08 与 P09 源码、测试、文档和本机截图，尚未提交；不得丢弃或拆除 P08 改动。
- `node_modules/`、`out/`、`release/`、`artifacts/` 与原始参考包按既有忽略规则处理；未修改原始解压资料。

## P08/P09 已完成代码

- `NetworkPolicyService` 将播放与代理设置保存在 Electron `userData` 下的非敏感 JSON；系统、直连、手动代理互斥，手动代理拒绝内嵌凭据、路径、查询和片段。
- API、封面和音频继续共用 `session.defaultSession`。切换代理先 `setProxy`，再 `closeAllConnections`；main 撤销当前媒体句柄和活动流，renderer 停止播放器并清查询缓存，不在失败时静默改为直连。
- 播放策略支持 `original`、`compatible`、`automatic` 和 128/192/256/320 kbps。兼容模式固定请求 `format=mp3`、`maxBitRate` 与 `estimateContentLength=true`。
- 自动模式对已知浏览器媒体类型先用原始流，并只提供一个兼容转码回退句柄；HTMLAudioElement 解码错误最多回退一次。未知类型直接选择兼容转码，不宣称覆盖所有格式。
- `TrackSummary.playback` 明确记录实际流模式、seek 模式和原因；播放器显示“原始音频/兼容转码”。
- 只有连接阶段实际取得的扩展名包含 `transcodeOffset` 时，main 才接受固定 `createTranscodeSeek` 请求并生成带 `timeOffset` 的新不透明句柄。未确认时进度条禁用并解释原因。
- 转码片段在 AudioEngine 内以 `timelineOffset + audio.currentTime` 映射为完整歌曲时间；歌词和 scrobble 继续只读取共享 player store 的完整时间线。
- 诊断环形记录区分 API、封面、原始音频和转码音频，保留 HTTP 状态、内容类型、错误分类、耗时和操作建议；不记录 URL、账号、认证参数、资源 ID 或正文。
- HTTP 200 协议错误体、401、403、重定向、异常媒体类型、网络/证书错误、取消和中途断流均有分类。导出最多 200 条并限制在 256 KiB 内，由 main 打开保存对话框。
- preload 只增加固定、类型化且有 Zod 校验的网络方法；renderer 仍无 Node、`process`、任意网络或原始 IPC 能力。
- `DesktopIntegrationController` 保留一个 BrowserWindow 和 Tray；默认关闭隐藏同一 renderer，托盘/菜单栏提供显示、播放控制与真正退出，macOS Dock 激活显示既有窗口。关闭偏好可改为真正退出。
- Media Session 是唯一系统媒体键入口，没有注册 `globalShortcut`；Space 快捷键排除全部编辑/交互控件。sleep/lock 暂停，resume/unlock 清连接和旧句柄后保持暂停。
- `DesktopStateService` 在 `userData/desktop-state.v1.json` 原子保存主题、音量、关闭动作、窗口状态和暂停队列元数据。账号哈希由 main 从服务地址/用户名生成，文件不含密码、sessionId、认证 URL 或媒体句柄；恢复重新生成句柄。
- `CoverCacheService` 只缓存有界封面：单项 5 MiB、单账号 128 MiB、LRU 淘汰。忘记账号/清空按钮只删除当前账号缓存，音频继续流式且不落盘。

## 已执行验证

- `npm run lint`：通过，0 warning。
- `npm run typecheck`：通过，main/preload、renderer、tests 三组均通过。
- `npm test`：通过，22 个文件、96 项测试。
- `npm run build`：通过；main、sandbox CJS preload、renderer 均产出。
- 源码 Electron 冒烟：当前 macOS Intel 通过 P01～P09 完整 fixture；第一次因 preload 在 sandbox 中加载外部 Zod 失败，已改为 preload 固定枚举校验、main/renderer Zod 校验并复测通过。
- `npm run pack:dir`：当前 macOS Intel x64 目录包生成成功；首次因沙箱 DNS 无法下载 Electron，授权网络后完成。未签名，未生成/安装 DMG。
- 包内冒烟：`release/0.1.0/mac/Sonavi.app` 完整通过 P01～P09，包括关闭隐藏/同 webContents 激活、Media Session、深色主题、暂停队列跨重启新句柄恢复和封面缓存。
- 性能采样：最终源码启动到连接 UI 约 1325 ms，20 轮设置/首页切换工作集增量 52,224 KiB、媒体请求 +0；最终 x64 包约 1411 ms、51,604 KiB、+0。仅是本机单次受控趋势，不是跨平台承诺。
- 截图：`artifacts/screenshots/p09-desktop-current-platform.png` 与 `p09-macos-x64-package.png` 已目视检查；当前 macOS Intel 深浅主题未见中文截断、重叠或应用级横向溢出。
- 构建继续出现 Rollup 移除 Zod 注释位置的非阻断提示；目录包因无 Developer ID 跳过签名。

## 实测能力与策略

受控 fixture 在 `getOpenSubsonicExtensions` 返回 `songLyrics` 与 `transcodeOffset`。本轮实测：原始 WAV 可直接播放和原生 seek；兼容策略向公共 `stream` 发送 MP3/192 kbps；转码 seek 通过新请求发送 `timeOffset=2`，界面、歌词和上报仍使用 0:02 的完整时间线。该结果只证明 Sonavi 控制逻辑和受控服务行为，不代表用户真实服务器支持相同扩展或转码器。

用户此前实际服务只确认连接、首批专辑和基础播放成功。本轮没有连接用户服务，没有写入服务端数据，也没有记录服务地址或凭据。

## 未验证项

- P08/P09 提交后的 Windows x64、macOS Intel x64、macOS arm64 CI。
- Windows 11 x64 与 Apple Silicon 的代理切换、原始/转码、seek、诊断、证书错误和截图。
- macOS 13 最低版本；当前主机是 macOS 13.7.8 Intel，符合基线，但仍需保存正式系统/包验收记录。
- 真实 Navidrome/OpenSubsonic 的实际扩展列表、转码器可用格式、码率限制、HTTP 200 错误体、403、断流和 `transcodeOffset` 语义。
- 系统代理/PAC、HTTP/HTTPS/SOCKS 手动代理的真实代理服务器；自动化仅验证配置调用和直连切换。
- 自动模式在真实不受支持编解码器上触发一次回退；受控测试覆盖状态机，但没有穷举格式。
- Windows/Apple Silicon 的托盘、关闭隐藏/真正退出、最小化、Media Session/物理媒体键、锁屏/睡眠、窗口位置恢复与截图。
- 当前 macOS Intel 的托盘菜单逐项人工点击、物理媒体键、锁屏/睡眠和扬声器听音；自动化已验证同宿主隐藏/恢复，但不能替代这些人工证据。
- 真实大型资料库的首屏、滚动、切歌、请求和内存趋势；10,000 条合成窗口化列表只证明 DOM 上限。
- DMG/NSIS 安装、签名、公证和 P10 发布审计。

## 下一项可执行任务

先审查并提交当前叠加的 P08/P09，再观察 Windows x64、macOS Intel x64、macOS arm64 三目标 CI。随后按可用实机补测托盘/菜单栏、媒体键、睡眠、真正退出与大型资料库；代码闸门完成不应被写成双平台人工验收。下一阶段是 P10 安装包、签名/公证占位、兼容性与发布前审计，未经用户授权不发布或索取密钥。

## 不应重做或覆盖

- 不重新初始化项目，不建立两套平台前端，不修改原始解压参考。
- 不回退现有安全设置、CredentialStore、媒体句柄、流式响应、队列、歌词或上报实现。
- 不把代理实现为 renderer 任意请求，也不在代理失败时直连。
- 不把 CI、受控 fixture、合成性能数据或一台 Mac 的截图写成 Windows/Apple Silicon/真实服务器/真实大型资料库验收。
- 未经用户要求不提交、推送、发布或上传安装包。
