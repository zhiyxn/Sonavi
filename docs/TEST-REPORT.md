# P03 最短播放链路测试报告

更新日期：2026-09-13
状态：P01～P03 本机代码闸门通过；实际服务基础连接/专辑/播放成功，分页修复待实际服务复验

## 测试环境

- 当前主机：macOS 13.7.8 Intel x64（Darwin 22.6.0）
- Node.js：22.19.0（NVM）
- npm：10.9.3
- Electron：44.3.0
- 分支：`main`
- P01 远端提交：`959e742030c3d5795f2632a5f092e81472c1b056`
- P02 提交：`282ce86`（已推送；GitHub Actions run `34760475489` 三目标成功）
- P03 生命周期修复提交：`4d1777d`（已推送；run `34762062759` 三目标成功）
- 当前专辑分页修复：工作区未提交

## P01 远端 CI 证据

GitHub Actions run：`34749707166`，结论 `success`，运行页面：https://github.com/zhiyxn/Sonavi/actions/runs/34749707166

| 目标 | Runner | Job ID | 结果 | 已执行步骤 |
| --- | --- | --- | --- | --- |
| Windows x64 | `windows-2025` | `103703858252` | 通过 | checkout、Node、`npm ci`、lint、typecheck、unit/component、Electron smoke、Windows x64 打包 |
| macOS Intel x64 | `macos-15-intel` | `103703858433` | 通过 | checkout、Node、`npm ci`、lint、typecheck、unit/component、Electron smoke、macOS x64 打包 |
| macOS Apple Silicon arm64 | `macos-15` | `103703858562` | 通过 | checkout、Node、`npm ci`、lint、typecheck、unit/component、Electron smoke、macOS arm64 打包 |

这些是 P01 提交的自动化 runner 证据。Windows Server runner 不等于 Windows 11 桌面人工验收，macOS 15 runner 不等于 macOS 13 最低版本与真实设备 UI/安装验收。

## 当前 P01～P03 自动验证

| 命令/检查 | 结果 | 证据/说明 |
| --- | --- | --- |
| `npm run lint` | 通过 | ESLint 10.10.0，0 warning |
| `npm run typecheck` | 通过 | main/preload、renderer、tests 三组通过 |
| `npm test` | 通过 | 9 个文件、43 项测试通过 |
| `npm run build` | 通过 | main、preload CJS、renderer 构建成功 |
| `npm run test:e2e` | 通过 | 真实 Electron 连接本地 fixture；按 `offset=0/30` 加载 31 张专辑的两页数据，第二页后正确收口，并继续完成详情、播放/暂停/seek、会话/凭据和 macOS 生命周期检查 |
| `npm run pack:dir` | 通过 | 生成未签名 macOS x64 目录包；首次受限网络失败后获准下载官方 Electron 文件并复跑成功 |
| 包内 Electron 冒烟 | 通过 | 未签名 x64 `Sonavi.app` 同样完成连接、播放/暂停/seek、会话清理、跨进程凭据恢复/删除、safeStorage、截图、关闭/重激活 |

## P02/P03 覆盖范围

- URL：HTTPS 默认、自定义端口、中文/编码子路径、`/rest` 后缀、拒绝嵌入账号/查询/片段、HTTP 显式风险确认。
- 认证：官方示例 token 值、UTF-8 `md5(password + salt)`、每请求随机 salt、URL 无 `p` 明文参数。
- 协议：`ping`、扩展探测、音乐文件夹；服务端数字 ID 转为 string；旧服务器缺少扩展端点可降级。
- 错误：DNS、拒绝连接、超时、TLS、重定向、HTTP 401/403/5xx、Cloudflare challenge、HTML、非法 JSON、超大响应、协议认证/认证方式/权限/版本。
- 存储：系统加密可用时文件中无明文密码；不可用时不创建凭据文件；当前 Intel Mac 异步 safeStorage 加解密、应用进程重启恢复、显式删除和删除后重启不恢复均通过。
- 边界：IPC 校验主 frame/窗口/来源与输入；preload 只暴露应用信息、固定连接/恢复/退出和音乐库方法；renderer 对返回值再次校验，不获得原始 IPC、Node 或任意 URL 请求能力。
- P03 数据：`getAlbumList2` 使用受校验的 offset/size，每页 30 张；返回 items/nextOffset/hasMore，renderer 用 Infinite Query 累积并按 ID 去重；`getAlbum` 详情与会话生命周期保持不变。
- P03 媒体：renderer 只获得随机 `sonavi-media` URL；覆盖 GET/HEAD 方法限制、单段 Range、200/206/416、重定向/非媒体/网络失败拒绝，以及安全响应头白名单。
- P03 流：生产 handler 以保留背压的 ReadableStream 传递上游内容，不调用 `arrayBuffer()` 或 Base64 IPC；会话撤销会 Abort 活动上游请求。Electron 冒烟实际执行播放、暂停、2 秒 seek 与恢复播放。

## 分平台结果

| 验证项 | Windows 11 x64 | macOS 13 Intel x64 | macOS 13+ arm64 |
| --- | --- | --- | --- |
| P01 CI 自动化 | Windows x64 runner 通过 | Intel runner 通过 | arm64 runner 通过 |
| P02 基础提交远端 CI | 三目标成功 | 三目标成功 | 三目标成功 |
| P02 开发/生产启动 | 未验证：无实机 | 通过 | 未验证：无实机 |
| P02 目录包 | 未验证：无实机 | x64 目录包启动通过；DMG 未安装 | 未验证：无实机 |
| P02 safeStorage | 单元失败路径通过；实机未验证 | 异步加密往返、跨进程恢复/删除通过 | 单元失败路径通过；实机未验证 |
| P02 UI 截图 | 未验证 | 开发构建与目录包截图目视通过，无截断/重叠 | 未验证 |
| P03 截至 `4d1777d` 远端 CI | 三目标成功 | 三目标成功 | 三目标成功 |
| P03 专辑/媒体/Audio 冒烟 | 未验证：无实机 | 生产构建与 x64 目录包播放/暂停/seek、会话清理通过 | 未验证：无实机 |
| P03 UI 截图 | 未验证 | 专辑详情与播放器目视通过，无截断/重叠 | 未验证 |
| P03 物理听音 | 未验证 | 未验证：自动播放事件不等同听音 | 未验证 |
| 真实服务器 | 未验证 | 用户实际服务的连接、首批专辑、播放成功；分页修复待复验 | 未验证 |

## 安全检查

- [x] `contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`、`webSecurity=true` 与 CSP 保持不变。
- [x] `webviewTag=false`、`allowRunningInsecureContent=false`、`navigateOnDragDrop=false` 显式设置；CSP 使用 `default-src 'none'` 与 `frame-ancestors 'none'`。
- [x] renderer 源码不导入 Node/Electron，不访问 `process` 或原始 `ipcRenderer`。
- [x] 连接 IPC 不是任意网络代理；输入和输出均有运行时 schema。
- [x] 密码不进入 Pinia、localStorage、日志或认证 URL，提交结束后清空输入框。
- [x] Electron Session 不自动跟随重定向，不关闭 TLS/证书验证。
- [x] JSON 响应限制为 1 MiB，网页/非法协议响应不能伪装连接成功。
- [x] safeStorage 不可用、加密失败或写入失败时不回退明文。
- [x] `sonavi-media` 不启用 `bypassCSP`；CSP 只允许该 scheme 用于封面与媒体。
- [x] 媒体句柄不含凭据/上游 URL；新连接、断开、忘记账号和退出会使旧会话失效并中止活动流；重定向不会携认证信息跟随。
- [x] 音频响应流式传递，不整首缓冲或跨 IPC 传 Base64。
- [x] 当前只实现 P03 单曲最短链路；托盘、后台宿主和队列未提前实现。

## 截图证据

- macOS Intel x64：已生成并目视检查 `artifacts/screenshots/p03-current-platform.png`、`p03-macos-x64-package.png` 与 `p03-pagination-macos-x64-package.png`；分页后专辑详情、中文/英文字体与播放器无截断/重叠。Playwright 页面截图不包含系统标题栏。
- Windows 11 x64：未验证，无 Windows 11 实机。
- macOS Apple Silicon arm64：未验证，无 Apple Silicon 实机。

## 当前结论

用户实际服务已证明 P03 基础连接、首批专辑和播放链路可用，并暴露固定 30 张的问题。本轮分页修复通过 31 张两页的真实 Electron fixture 测试，但尚未在用户服务复验、提交或进入 CI。Windows 11、Apple Silicon 实机、转码/反向代理差异和物理听音仍未验证。

## 已观察的非阻断提示

- renderer 构建继续提示 Zod 注释位置无法由 Rollup 解释并移除；构建、schema 行为与运行均通过。
- macOS 目录包未签名；Electron 官方说明未稳定签名的不同构建可能触发 Keychain 重复授权，需在 P10 签名验收中复核。
