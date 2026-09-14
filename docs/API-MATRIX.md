# Subsonic / OpenSubsonic API 矩阵

更新日期：2026-09-14
当前阶段：P07（歌词与播放上报；公共 API）

| 功能 | 公共端点/能力 | 计划阶段 | 当前状态 |
| --- | --- | --- | --- |
| 测试连接 | `ping` | P02 | 已实现；受控 fixture、Electron IPC 与用户实际服务已验证 |
| 能力探测 | `getOpenSubsonicExtensions` | P02 | 已实现；旧服务器缺失端点时降级为 unavailable |
| 音乐文件夹 | `getMusicFolders` | P02 | 已实现；ID 统一转换为 string |
| 专辑与详情 | `getAlbumList2` / `getAlbum` | P03 | 已实现 `offset/size` 分页与详情；31 张两页 fixture 通过，实际服务分页待复验 |
| 封面与播放 | `getCoverArt` / `stream` | P03 | 已实现不透明句柄、流式响应和 Range；用户实际服务基础播放成功，格式差异/物理听音待验证 |
| 艺术家索引 | `getArtists` | P05 | 已实现；完整索引 + renderer 窗口化 |
| 艺术家详情 | `getArtist` | P05 | 已实现；返回真实专辑 |
| 音乐库搜索 | `search3` | P05 | 已实现；艺术家/专辑/歌曲分页与取消 |
| 收藏 | `getStarred2` / `star` / `unstar` | P06 | 已实现；受控 fixture 验证服务器事实刷新，真实服务待验证 |
| 歌单 | `getPlaylists` / `getPlaylist` / `createPlaylist` / `updatePlaylist` / `deletePlaylist` | P06 | 已实现；受控 fixture 验证 CRUD、重复歌曲与索引删除，真实服务待验证 |
| 歌词 | `getLyricsBySongId`，无 `songLyrics` 扩展时使用 `getLyrics` | P07 | 已实现；结构化/旧版解析与受控 fixture 通过，真实服务待验证 |
| 播放上报 | `scrobble` | P07 | 已实现；now-playing、阈值 submission、seek 过滤与队列项去重通过，真实服务待验证 |

连接与媒体请求使用每次请求独立 salt 的 token 认证，不发送明文密码参数。JSON 客户端保留 1 MiB 安全上限；媒体响应不走 JSON 缓冲，而由 `sonavi-media` 直接流式传递。P03 已覆盖分页、200/206/416、单段 Range、重定向拒绝和非媒体响应拒绝。自动测试不访问用户服务；实际服务基础链路由用户验证，分页修复、转码差异与反向代理组合仍待继续验证。

P05～P07 端点均由 main 固定调用，输入与响应经 Zod 校验，不提供任意 URL 能力。P06 写操作只接受当前会话、枚举目标类型、受限 ID/名称/布尔值、歌曲 ID 数组或非负歌曲索引；P07 只接受当前会话、曲目 ID/纯文本元数据、上报类型和毫秒时间，renderer 不接触认证参数。`createPlaylist` 兼容旧协议成功时不返回 playlist；所有写入成功后由固定读取端点重新取得服务器事实。
