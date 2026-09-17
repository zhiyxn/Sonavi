# P11 RC 测试矩阵

日期：2026-09-16

状态定义：

- **通过**：本轮已执行且结果通过。
- **部分通过**：只有自动化、fixture、静态审查或历史证据，仍缺真实目标环境。
- **失败/问题**：已有可定位缺陷或用户真实体验报告。
- **未验证**：本轮没有对应证据。

## UI

| 项目 | 状态 | 本轮证据/下一步 |
| --- | --- | --- |
| 可见按钮有真实动作 | 通过 | 未连接侧栏已改为当前状态文本；抽查按钮均有处理器 |
| 生产环境无假数据 | 通过 | `src/` 未发现 Mock/fixture 数据；fixture 只在 tests |
| 加载/空/错误状态 | 通过（自动化） | 专辑详情已补错误原因与原地重试；真实错误文案仍随服务端差异复验 |
| Windows/macOS 字体截断 | 部分通过 | 有跨平台字体栈和主要文本 ellipsis；需两平台人工长文本检查 |
| 960×640 | 通过 | 源码和打包 E2E 检查无横向溢出，截图已目视 |
| 1440×900 | 未验证 | 本轮没有精确尺寸截图 |

## Navidrome/OpenSubsonic

| 项目 | fixture/自动化 | 真实服务器 | 备注 |
| --- | --- | --- | --- |
| 登录 | 通过 | 部分通过 | 用户已能连接真实服务；版本/反代矩阵未做 |
| 子路径 | 通过 | 未验证 | fixture 使用 `/sonavi-fixture` |
| 搜索 | 通过 | 未验证 | 防抖、取消和分页有覆盖 |
| 专辑 | 通过 | 部分通过 | 用户可播放；详情错误 UI 有缺口 |
| 艺术家 | 通过 | 修复待复验 | `getArtists` 使用独立 16 MiB 有界上限；发生过问题的真实大库待复验 |
| 收藏 | 通过 | 未验证 | 权限和版本差异待验 |
| 歌单 | 通过 | 未验证 | CRUD、重复歌曲索引在 fixture 通过 |
| 歌词 | 通过 | 未验证 | 结构化/旧端点单元覆盖，真实歌词差异待验 |
| scrobble | 通过 | 修复待复验 | ended 也会触发去重 submission；真实服务计数仍待确认 |
| 能力降级 | 通过 | 未验证 | 旧扩展端点单元覆盖；真实旧服务器待验 |

## 播放

| 项目 | 状态 | 证据/限制 |
| --- | --- | --- |
| MP3 | 未验证 | 无真实 MP3 样本；转码请求名为 MP3，但 fixture 返回 WAV |
| AAC/M4A | 未验证 | 无实际容器/codec 样本 |
| FLAC | 未验证 | 无实际样本 |
| Opus/Ogg | 未验证 | 无实际样本 |
| WAV | 部分通过 | 合成 8 kHz 单声道 PCM WAV 通过；其他 WAV 编码未验 |
| Range | 通过 | 单段 Range、200/206/416 和非法范围有单元/E2E |
| 原始 seek | 通过 | 合成 WAV + HTMLAudioElement |
| 转码 seek | 部分通过 | `transcodeOffset` 参数与完整时间线通过；真实转码输出未验 |
| 快速切歌 | 通过 | 旧事件/Promise 隔离；E2E 20 轮切页媒体请求 +0 |
| 暂停 | 通过 | UI、引擎、暂停 seek 通过 |
| 上一首/下一首 | 通过 | 顺序与历史路径通过 |
| 随机 | 通过 | 稳定随机顺序与历史返回单元测试 |
| 单曲循环 | 通过 | 自然结束循环，手动下一首仍切换 |
| 列表循环 | 通过 | 尾项自然结束回首项 |
| 重复歌曲队列项 | 通过 | queueEntryId 隔离，歌单重复索引移除 |
| 网络中断恢复 | 部分通过 | error 后可按当前进度手动重试；自动在线恢复/退避与真实断网仍未验证 |

## 生命周期

| 项目 | 状态 | 证据/限制 |
| --- | --- | --- |
| 路由切换不断歌 | 通过 | E2E 切换页面且媒体请求不增加 |
| 最小化不断歌 | 未验证 | 需真实窗口操作 |
| 隐藏窗口不断歌 | 通过 | E2E 关闭隐藏并恢复同一 webContents/AudioEngine |
| 关闭窗口策略 | 部分通过 | 自动化通过；托盘/Dock 人工入口待验 |
| 真正退出 | 部分通过 | flush/确认/超时逻辑有测试；正常退出残留进程待验 |
| 重启队列恢复 | 通过 | 暂停队列以新媒体句柄恢复 |
| 睡眠/唤醒 | 未验证 | 代码路径已审查；未触发真实系统事件 |

## Windows/macOS

| 项目 | Windows 本轮 | macOS 本轮 |
| --- | --- | --- |
| Ctrl/Cmd 快捷键 | Ctrl 通过 | 未验证；仅有历史 CI |
| 托盘/菜单栏 | 部分通过 | 未验证 |
| Dock | 不适用 | 未验证 |
| 窗口关闭 | 自动化通过 | 未验证；仅有历史 CI |
| 安装/解压运行 | win-unpacked 通过；NSIS 安装未验证 | Intel/arm64 均未验证 |
| Intel x64 | 不适用 | 未验证 |
| Apple Silicon arm64 | 不适用 | 未验证 |
| 系统媒体控制 | handler/元数据通过；物理键未验证 | 未验证 |

## 安全

| 项目 | 状态 | 证据/限制 |
| --- | --- | --- |
| renderer 无 Node 权限 | 通过 | 安全偏好与 `window.process === undefined` 冒烟 |
| IPC 参数与发送者校验 | 通过 | main frame/URL + Zod + 会话校验 |
| 凭据不进入日志 | 通过 | 静态审查、脱敏诊断测试 |
| URL 不泄漏认证参数 | 通过 | renderer 仅见不透明句柄；诊断不记 URL |
| 媒体句柄退出后失效 | 通过 | 断开/忘记/退出撤销与 E2E |
| 缓存不跨账号 | 通过 | 账号哈希隔离与单元测试 |
| CSP | 通过 | 生产构建为 `connect-src 'self'`，不含开发 HMR 的 `ws://localhost:*` |
| 导航限制 | 通过 | 新窗口拒绝、非受信导航阻止 |
| 重定向认证泄漏 | 通过 | API/媒体 `redirect: manual`、`no-referrer` |

## 资源与性能

| 项目 | 状态 | 证据/限制 |
| --- | --- | --- |
| 连续切歌监听器 | 通过（单元） | 每次 dispose 移除事件；长时压力未验 |
| AudioElement 泄漏 | 部分通过 | 旧元素 pause、移除 src、load；短采样通过，长时未验 |
| 媒体句柄生命周期 | 通过（自动化） | 加密无状态 token + 会话 epoch；10,000 个后续封面句柄不淘汰队列音频，断开后旧句柄失效 |
| 封面缓存上限 | 通过 | 5 MiB/项、128 MiB/账号、LRU 测试 |
| 大音乐库滚动 | 部分通过 | 10,000 条合成窗口化通过；真实 API/图片/句柄链路未验 |
| 长时间播放 CPU/内存 | 未验证 | 本轮只有 20 轮短采样，无阈值 |
| 退出后残留进程 | 未验证 | 测试进程能关闭，不等于用户正常退出后的系统检查 |

## 当前工作区平台结论

- Windows：修复后的源码与未签名 x64 打包应用自动化可进入人工真机矩阵；NSIS 安装、真实服务器复验、真实格式、托盘/媒体键/睡眠/长时性能仍未验证。
- macOS：当前工作区没有本轮构建或运行证据；Intel x64 与 arm64 均须在对应机器重新构建并执行同一矩阵。

---

# P12 Windows + macOS 真机回归测试矩阵

日期：2026-09-16

基线：`main` / `fe5b07a`（`0.1.0-rc.4` 源码之后的诊断修正；不是新的发布标签）。上方 P11 自动化与 CI 只作为历史背景，不计入 P12 真机结果。

## P12 状态定义

- `PASS`：本轮已在指定真实平台、真实 Sonavi 应用和要求的真实环境中执行，观察结果符合预期。
- `FAIL`：本轮已执行并稳定观察到结果不符合预期；必须在 `docs/KNOWN-ISSUES.md` 记录复现步骤、脱敏日志、影响范围和平台。
- `BLOCKED`：本轮因明确的外部前置条件无法执行，例如缺少对应实机、需要用户手动输入凭据、需要用户断网/锁屏/睡眠，或真实服务器没有所需样本。阻断原因必须写明。
- `NOT TESTED`：属于 P12 范围，但尚未开始或尚未取得足够证据。

禁止使用“应该可以”“代码看起来支持”或 fixture/CI 结果代替以上真机状态。真实账号和密码只允许用户在 Sonavi UI 中输入，不写入日志、fixture、截图说明或文档。

## P12 当前环境

- Windows：Windows NT 10.0.26200 x64（Windows 11 25H2 内核版本）；当前本地桌面可用于 Windows 真机测试。
- macOS Intel x64：`BLOCKED`——当前没有可控制的 macOS Intel 实机。
- macOS Apple Silicon arm64：`BLOCKED`——当前没有可控制的 Apple Silicon 实机。
- 真实 Navidrome：等待用户在 Sonavi UI 内输入凭据；文档不记录地址、账号或密码。
- 安装包：P12 将区分源码应用与未签名 Windows 测试包；未经用户授权不发布、上传或修改 Release。

## A. 登录

| ID | 用例 | Windows 11 | macOS x64 | macOS arm64 | 证据/阻断原因 |
| --- | --- | --- | --- | --- | --- |
| A-01 | 正确账号登录 | PASS | BLOCKED | BLOCKED | Windows 未签名包启动后，已保存的正确凭据成功认证真实服务器；用户人工确认 |
| A-02 | 错误密码 | BLOCKED | BLOCKED | BLOCKED | 密码只由用户在 UI 输入 |
| A-03 | 服务端不可达 | NOT TESTED | BLOCKED | BLOCKED | 需在 UI 使用不包含真实凭据的不可达地址 |
| A-04 | HTTP 403 | BLOCKED | BLOCKED | BLOCKED | 需真实 403 入口或用户可控反向代理规则 |
| A-05 | 子路径 | BLOCKED | BLOCKED | BLOCKED | 需真实服务子路径地址 |
| A-06 | 重启后凭据恢复 | PASS | BLOCKED | BLOCKED | Windows 未签名包跨进程启动后自动恢复凭据并成功连接；用户人工确认；文档未记录凭据 |
| A-07 | 退出登录再登录 | BLOCKED | BLOCKED | BLOCKED | 退出后仍由用户重新输入凭据 |

## B. 音乐库

| ID | 用例 | Windows 11 | macOS x64 | macOS arm64 | 证据/阻断原因 |
| --- | --- | --- | --- | --- | --- |
| B-01 | 首页真实数据 | BLOCKED | BLOCKED | BLOCKED | 需 A-01；源码已改为 shadcn-vue Pagination 显式翻页并独立保留首页页码，当前运行包不含该改动 |
| B-02 | 专辑列表与详情 | BLOCKED | BLOCKED | BLOCKED | 需 A-01；源码已改为每页 30 张、页码/上一页/下一页控制，当前运行包不含该改动 |
| B-03 | 艺术家列表与详情 | FAIL | BLOCKED | BLOCKED | Windows 真实服务器的完整 getArtists 响应较慢，且原 30 秒缓存可能重复请求；已改为当前连接会话内复用成功结果。艺术家列表双滚动条也已在源码中改为仅列表内部滚动；当前运行包不含该布局修复，首次全量请求和滚动仍需真机复验 |
| B-04 | 搜索 | BLOCKED | BLOCKED | BLOCKED | 需 A-01；源码已改为 Enter 或搜索按钮显式提交，当前运行包不含该改动，等待下一统一包复验 |
| B-05 | 收藏读取与写入 | BLOCKED | BLOCKED | BLOCKED | 会修改真实服务收藏状态，执行前记录并恢复原状态 |
| B-06 | 歌单 CRUD 与播放 | BLOCKED | BLOCKED | BLOCKED | 只创建明确标注为 P12 的临时歌单；删除前使用 shadcn-vue AlertDialog 确认/取消，当前运行包不含该改动 |
| B-07 | 中文元数据 | BLOCKED | BLOCKED | BLOCKED | 需真实样本 |
| B-08 | 英文元数据 | BLOCKED | BLOCKED | BLOCKED | 需真实样本 |
| B-09 | 长标题布局 | BLOCKED | BLOCKED | BLOCKED | 需真实样本 |
| B-10 | 无封面回退 | BLOCKED | BLOCKED | BLOCKED | 需真实样本 |
| B-11 | 专辑详情仅滚动歌曲列表 | FAIL | BLOCKED | BLOCKED | Windows 专辑详情原为整个 workspace 滚动；已固定详情页外层并将滚动限制到可聚焦的歌曲列表，等待下一统一包真机复验 |

## C. 播放

| ID | 用例 | Windows 11 | macOS x64 | macOS arm64 | 证据/阻断原因 |
| --- | --- | --- | --- | --- | --- |
| C-01 | 直接播放 | BLOCKED | BLOCKED | BLOCKED | 需真实曲目与物理听音 |
| C-02 | 暂停/继续 | BLOCKED | BLOCKED | BLOCKED | 需 C-01 |
| C-03 | seek | BLOCKED | BLOCKED | BLOCKED | 需可 seek 的真实曲目 |
| C-04 | 上一首 | BLOCKED | BLOCKED | BLOCKED | 需多曲队列 |
| C-05 | 下一首 | BLOCKED | BLOCKED | BLOCKED | 需多曲队列 |
| C-06 | 快速连续切歌 | BLOCKED | BLOCKED | BLOCKED | 需多曲队列 |
| C-07 | 播放结束自动下一首 | BLOCKED | BLOCKED | BLOCKED | 需短曲或等待自然结束 |
| C-08 | 单曲循环 | BLOCKED | BLOCKED | BLOCKED | 需等待自然结束 |
| C-09 | 列表循环 | BLOCKED | BLOCKED | BLOCKED | 需等待队列末尾自然结束 |
| C-10 | 随机播放 | BLOCKED | BLOCKED | BLOCKED | 需至少三首曲目 |
| C-11 | 队列重排 | BLOCKED | BLOCKED | BLOCKED | 需多曲队列 |
| C-12 | 同一歌曲加入两次 | BLOCKED | BLOCKED | BLOCKED | 需队列操作 |
| C-13 | 删除当前歌曲 | BLOCKED | BLOCKED | BLOCKED | 需多曲队列 |
| C-14 | 打开队列定位当前歌曲 | FAIL | BLOCKED | BLOCKED | 原包每次打开队列都显示第一项；小范围修复和新 Windows 包已完成，等待真机复验后才能改为 PASS |
| C-15 | 队列当前歌曲样式可读性 | FAIL | BLOCKED | BLOCKED | Windows 浅色与深色截图均确认当前歌曲标题对比不足；标题已改用主题正文色，强调色仅保留为左侧标记，等待本批问题统一完成后真机复验 |
| C-16 | 主播放/暂停图标可读性 | FAIL | BLOCKED | BLOCKED | Windows 截图确认通用播放器按钮规则覆盖白色图标；已隔离主控制正常与悬停样式，等待本批问题统一完成后真机复验 |
| C-17 | 点击播放器其他区域关闭队列 | FAIL | BLOCKED | BLOCKED | Windows 当前队列打开后点击播放器其余区域仍保持展开；已补充播放器内点击关闭规则，等待本批问题统一完成后真机复验 |
| C-18 | 播放记录 scrobble 同步 | FAIL | BLOCKED | BLOCKED | Windows 真实服务器播放时出现“播放记录暂时未同步”；说明至少一次 now-playing 或 submission 请求失败，待读取脱敏 scrobble 诊断定位 |
| C-19 | 播放栏显示当前歌曲封面 | FAIL | BLOCKED | BLOCKED | Windows 当前播放栏只显示音乐符号；已复用当前歌曲受限封面 URL，无封面时保留占位符，等待本批问题统一完成后真机复验 |
| C-20 | 专辑详情返回恢复列表位置 | FAIL | BLOCKED | BLOCKED | Windows 从专辑详情返回后列表回到顶部；已保存进入详情前的 workspace 滚动位置并在返回后恢复，等待下一统一包真机复验 |

## D. 网络

| ID | 用例 | Windows 11 | macOS x64 | macOS arm64 | 证据/阻断原因 |
| --- | --- | --- | --- | --- | --- |
| D-01 | 播放中断网 | BLOCKED | BLOCKED | BLOCKED | 需用户在播放中手动断开网络，避免自动化修改系统网络设置 |
| D-02 | 恢复网络 | BLOCKED | BLOCKED | BLOCKED | 依赖 D-01，由用户手动恢复网络 |
| D-03 | 慢网络 | BLOCKED | BLOCKED | BLOCKED | 当前无受控、不会泄露凭据的限速环境 |
| D-04 | 请求取消 | BLOCKED | BLOCKED | BLOCKED | 需 A-01；可通过真实搜索快速变更/页面切换观察脱敏诊断 |
| D-05 | 服务端返回异常 | BLOCKED | BLOCKED | BLOCKED | 需真实服务器或反向代理提供受控异常响应 |
| D-06 | 原始音频 | BLOCKED | BLOCKED | BLOCKED | 需真实样本并在诊断确认实际模式 |
| D-07 | 服务端转码 | BLOCKED | BLOCKED | BLOCKED | 需服务器允许转码并在诊断确认实际模式 |

## E. 歌词

| ID | 用例 | Windows 11 | macOS x64 | macOS arm64 | 证据/阻断原因 |
| --- | --- | --- | --- | --- | --- |
| E-01 | 同步歌词 | BLOCKED | BLOCKED | BLOCKED | 需真实同步歌词样本 |
| E-02 | 普通歌词 | BLOCKED | BLOCKED | BLOCKED | 需真实普通歌词样本 |
| E-03 | 无歌词 | BLOCKED | BLOCKED | BLOCKED | 需真实无歌词样本 |
| E-04 | 损坏歌词 | BLOCKED | BLOCKED | BLOCKED | 需真实服务器提供损坏歌词样本，不能修改真实服务数据制造 |
| E-05 | seek 后歌词同步 | BLOCKED | BLOCKED | BLOCKED | 依赖 E-01 与 C-03 |

## F. 生命周期

| ID | 用例 | Windows 11 | macOS x64 | macOS arm64 | 证据/阻断原因 |
| --- | --- | --- | --- | --- | --- |
| F-01 | 页面切换不中断播放 | BLOCKED | BLOCKED | BLOCKED | 需 C-01 |
| F-02 | 最小化 | BLOCKED | BLOCKED | BLOCKED | 需 C-01 |
| F-03 | 隐藏窗口 | BLOCKED | BLOCKED | BLOCKED | 需 C-01 |
| F-04 | 关闭窗口 | NOT TESTED | BLOCKED | BLOCKED | 可先验证未连接状态的窗口策略；播放中仍依赖 C-01 |
| F-05 | 重新打开同一宿主 | NOT TESTED | BLOCKED | BLOCKED | 可先验证未连接状态；播放中依赖 F-03/F-04 |
| F-06 | 应用退出 | NOT TESTED | BLOCKED | BLOCKED | 可检查未连接退出与残留进程；播放停止依赖 C-01 |
| F-07 | 重启 | NOT TESTED | BLOCKED | BLOCKED | 凭据与暂停队列恢复依赖 A-01/C-01 |
| F-08 | 系统锁屏 | BLOCKED | BLOCKED | BLOCKED | 需用户手动锁屏并重新解锁；不自动操作认证界面 |
| F-09 | 睡眠/唤醒 | BLOCKED | BLOCKED | BLOCKED | 需用户手动执行并恢复会话 |
| F-10 | 页面切换恢复各自滚动位置 | FAIL | BLOCKED | BLOCKED | Windows 切到其他栏目再返回专辑等长页面后位置丢失；源码已让设置以外的页面与详情分别恢复位置，艺术家内部列表单独保持，设置每次回顶部；当前运行包不含修复，等待下一统一包真机复验 |
| F-11 | 艺术家详情进入专辑后保留导航上下文 | FAIL | BLOCKED | BLOCKED | Windows 搜索进入艺术家详情再打开专辑时错误激活“专辑”，返回也进入专辑列表；已保留艺术家上下文并返回原艺术家详情，等待下一统一包真机复验 |
| F-12 | 页面切换不自动重取并支持当前视图刷新 | FAIL | BLOCKED | BLOCKED | 源码已保留首页/专辑/艺术家/搜索/收藏/歌单实例和当前会话查询缓存；切换栏目不自动重取，刷新按钮只重取当前列表、分页或详情。当前运行包不含修复，等待真实服务器观察请求增量 |

## G. 平台

| ID | 用例 | Windows 11 | macOS x64 | macOS arm64 | 证据/阻断原因 |
| --- | --- | --- | --- | --- | --- |
| G-W01 | Ctrl 快捷键 | NOT TESTED | — | — | Ctrl+, 与播放器空格键 |
| G-W02 | 托盘 | NOT TESTED | — | — | 显示、播放/暂停、前后切歌、退出 |
| G-W03 | 任务栏 | NOT TESTED | — | — | 图标、最小化、恢复与窗口聚焦 |
| G-W04 | 物理媒体键 | BLOCKED | — | — | 需用户按物理媒体键或提供等价硬件输入 |
| G-W05 | 窗口状态恢复 | NOT TESTED | — | — | normal/maximized 与重新启动 |
| G-W06 | 未签名测试包 | BLOCKED | — | — | `fe5b07a` 本机构建/包验证通过并启动进程；等待人工确认窗口、图标和真实 UI，不绕过 SmartScreen |
| G-M01 | Cmd 快捷键 | — | BLOCKED | BLOCKED | 当前无 macOS 实机 |
| G-M02 | Dock | — | BLOCKED | BLOCKED | 当前无 macOS 实机 |
| G-M03 | 系统菜单 | — | BLOCKED | BLOCKED | 当前无 macOS 实机 |
| G-M04 | 媒体控制 | — | BLOCKED | BLOCKED | 当前无 macOS 实机 |
| G-M05 | 窗口隐藏/恢复 | — | BLOCKED | BLOCKED | 当前无 macOS 实机 |
| G-M06 | x64 原生运行 | — | BLOCKED | — | 当前无 Intel Mac |
| G-M07 | arm64 原生运行（可用时） | — | — | BLOCKED | 当前无 Apple Silicon Mac |
| G-C01 | 页面栏目标题无重复伪序号 | FAIL | BLOCKED | BLOCKED | Windows 确认多个页面重复显示 03/05/06 且无功能含义；已统一移除所有页面编号，等待本批问题统一完成后真机复验 |
| G-C02 | 可用按钮显示点击光标 | FAIL | BLOCKED | BLOCKED | Windows 可点击按钮未统一显示小手；已增加全局可用/禁用按钮光标规则，等待本批问题统一完成后真机复验 |

## P12 结果计算

- 通过率：`PASS / (PASS + FAIL)`；只计算实际执行完成的用例。
- 执行覆盖率：`(PASS + FAIL) / 全部适用用例`；`BLOCKED` 与 `NOT TESTED` 不冒充已执行。
- 平台分别计算，不用一个平台的结果替代另一个平台。
- 当前阶段：Windows 已执行 15 项，`PASS` 2、`FAIL` 13；阶段通过率 13.3%（2/15），执行覆盖率 21.7%（15/69）。macOS 两架构因缺少实机处于 `BLOCKED`。
