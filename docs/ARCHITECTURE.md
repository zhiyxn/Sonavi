# Sonavi 架构

更新日期：2026-09-13

## 单工程与共享边界

```text
共享 Vue renderer
  连接 / 音乐库 / 搜索 / 收藏 / 歌单 / 歌词 / 设置
  Pinia + TanStack Vue Query + 单一 AudioEngine
                    │
                    │ 受限、类型化 preload API
                    ▼
共享 Electron main ────────────────┐
  认证 / 协议客户端 / 网络 / 存储  │
  媒体协议 / 缓存 / 诊断           │
                    │              │
                    ▼              ▼
       src/main/platform/      Electron / OS
       窗口、菜单、快捷键、
       托盘/Dock、路径和生命周期
```

不创建 Windows/Mac 两套前端，不复制页面。只有当 Electron 或操作系统行为确实不同，适配代码才进入 `src/main/platform/`；共同行为留在共享 main、preload 或 renderer 层。

## 当前目录职责

- `src/main/`：窗口、安全策略、IPC 注册、OpenSubsonic 网络客户端与 CredentialStore；允许使用 Node.js/Electron。
- `src/main/platform/`：最小平台差异。P01 只含原生窗口选项、菜单、快捷键标签和最后窗口生命周期。
- `src/preload/`：唯一 renderer 桥；暴露类型明确的应用信息、连接/恢复/退出和固定音乐库方法，不暴露原始 IPC 或 Node 对象。
- `src/shared/`：IPC channel、TypeScript 类型与 Zod 运行时 schema。
- `src/renderer/`：一套 Vue + Tailwind CSS 应用，shadcn-vue 组件源码与 Sonavi tokens 共用；平台展示数据来自 preload，不读取 `process`。
- `src/renderer/src/stores/player.ts`：单一 HTMLAudioElement AudioEngine 的 P03 实现；P04 在此扩展队列和完整状态机。
- `tests/`：平台策略、契约、共享 UI 与真实 Electron 冒烟。

## 安全模型

BrowserWindow 固定 `contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`、`webSecurity=true`、`webviewTag=false`、`allowRunningInsecureContent=false`、`navigateOnDragDrop=false` 并使用原生 frame。CSP 以 `default-src 'none'` 默认拒绝，仅逐项开放本地脚本/样式、媒体 scheme 与开发 localhost WebSocket，并拒绝 frame ancestor。main 默认拒绝权限请求、窗口打开和应用外导航。

应用信息、连接与音乐库 IPC 同时执行：主 frame/所属 BrowserWindow 检查、开发 origin 或打包后精确文件路径检查、输入/返回数据 Zod 校验。renderer 再校验返回值。连接 IPC 只接受服务器地址、用户名、一次性密码和两个布尔选项；音乐库 IPC 只接受不透明会话 ID 与资源 ID，不提供任意 URL 请求能力。

P02 的连接客户端位于 `src/main/services/opensubsonic/`，使用 Electron Session 的 Chromium 网络栈，禁止自动重定向并限制 JSON 响应为 1 MiB。认证按每次请求独立 salt 生成 token，明文密码不进入 URL、日志、renderer store 或持久化文件。`ping` 成功后探测 OpenSubsonic 扩展与音乐文件夹；旧服务器缺少扩展端点时可降级，认证和音乐库权限失败不能伪装成功。

统一 `CredentialStore` 位于 `src/main/services/credentials/`，只在 app ready 后调用 Electron 44 的异步 safeStorage。持久化文件放在 `app.getPath('userData')`，通过同目录临时密文文件替换保存；密码字段只写入系统加密密文。加密或写入失败时保留 main 进程会话凭据并明确返回 `session-only`，不回退明文。启动时可解密恢复，safeStorage 请求密钥轮换时先重加密；“退出并忘记账号”显式删除持久化文件。

P03 的 `MediaHandleRegistry` 只向 renderer 返回随机、不透明的 `sonavi-media://media/<uuid>`。自定义 scheme 在 app ready 前注册为 standard/secure/fetch/stream，但不启用 bypassCSP；处理器在 default Session 上注册。main 根据当前会话解析句柄并重新生成认证 URL，拒绝重定向、非法/多段 Range、非媒体内容类型与非 200/206/416 响应。响应体以保留背压的 Web Stream 传递，不调用 `arrayBuffer()`、不做 Base64 IPC。退出、忘记账号、切换账号与真正退出会撤销对应句柄并通过 AbortController 中止尚未完成的上游流。CSP 只为 `img-src` 和 `media-src` 增加该 scheme。

## 平台生命周期规则

| 行为 | Windows | macOS | P01 状态 |
| --- | --- | --- | --- |
| 窗口装饰 | 系统原生边框/按钮 | 系统原生边框/按钮 | 已实现 |
| 菜单 | 文件/编辑/窗口 | 应用/编辑/窗口 | 已实现基础模板 |
| 快捷键提示 | Ctrl | Cmd | 已通过 preload 集中提供 |
| 关闭最后窗口 | 退出进程 | 关闭窗口，保留 Dock 应用 | 已实现 |
| 重新激活 | 重新启动后创建窗口 | Dock 激活时重建窗口 | macOS 已实现 |
| 托盘/隐藏继续播放 | P09 定义 | P09 定义 | 未实现 |
| 真正退出 | 关闭最后窗口或菜单退出 | 应用菜单/Cmd+Q | 已实现基础角色菜单 |

窗口重建不能在未来破坏单一 AudioEngine 宿主。P09 实现后台播放前必须先决定宿主生命周期，不能通过销毁 renderer 达成“隐藏”。

## 构建边界

`electron-vite` 只构建一套 main/preload/renderer。`electron-builder.yml` 为 Windows x64、macOS x64 和 macOS arm64 指定独立目标；脚本显式传入架构，不启用 Windows ARM64、Linux 或 universal。
