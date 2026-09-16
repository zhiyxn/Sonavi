# Subsonic / OpenSubsonic API 矩阵

更新日期：2026-09-14
当前阶段：P09（桌面集成与性能；不新增服务端 API）

| 功能 | 公共端点/能力 | 计划阶段 | 当前状态 |
| --- | --- | --- | --- |
| 测试连接 | `ping` | P02 | 已实现；受控 fixture、Electron IPC 与用户实际服务已验证 |
| 能力探测 | `getOpenSubsonicExtensions` | P02 | 已实现；旧服务器缺失端点时降级为 unavailable |
| 音乐文件夹 | `getMusicFolders` | P02 | 已实现；ID 统一转换为 string |
| 专辑与详情 | `getAlbumList2` / `getAlbum` | P03 | 已实现 `offset/size` 分页与详情；31 张两页 fixture 通过，实际服务分页待复验 |
| 封面与播放 | `getCoverArt` / `stream` | P03/P08 | 已实现不透明句柄、流式响应、Range、原始/MP3 兼容转码与码率设置；用户实际服务只验证过基础播放 |
| 艺术家索引 | `getArtists` | P05/P11 | 已实现；完整索引使用独立 16 MiB 有界响应上限，renderer 窗口化；真实大库待复验 |
| 艺术家详情 | `getArtist` | P05 | 已实现；返回真实专辑 |
| 音乐库搜索 | `search3` | P05 | 已实现；艺术家/专辑/歌曲分页与取消 |
| 收藏 | `getStarred2` / `star` / `unstar` | P06 | 已实现；受控 fixture 验证服务器事实刷新，真实服务待验证 |
| 歌单 | `getPlaylists` / `getPlaylist` / `createPlaylist` / `updatePlaylist` / `deletePlaylist` | P06 | 已实现；受控 fixture 验证 CRUD、重复歌曲与索引删除，真实服务待验证 |
| 歌词 | `getLyricsBySongId`，无 `songLyrics` 扩展时使用 `getLyrics` | P07 | 已实现；结构化/旧版解析与受控 fixture 通过，真实服务待验证 |
| 播放上报 | `scrobble` | P07 | 已实现；now-playing、阈值 submission、seek 过滤与队列项去重通过，真实服务待验证 |
| 转码跳转 | `stream(timeOffset)` + `transcodeOffset` 扩展 | P08 | 已实现；只有能力已声明时启用，受控 fixture 验证完整时间线，真实服务待验证 |

连接与媒体请求使用每次请求独立 salt 的 token 认证，不发送明文密码参数。JSON 客户端默认保留 1 MiB 安全上限，只有 `getArtists` 使用 16 MiB 上限；媒体响应不走 JSON 缓冲，而由 `sonavi-media` 直接流式传递。不透明媒体 token 由 main 认证加密并以会话 epoch 撤销，不因大库加载淘汰队列音频。P08 原始模式发送 `format=raw`；兼容模式发送 `format=mp3`、受限 `maxBitRate` 和 `estimateContentLength=true`。自动模式只对已知 Chromium 媒体类型优先原始流，并预生成一个兼容回退句柄；解码错误最多回退一次，未知类型直接选择兼容转码。

P05～P08 端点均由 main 固定调用，输入与响应经 Zod 校验，不提供任意 URL 能力。P08 renderer 不能直接指定 `format`、`maxBitRate`、`timeOffset` 或上游地址；转码 seek 请求只含当前 session、track 与受限秒数，main 再检查已保存的 `transcodeOffset` 能力并生成不透明句柄。受控 fixture 实际返回扩展名 `songLyrics` 与 `transcodeOffset`，只证明测试服务行为；用户真实服务器的扩展列表、转码器和代理组合尚未记录为通过。

来源：

- https://opensubsonic.netlify.app/docs/endpoints/stream/
- https://opensubsonic.netlify.app/docs/extensions/
