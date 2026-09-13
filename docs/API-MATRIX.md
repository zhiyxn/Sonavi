# Subsonic / OpenSubsonic API 矩阵

更新日期：2026-09-13
当前阶段：P01（没有网络实现）

| 功能 | 公共端点/能力 | 计划阶段 | 当前状态 |
| --- | --- | --- | --- |
| 测试连接 | `ping` | P02 | 未实现 |
| 能力探测 | `getOpenSubsonicExtensions` | P02 | 未实现 |
| 音乐文件夹 | `getMusicFolders` | P02 | 未实现 |
| 专辑与详情 | `getAlbumList2` / `getAlbum` | P03 | 未实现 |
| 封面与播放 | `getCoverArt` / `stream` | P03 | 未实现 |
| 艺术家与搜索 | `getArtists` / `getArtist` / `search3` | P05 | 未实现 |
| 收藏 | `getStarred2` / `star` / `unstar` | P06 | 未实现 |
| 歌单 | `getPlaylists` / `getPlaylist` / 写入端点 | P06 | 未实现 |
| 歌词 | `getLyricsBySongId`，必要时 `getLyrics` | P07 | 未实现 |
| 播放上报 | `scrobble` | P07 | 未实现 |

P01 连接表单不发送请求，不输出假成功结果。P02 实现前必须查阅并记录当前 OpenSubsonic/Navidrome 官方文档、认证参数、HTTP/协议双层状态、错误类型与能力降级；服务端 ID 始终按 string 处理。
