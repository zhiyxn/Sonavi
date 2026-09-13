# Sonavi 产品需求

状态：P01 已完成并通过三目标 CI；P02 连接认证进行中，Windows/Apple Silicon 实机待验证
更新日期：2026-09-13

## 产品目标

Sonavi 是个人使用优先、非网页套壳的 Navidrome/Subsonic/OpenSubsonic 桌面音乐客户端。从第一版开始，Windows 与 macOS 是地位相同的正式支持平台：

- Windows 11 x64；
- macOS 13+ Intel x64；
- macOS 13+ Apple Silicon arm64。

同一仓库、同一工程和同一核心业务代码分别构建三种目标。当前开发主机只能证明其实际执行过的目标；其他目标保留在正式范围并标记待验证。

## 第一版共享功能范围

两个平台共用 Navidrome/Subsonic/OpenSubsonic 客户端、认证业务、音乐库、搜索、收藏、歌单、AudioEngine、播放队列、歌词、缓存、设置、组件、导航、页面布局、播放器和交互逻辑。

阶段顺序沿用 P01～P10：工程基础 → 认证连接 → 最短播放链路 → 播放核心 → 音乐库 UI → 收藏歌单 → 歌词上报 → 转码网络诊断 → 桌面集成性能 → 打包发布前审计。P01 已收口，当前只推进 P02，不提前实现 P03 播放。

## P01 验收范围

- 一套可运行 Electron + Vue + TypeScript 工程；
- 共享的 Sonavi 连接页与应用外壳；
- 安全的 main/preload/renderer 边界；
- 必要且集中的平台适配入口；
- Windows x64、macOS x64、macOS arm64 构建入口；
- 可真实执行的 lint、typecheck、test、build 与 Electron 冒烟；
- 分平台兼容性与验证记录。

P01 的上述验收项已经完成。P02 实现公共 Subsonic/OpenSubsonic 连接、认证、能力探测、CredentialStore 与错误诊断；音乐库正式页面、播放队列、媒体协议、托盘和完整桌面集成仍按 P03 以后阶段推进，不能回退假数据。

## UX 与平台行为

两端共享石色/中性色、少量琥珀色、低动画和桌面应用布局。设计稿中的 macOS 外观只是视觉参考。

- P01 使用各平台原生窗口边框和控制按钮；不绘制假的红黄绿按钮。
- 快捷键提示由受限平台信息驱动：Windows 为 Ctrl，macOS 为 Cmd。
- 字体依次覆盖 Segoe UI、Microsoft YaHei UI、PingFang SC、Hiragino Sans GB、Noto Sans SC/CJK 与 system-ui。
- P01 中 Windows 关闭最后窗口即退出；macOS 关闭窗口但保留应用进程，可从 Dock 重新激活，真正退出使用应用菜单/Cmd+Q。
- “隐藏/关闭到托盘继续播放”与真正退出将在 P09 明确实现；P01 不声称支持后台播放。

## 非首版强制目标

Windows ARM64、Linux、macOS Universal 合并包、自动更新、公开签名/公证发布、离线下载、插件市场、均衡器与高级音频引擎不因本轮平台修正扩大范围。
