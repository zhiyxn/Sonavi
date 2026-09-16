# P11 已知问题

日期：2026-09-16

本文件记录修复复核后仍开放的问题。用户原始 Windows 体验记录保留在 `docs/Existing issues.md`；“代码已修复”不等于真实服务器或另一平台已经验证。

## Blocker（0）

暂无。

## Critical（0）

原 RC-C-001 已修复：媒体句柄改为每次会话密钥加密、带会话 epoch 的无状态不透明 token，不再由 2,000 项全局 FIFO 淘汰。单元测试确认先创建队列音频、再创建 10,000 个封面句柄后音频仍可解析；断开、忘记账号和退出仍会整体失效旧句柄。

## Major（4）

### RC-MA-001：真实大型艺术家索引仍待复验

- `getArtists` 已从统一 1 MiB 上限分离为有界 16 MiB 上限，其他 API 仍保持 1 MiB；用户报告后的后续播放失败也由无状态媒体句柄修复覆盖。
- fixture、单元测试和 Windows 打包冒烟通过，但尚未在发生过错误的真实 Navidrome 资料库复验，因此状态是“修复待真服验证”，不能宣称真实问题已关闭。

### RC-MA-002：真实服务器 scrobble 计数仍待复验

- 除累计播放阈值外，真实 `ended` 状态现在也会触发一次 submission；queueEntryId 去重仍防止重复上报。
- 自动化已观察 now-playing 与 submission，但真实服务器版本、响应和计数口径尚未取得，仍不能标为通过。

### RC-MA-003：网络中断只具备手动恢复

- 播放错误现在提供“重试播放”：原始流按当前进度重建，支持 `transcodeOffset` 的转码流按当前时间请求新句柄。
- 尚未实现在线事件自动恢复与退避策略；断网后是否能在不同服务器/代理环境恢复仍需真机验证。

### RC-MA-004：真实音频格式矩阵尚未建立

- 当前真实 `HTMLAudioElement` 自动化只解码合成 PCM WAV。
- MP3、AAC/M4A、FLAC、Opus/Ogg 和真实 Navidrome MP3 转码输出在 Windows、macOS Intel、macOS arm64 均需实际样本；不能由扩展名或 MIME 白名单推断通过。

## Minor（0）

已修复：未连接侧栏假按钮、播放器状态宽度漂移、Windows 宽滚动条、侧栏/播放器不跟随主题、专辑详情错误空白、生产 CSP 保留 HMR WebSocket、诊断把 12 秒内部超时报成 `cancelled`、同一媒体请求同时记录 `cancelled` 与 `broken-stream`、诊断缺少端点名与错误文本。

## 诊断与网络策略待决（2026-09-16）

- API 超时仍是固定 12 秒：`getArtists` 已放宽响应上限到 16 MiB，但超时没有同步放宽；真实服务器上仍出现 12 秒无响应记录，需要直连与代理对照后再决定是否按端点区分超时。
- renderer 用 TanStack Vue Query 默认 `retry: 3`，单个查询失败最多产生 4 次超时尝试；诊断条目没有尝试序号，无法区分“一个查询重试多次”与“多次用户操作”，要分组必须从 renderer 传递请求标识。
- 媒体消费者取消时只记录终态，没有主动 `abort()` 上游 fetch；被取消的下载会等上游自然结束。

## Enhancement（0）

已完成：账号忘记入口仅保留在设置、专辑和搜索滚动自动分页、设置使用项目自有 Reka/shadcn 风格 Select、托盘退出文案简化为“退出 Sonavi”。

## 本轮已验证的修复

- `lint`、`typecheck`、24 个文件/115 项 Vitest、生产构建和源码 Electron 冒烟通过。
- Windows x64 未签名 NSIS 构建、包验证和打包应用完整冒烟通过。
- 生产 renderer CSP 为 `connect-src 'self'`，不含 `ws://localhost:*`；开发环境仍保留 HMR 所需来源。
- Windows 包 SHA-256：`72a5be09328afe0cceff365e85414880acd19e06c32cbae1265abebe0c5b9aac`。

未验证项目以 `docs/TEST-MATRIX.md` 为准；本轮没有配置签名、公证、自动更新或发布 Release。
