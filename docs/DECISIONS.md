# 架构决策记录

## D001：Windows 与 macOS 从首版起同等支持

- 日期：2026-09-13
- 状态：已接受，覆盖旧约定

撤销所有“Windows 优先、macOS 后续适配”及相反方向的单平台优先约定。首版正式目标是 Windows 11 x64、macOS 13+ x64 与 macOS 13+ arm64。验证证据按平台分别记录，缺少环境时写“未验证”，不改变范围。

## D002：单仓库、单 renderer、最小平台适配

- 日期：2026-09-13
- 状态：已接受

共享客户端、认证、数据、播放、缓存、设置、页面与组件。实际操作系统差异集中到 `src/main/platform/` 和未来少量 main 系统服务中。禁止分别复制 Windows/Mac 页面，也不预建与真实需求无关的适配框架。

## D003：P01 使用原生窗口装饰

- 日期：2026-09-13
- 状态：已接受

BrowserWindow 使用 `frame: true` 与 `titleBarStyle: default`。设计图的 macOS 标题栏不进入共享 renderer，避免 Windows 假按钮和 macOS 双重控制。定制标题栏如有明确需求，须在后续阶段重新决策并双平台验证。

## D004：Electron 44.3.0 与 macOS 13 基线

- 日期：2026-09-13
- 状态：已接受

截至核验日，Electron 官方稳定版本页列出 44.3.0；Electron 44 官方说明 macOS 13 Ventura 或更高版本为最低运行要求。因此 P01 锁定 `electron@44.3.0`，与既定 macOS 13 基线一致。electron-vite 锁定 5.0.0，Node 锁定 22.19.0，满足其 Node 22.12+ 要求。升级 Electron 时必须重新核对三个目标架构、最低系统与 safeStorage 行为。

来源：

- https://releases.electronjs.org/release/v44.3.0
- https://www.electronjs.org/blog/electron-44-0
- https://electron-vite.org/guide/

## D005：P01 不实现后台播放承诺

- 日期：2026-09-13
- 状态：已接受

当前 Windows 关闭最后窗口即退出；macOS 遵循常见应用生命周期，关闭窗口后保留进程并可从 Dock 重建窗口。托盘/隐藏继续播放、播放宿主保活与真正退出的完整状态机属于 P09。P01 界面明确 AudioEngine 仍是占位。

## D006：原始解压资料保持只读参考

- 日期：2026-09-13
- 状态：已接受

`Sonavi_UI_v0.1/` 和 `navidrome-vibe-coding-kit/` 保留原貌。它们包含历史单平台优先描述，不再是执行规范；根 `AGENTS.md` 与根 `docs/` 是当前唯一执行文档。这一选择既保存原始依据，也避免改写历史参考包。

## D007：公共 Subsonic token 认证与 main 网络边界

- 日期：2026-09-13
- 状态：已接受

P02 首选 Subsonic 1.13+ 的 token/salt 认证：每次请求生成至少 6 字符的随机 salt，并计算 UTF-8 `md5(password + salt)`。密码不作为 `p` 参数发送；连接 URL 不跟随重定向，避免认证参数被带到未确认目标。renderer 只能调用固定的连接测试 IPC，不能发起任意 URL 请求。响应同时检查 HTTP 层、内容类型、1 MiB 大小上限、JSON 结构与 `subsonic-response.status`。

来源：

- https://opensubsonic.netlify.app/docs/api-reference/
- https://opensubsonic.netlify.app/docs/endpoints/ping/
- https://opensubsonic.netlify.app/docs/endpoints/getopensubsonicextensions/
- https://opensubsonic.netlify.app/docs/endpoints/getmusicfolders/

## D008：safeStorage 不可用时仅会话使用

- 日期：2026-09-13
- 状态：已接受

CredentialStore 使用当前锁定 Electron 44.3.0 类型中存在的异步 `isAsyncEncryptionAvailable`、`encryptStringAsync` 与 `decryptStringAsync`。只有系统加密成功后才写入 userData；不可用、加密失败或文件写入失败均返回 `session-only`，绝不落盘明文。恢复时遵循 `shouldReEncrypt` 完成密钥轮换；显式“退出并忘记账号”才删除本机密文。safeStorage 密文与当前系统用户/密钥链绑定，不设计跨机器复制。未签名 macOS 开发包的加密往返只作为本机开发证据，不能替代签名后升级稳定性验证。

来源：https://www.electronjs.org/docs/latest/api/safe-storage

## D009：保留 shadcn-vue + Tailwind CSS 技术路线

- 日期：2026-09-13
- 状态：已接受

原始 `navidrome-vibe-coding-kit/PROMPTS.md` 已明确指定 `shadcn-vue + Tailwind CSS`。P03 核对当前官方文档后锁定 Tailwind CSS 4.3.3 与 `@tailwindcss/vite` 4.3.3，建立 `components.json`、`@` alias、`cn()` 和项目持有的 Button 组件源码。Sonavi UI 包与 `tokens.css` 仍是视觉事实来源，Tailwind theme 映射既有 tokens；不为采用组件工具而重写已完成的连接页。

来源：

- https://www.shadcn-vue.com/docs/installation/vite
- https://www.shadcn-vue.com/docs/components-json
- https://tailwindcss.com/docs/installation/using-vite

## D010：P03 使用不透明媒体 scheme 与流式响应

- 日期：2026-09-13
- 状态：已接受

renderer 不获得上游地址、用户名、salt 或 token，只获得绑定当前 main 会话的随机媒体句柄。`sonavi-media` scheme 在 ready 前注册，并由 default Session 的 `protocol.handle` 处理。main 使用 Electron Session、`redirect: manual` 和 `format=raw` 请求封面/音频，只转发安全响应头及 200/206/416，以保留背压的流返回；不缓冲整首歌曲，不跨 IPC 传 Base64，不通过 `bypassCSP` 放宽安全策略。新连接会轮换会话 ID；退出、忘记账号和真正退出会撤销旧媒体句柄并中止活动请求。

来源：https://www.electronjs.org/docs/latest/api/protocol

## D011：P04 以 queueEntryId 和 generation 隔离播放状态

- 日期：2026-09-14
- 状态：已接受

AudioEngine 使用单一枚举状态而非跨组件布尔组合，并以 generationId 隔离每次媒体来源。切歌会释放旧 HTMLAudioElement 的事件监听；play/pause 命令另有递增序号，迟到的旧 Promise 不能把当前曲目或加载中暂停改为错误。全局仍只有一个引擎和一个活动音频宿主，页面组件不创建 Audio。

队列唯一性以随机 `queueEntryId` 为准，服务端 `trackId` 只标识歌曲，所以重复歌曲可独立删除和重排。队列项携带当前 server/account/session 范围，不跨失效会话恢复媒体句柄。随机顺序在当前队列生命周期内稳定，上一首沿实际播放历史返回。自然 ended 遵循单曲循环；手动下一首忽略单曲循环。队列持久化与后台播放仍留在 P09。

## D012：P05 使用公共只读端点和可取消搜索

- 日期：2026-09-14
- 状态：已接受

首页使用 `getAlbumList2(type=newest)`，全部专辑使用可分页的 `getAlbumList2(type=alphabeticalByName)`；艺术家与详情使用 `getArtists` / `getArtist`，搜索使用 `search3`。这些端点同时属于 Subsonic/OpenSubsonic 公共协议，不依赖 Navidrome 私有 Web API。`getArtists` 的完整响应在 renderer 采用窗口化渲染，真实超大资料库仍需验证响应大小边界。

搜索在 renderer 防抖并由 TanStack Query 发出取消信号；renderer 只能通过随机 requestId 和固定 preload 方法取消 main 内对应请求。sessionId、requestId、查询长度和分页均由 main 校验，会话轮换时统一中止旧请求。P05 不实现收藏或歌单写操作。

来源：

- https://opensubsonic.netlify.app/docs/endpoints/getalbumlist2/
- https://opensubsonic.netlify.app/docs/endpoints/getartists/
- https://opensubsonic.netlify.app/docs/endpoints/getartist/
- https://opensubsonic.netlify.app/docs/endpoints/search3/

## D013：P06 写入后重新读取服务器事实

- 日期：2026-09-14
- 状态：已接受

收藏使用公共 `getStarred2` / `star` / `unstar`，歌单使用 `getPlaylists` / `getPlaylist` / `createPlaylist` / `updatePlaylist` / `deletePlaylist`，不调用 Navidrome 私有 Web API。renderer 只通过固定、类型化 preload 方法提交当前会话及受限业务参数；main 校验发送者、会话和参数后才用其持有的凭据调用协议端点。

部分旧协议服务器的写端点（尤其 `createPlaylist`）成功时可以不返回实体，因此客户端不依赖 mutation 响应构造本地对象，也不乐观伪造成功。写入成功后仅失效当前会话相关查询并重新读取服务器事实；权限、会话或服务器失败保留已有数据。歌单添加参数保留顺序和重复歌曲，删除按协议的零基 `songIndexToRemove` 精确定位重复项。

来源：

- https://opensubsonic.netlify.app/docs/endpoints/getstarred2/
- https://opensubsonic.netlify.app/docs/endpoints/star/
- https://opensubsonic.netlify.app/docs/endpoints/unstar/
- https://opensubsonic.netlify.app/docs/endpoints/getplaylists/
- https://opensubsonic.netlify.app/docs/endpoints/getplaylist/
- https://opensubsonic.netlify.app/docs/endpoints/createplaylist/
- https://opensubsonic.netlify.app/docs/endpoints/updateplaylist/
- https://opensubsonic.netlify.app/docs/endpoints/deleteplaylist/
