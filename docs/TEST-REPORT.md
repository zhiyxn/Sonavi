# P09 桌面集成与性能测试报告

日期：2026-09-14
状态：P01～P09 当前 macOS Intel 代码闸门通过；P08/P09 尚未提交或运行三目标 CI，真实服务器/大型资料库、Windows 11、Apple Silicon 和人工桌面交互待验证

## 测试环境

- 当前主机：macOS 13.7.8（22H730），Intel x64。
- Node.js：v22.19.0（NVM）；npm：10.9.3。
- Electron：44.3.0；electron-vite：5.0.0；electron-builder：26.15.3。
- 分支：`main`；开始 P08/P09 时 HEAD 与 `origin/main` 均为 `9b189a0`，当前两阶段改动均未提交。
- 受控服务：仅监听 `127.0.0.1` 的临时 OpenSubsonic fixture，合成 WAV/PNG，不使用用户服务或凭据。

## 命令结果

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm run lint` | 通过 | 0 warning |
| `npm run typecheck` | 通过 | main/preload、renderer、tests 三组通过 |
| `npm test` | 通过 | 22 个文件、96 项测试 |
| `npm run build` | 通过 | main、sandbox CJS preload、renderer 产出 |
| 源码 Electron 冒烟 | 通过 | 授权启动本机 Electron 后，源码完整通过 P01～P09 fixture |
| `npm run pack:dir` | 通过 | 授权下载 Electron 后生成 macOS x64 `release/0.1.0/mac/Sonavi.app`；未签名 |
| 包内 Electron 冒烟 | 通过 | 刚生成的 x64 `.app` 完整复跑 P01～P09 |

第一次 Electron P09 冒烟发现 sandbox preload 不能加载外部 Zod 模块，已修正为 preload 固定命令枚举检查、main 与 renderer Zod 校验后通过；随后一次测试脚本因切页后未返回设置页而找不到“断开连接”，已修正测试导航后完整通过。第一次 `npm run pack:dir` 因沙箱 DNS 无法访问 GitHub 下载 Electron，授权网络后通过。失败与修复均保留，不把失败运行记作通过。

## P08 自动测试覆盖

- 播放策略：原始、兼容、自动三种模式；128/192/256/320 kbps 输入边界。
- 自动选择：已知 `audio/*` 类型使用原始流并保留单次 MP3 回退；未知类型直接使用兼容转码，不声明覆盖所有编解码器。
- 有限回退：HTMLAudioElement 首次解码错误切换到唯一 fallback URL；第二次错误进入 `error`，不循环重试。
- 转码参数：main 为 `stream` 生成 `format=mp3`、`maxBitRate`、`estimateContentLength=true`；renderer 不获得上游 URL 或认证参数。
- seek 能力：兼容流只在扩展名实际包含 `transcodeOffset` 时标为可跳转；否则进度条禁用并提供说明。
- 转码换流：固定 IPC 校验 session、track 和 0～86400 秒偏移，main 生成带 `timeOffset` 的新不透明句柄。
- 完整时间线：片段 `audio.currentTime` 与 `timelineOffset` 相加；片段 duration 不覆盖歌曲总时长。播放器、同步歌词和 scrobble 共用该时间线。
- 代理：system/direct/fixed_servers 互斥；手动代理拒绝内嵌账号/密码、无端口、路径、查询和片段；切换后调用 `closeAllConnections`。
- 网络失败：代理设置失败直接返回失败，不调用 direct 兜底；HTTPS/证书验证未放宽。
- 媒体错误：覆盖 HTTP 200/206/416、401/403 分类、重定向、异常 MIME、网络失败、取消和中途断流。
- API 错误：识别 HTTP 200 中 JSON/XML 的 `subsonic-response.status=failed`，不把协议错误体记作成功。
- 诊断脱敏：记录阶段、代理模式、状态、内容类型、错误分类、耗时和建议；不记录 URL、账号、token、资源 ID 或正文。
- 日志上限：内存最多 200 条，导出 JSON 不超过 256 KiB；保存路径只由 main 的系统对话框取得。
- 回归：P02 连接/凭据、P03 分页/流、P04 队列、P05 搜索、P06 收藏/歌单、P07 歌词/上报继续通过。

## P09 自动测试覆盖

- 关闭行为：默认 `hide`，隐藏既有 BrowserWindow 且 window/webContents ID 不变；重新激活显示同一 AudioEngine 宿主。
- 真正退出：托盘菜单与关闭偏好使用独立 `app.quit()` 路径；自动化最终关闭应用并确认进程退出，菜单逐项人工点击待验证。
- 托盘模板：显示、播放/暂停、上一首、下一首、真正退出的标签、禁用态和命令路由有单元测试。
- Media Session：真实 Electron 验证 title 与 playbackState；确认 `MediaPlayPause` 未注册 globalShortcut，避免双入口重复触发。
- 快捷键：真实 Electron 验证 macOS `Cmd+,` 打开设置；纯函数覆盖 Windows `Ctrl+,`/macOS `Cmd+,` 区分。Space 与设置键均排除 input/textarea/select/button/link/contenteditable/textbox。
- 电源/网络：suspend/lock 发暂停，resume/unlock 关闭旧连接、撤销旧句柄并请求暂停队列新句柄；物理睡眠/锁屏待人工验证。
- 状态持久化：关闭动作、主题、音量、窗口状态原子落盘；损坏/缺失文件回到明确默认值。
- 队列持久化：文件不含密码、sessionId、认证 URL 或媒体句柄；不同账号哈希不可互相恢复，重启后以新句柄、暂停状态恢复。
- 封面缓存：账号隔离、5 MiB 单项、128 MiB 单账号、LRU 淘汰、当前账号清空、非图片/超限拒绝；音频路径不接缓存。
- 合成性能：固定 10,000 条艺术家记录在单元环境挂载少于 20 个按钮，时间阈值 1 秒；该数据不进入生产且不代替真实库测量。

## Electron 与目录包实测

受控 fixture 声明 `songLyrics` 和 `transcodeOffset`。源码与打包 `.app` 均完成：

1. 连接、31 张专辑两页、详情、封面和原始 WAV 播放；
2. 队列、重复歌曲、前后切换、暂停、原始流 seek、歌词同步和播放上报；
3. 收藏和歌单 CRUD；
4. 将策略切到兼容转码、码率 192 kbps、代理切到 direct；旧播放和句柄被安全停止/撤销；
5. 重新取歌并播放，实际请求包含 `format=mp3` 与 `maxBitRate=192`；
6. 进度跳到 2 秒，实际新请求包含 `timeOffset=2`，播放器仍显示完整歌曲 0:02/0:04；
7. 诊断页出现 API、封面和转码音频条目，刷新可用；
8. Media Session 同步歌曲名/播放态，且没有注册全局 MediaPlayPause；
9. 深色主题生效，关闭窗口后 BrowserWindow/webContents 未销毁，Dock/应用激活恢复同一宿主；
10. 20 轮设置/首页切换不新增媒体请求；最终源码工作集增量 52,224 KiB，最终包内增量 51,604 KiB；
11. 凭据跨重启恢复/删除、safeStorage 加密往返和暂停队列新句柄恢复继续通过。

截图：

- `artifacts/screenshots/p08-current-platform.png`
- `artifacts/screenshots/p08-diagnostics-current-platform.png`
- `artifacts/screenshots/p09-desktop-current-platform.png`
- `artifacts/screenshots/p09-macos-x64-package.png`

以上均为 macOS Intel 证据。P09 深色宿主、中文字段、播放器、按钮和目录包页面在当前字体下未见截断、重叠或应用级横向溢出；截图未覆盖系统托盘菜单或物理媒体键，不能据此宣布 Windows、Apple Silicon 或人工桌面交互通过。

## 分平台状态

| 验证项 | Windows 11 x64 | macOS 13+ Intel x64 | macOS 13+ arm64 |
| --- | --- | --- | --- |
| P09 lint/typecheck/unit | 未运行 P08/P09 提交 CI | 当前主机通过 96 项测试 | 未运行 P08/P09 提交 CI |
| P09 源码 Electron | 未验证 | 通过 | 未验证 |
| P09 目录包 | 未验证 | x64 `.app` 生成并运行通过；DMG 未生成/安装 | 未验证 |
| 关闭隐藏/同宿主恢复 | 未验证 | 自动化通过 | 未验证 |
| 托盘/菜单栏逐项人工操作 | 未验证 | 未验证 | 未验证 |
| Media Session/物理媒体键 | 未验证 | 元数据自动化通过；物理键未验证 | 未验证 |
| 暂停队列/封面缓存 | 未验证 | 受控 fixture 与单元测试通过 | 未验证 |
| 10k 合成列表/快速切页 | 未验证 | 通过；仅受控采样 | 未验证 |
| 真实大型资料库性能 | 未验证 | 未验证 | 未验证 |
| 原始/兼容转码 | 未验证 | 受控 WAV + MP3 参数链路通过 | 未验证 |
| transcodeOffset seek | 未验证 | 受控 fixture 通过 | 未验证 |
| system/direct/manual proxy | 未验证 | direct 实机切换通过；system/manual 仅单元验证 | 未验证 |
| 诊断页面与截图 | 未验证 | 通过 | 未验证 |
| 真实服务器 P08 | 未验证 | 未验证 | 未验证 |
| 物理听音 | 未验证 | 未验证 | 未验证 |

此前 P05 提交 `b8b61d5` 和 P06 提交 `a831be6` 的三目标 CI 成功；这不能替代 P08 提交的 CI。P07 已有 Windows x64 源码/目录包证据，但 P08 本轮没有 Windows 环境。

## 安全检查

- [x] `contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`、`webSecurity=true` 与严格 CSP 保持不变。
- [x] renderer 不访问 Node、`process`、原始 `ipcRenderer`、文件系统或任意 URL。
- [x] 网络设置和转码 seek 使用固定 preload 方法，main 检查受信发送者并用 Zod 校验输入/输出。
- [x] API、封面、原始音频和转码音频使用同一 Electron Session 与代理策略。
- [x] 手动代理设置不接受 URL 内嵌凭据；诊断不记录代理地址。
- [x] 代理失败不静默直连，TLS/证书验证未禁用，HTTPS 不降级。
- [x] 音频继续以 Web Stream 传递，不整首缓冲或跨 IPC Base64。
- [x] 认证 URL 仍只在 main 构造；媒体句柄不含服务器 URL、账号、token 或 salt。
- [x] 代理/播放策略切换撤销旧句柄和活动流，防止旧网络连接继续播放。
- [x] 导出内容结构化、脱敏且限量；renderer 不获得保存路径或文件写入能力。
- [x] 桌面 IPC 均为固定业务方法，main 校验受信发送者与 Zod 输入；preload 不加载 Node 外部模块、不暴露原始 IPC。
- [x] 队列持久化不含密码、sessionId、认证 URL 或不透明媒体 URL，账号范围由 main 计算。
- [x] 封面缓存只接受图片、有已知长度且不超过 5 MiB；音频仍为 Web Stream，不整首缓冲或落盘。
- [x] 忘记账号清除保存队列和当前账号缓存；其他账号目录不受影响。

## 未验证与风险

- 真实服务器是否支持 MP3 转码、允许的码率、转码器错误体及实际 `transcodeOffset` 语义。
- 自动回退在真实不可解码格式中的表现；当前只以受控 HTMLAudioElement 错误事件验证一次回退。
- PAC、认证代理、企业证书、真实 HTTP/HTTPS/SOCKS 代理及代理切换中的操作系统差异。
- Windows 11 和 Apple Silicon 的 Chromium 解码器差异、代理行为、进度换流、诊断 UI 和证书错误文案。
- macOS x64 目录包未签名；DMG、签名、公证与升级稳定性留到 P10。
- 物理听音未执行；`playing` 事件不等价于扬声器输出。
- Windows 与 Apple Silicon 的托盘图标/菜单、关闭隐藏、最小化、真正退出和窗口位置裁剪未实测。
- 当前 macOS Intel 尚未人工操作托盘菜单、物理媒体键、睡眠/锁屏；自动事件/同宿主证据不等价于 OS 级人工验收。
- 本机启动和工作集只测一次受控 fixture；没有冷热启动分布、长时间滚动/切歌或真实大型资料库数据，不据此声称低内存。

## 结论

P09 已达到当前 macOS Intel 的代码闸门：96 项测试、生产构建、源码 Electron、x64 目录打包和包内完整冒烟均通过，且 P01～P08 未回归。由于 P08/P09 尚未提交/运行三目标 CI，也未完成真实服务器/大型资料库、Windows 11、Apple Silicon 或人工托盘/媒体键/睡眠验证，当前不能宣称 P09 双平台最终验收完成。

## 非阻断提示

- renderer 构建继续提示 Rollup 移除 Zod 注释位置；构建、schema 与运行均通过。
- electron-builder 因无 Developer ID 跳过 macOS 签名，符合当前未授权签名/发布边界。
