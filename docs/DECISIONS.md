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
