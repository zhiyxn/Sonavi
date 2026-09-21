# Sonavi 0.1.0-rc.5 测试版

这是 `v0.1.0-rc.4` 之后的跨平台候选测试版，供 Windows 11 x64、macOS 13+ Intel x64 和 macOS 13+ Apple Silicon arm64 用户试用。

本版本继续以 GitHub **Pre-release** 形式提供，未标记为 Latest 或正式稳定版。

项目自本版本起采用 MIT License。

## 下载

- Windows x64：`Sonavi-0.1.0-rc.5-win-x64.exe`
- macOS Intel x64：`Sonavi-0.1.0-rc.5-mac-x64.dmg`
- macOS Apple Silicon arm64：`Sonavi-0.1.0-rc.5-mac-arm64.dmg`
- `SHA256SUMS.txt`：上述安装包和验证 manifest 的 SHA-256 校验值

## 相对 rc.4 的主要变化

- 修复并回归音乐库、搜索、收藏与艺术家详情的来源导航、逐级返回、滚动位置和查询缓存；收藏上下文中的专辑详情按钮明确为“返回艺术家专辑”。
- 首页、专辑和搜索结果使用明确分页；搜索结果按艺术家、专辑、歌曲纵向排列，专辑与歌曲分别维护页码和末页状态。
- 首页、全部专辑、艺术家详情、搜索与收藏中的专辑条目统一展示歌曲数量。
- 封面进入视口附近后再加载，缓存未命中的上游请求受全局六并发限制；schema v5 诊断分别记录排队与上游耗时。
- 搜索与收藏读取关闭隐式自动重试；已收到响应头后的正文超时使用更准确的错误分类与建议。
- 播放器展示源音频格式与兼容转码关系，并增强网络缓冲、流错误、播放策略切换、队列刷新和 scrobble 诊断。
- 设置页新增安全重启确认；Windows 托盘与 macOS 菜单栏新增“重启 Sonavi”，复用暂停队列持久化和单实例恢复流程。
- 修复 Windows 重复打开时创建多个播放窗口的问题；后续进程现在立即退出并唤醒既有窗口，保持同一个 renderer、播放队列与 AudioEngine。该行为由 Windows 源码 Electron 双启动冒烟验证，macOS 与重打后的安装包以本次发布流水线结果为准。
- 输入、选择、复选、滑块、确认、通知与分页统一为项目持有的 shadcn-vue 组件，并修正播放器布局、歌词滚动条和深浅主题可读性。

## 验证状态

- Windows 当前源码人工清单：37 PASS、0 FAIL、0 BLOCKED、0 NOT TESTED。
- Windows EXE 已由用户确认可正常安装、启动、真实播放和卸载，账号与设置数据保留未发现问题。
- macOS Intel x64 当前版本实机烟测、菜单栏安全重启、DMG 安装、真实播放和卸载未发现问题。
- macOS Apple Silicon arm64 将由本次 GitHub 原生 runner 完成构建、包验证与打包应用冒烟；用户当前没有 arm64 实机，因此不得将 CI 结果表述为实机通过。
- schema v5 真实诊断中 94 条封面请求全部成功并包含排队/上游耗时；导出内容未发现凭据、认证信息、URL、资源身份或响应正文。

## 已知限制

- 慢服务再次出现 `search3` / `getStarred2` 失败时，仍需补取“每次用户操作只产生一个 API 请求”的真实诊断证据。
- macOS Apple Silicon arm64 尚无实机安装、物理听音、菜单栏、媒体键、锁屏与睡眠验收。
- Windows 图标、开始菜单及完整桌面行为，以及 macOS Finder/Dock 细节仍未逐项形成当前候选的人工记录。
- 当前没有自动更新器；候选版升级与回滚需人工完成。

## 重要安全说明

本候选版尚未使用正式发行证书：Windows 安装包未进行 Authenticode 签名；macOS Intel 包未签名，Apple Silicon 包可能只有 ad-hoc 签名；两个 macOS 包均未公证。系统可能显示未知发布者或阻止启动。

仅在确认下载来自本项目 GitHub Release 且 SHA-256 与 `SHA256SUMS.txt` 一致后试用。不要关闭 Gatekeeper、SmartScreen、TLS 或其他系统安全保护；可信用户如被 macOS 拦截，应使用“系统设置 → 隐私与安全性 → 仍要打开”的系统入口。

三个目标必须在 GitHub 原生 runner 完成 lint、类型检查、单元/组件测试、依赖审计、源码 Electron 冒烟、安装包构建、包验证和打包应用 Electron 冒烟后，发布任务才会创建本 Pre-release。自动化与上述人工证据仍不等于正式签名、公证或所有目标实机的完整发布验收。
