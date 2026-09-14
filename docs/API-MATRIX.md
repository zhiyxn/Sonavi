# Subsonic / OpenSubsonic API 矩阵

更新日期：2026-09-14
当前阶段：P05（正式音乐库与搜索；只读公共 API）

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
| 收藏 | `getStarred2` / `star` / `unstar` | P06 | 未实现 |
| 歌单 | `getPlaylists` / `getPlaylist` / 写入端点 | P06 | 未实现 |
| 歌词 | `getLyricsBySongId`，必要时 `getLyrics` | P07 | 未实现 |
| 播放上报 | `scrobble` | P07 | 未实现 |

连接与媒体请求使用每次请求独立 salt 的 token 认证，不发送明文密码参数。JSON 客户端保留 1 MiB 安全上限；媒体响应不走 JSON 缓冲，而由 `sonavi-media` 直接流式传递。P03 已覆盖分页、200/206/416、单段 Range、重定向拒绝和非媒体响应拒绝。自动测试不访问用户服务；实际服务基础链路由用户验证，分页修复、转码差异与反向代理组合仍待继续验证。

P05 新端点仍由 main 固定调用，输入与响应经 Zod 校验，不新增任意 URL 或服务端写入能力。搜索通过受限 requestId 取消；返回歌曲仍只包含当前会话绑定的不透明媒体句柄。收藏和歌单写操作保持未实现。
