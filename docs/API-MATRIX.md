# Subsonic / OpenSubsonic API 矩阵

更新日期：2026-09-13
当前阶段：P02（连接与认证基础增量）

| 功能 | 公共端点/能力 | 计划阶段 | 当前状态 |
| --- | --- | --- | --- |
| 测试连接 | `ping` | P02 | 已实现；受控 fixture 与 Electron IPC 已验证，真实服务器待验证 |
| 能力探测 | `getOpenSubsonicExtensions` | P02 | 已实现；旧服务器缺失端点时降级为 unavailable |
| 音乐文件夹 | `getMusicFolders` | P02 | 已实现；ID 统一转换为 string |
| 专辑与详情 | `getAlbumList2` / `getAlbum` | P03 | 未实现 |
| 封面与播放 | `getCoverArt` / `stream` | P03 | 未实现 |
| 艺术家与搜索 | `getArtists` / `getArtist` / `search3` | P05 | 未实现 |
| 收藏 | `getStarred2` / `star` / `unstar` | P06 | 未实现 |
| 歌单 | `getPlaylists` / `getPlaylist` / 写入端点 | P06 | 未实现 |
| 歌词 | `getLyricsBySongId`，必要时 `getLyrics` | P07 | 未实现 |
| 播放上报 | `scrobble` | P07 | 未实现 |

P02 当前使用每次请求独立 salt 的 token 认证，不发送明文密码参数。客户端区分 DNS、拒绝连接、超时、TLS、重定向、HTTP 认证/权限、Cloudflare challenge、HTML、非法 JSON、超大响应、协议认证、协议版本和操作权限错误。自动测试不访问真实服务；真实 Navidrome/OpenSubsonic 与反向代理组合仍待验证。
