# Sonavi 双平台设计映射

更新日期：2026-09-13

## 共用视觉来源

`Sonavi_UI_v0.1/` 是视觉参考包。P01 从 `tokens.css` 复用石色画布、白色抬升面、深色侧栏、琥珀强调、圆角和间距，并在 `src/renderer/src/styles/tokens.css` 增加跨平台中英文字体回退。连接页参考 `04-connect` 的信息层级，但不照搬其中“在此 Mac 上记住我”等单平台文案。

| 参考内容 | 共享实现 | 平台差异 |
| --- | --- | --- |
| 石色/琥珀 tokens | renderer CSS 变量 | 无 |
| 左导航、内容区、底部播放器 | 单一 App.vue 外壳 | 无 |
| 连接表单 | 单一 ConnectPanel.vue | 设备名称由 preload 提供 |
| 设置快捷键提示 | 同一文案槽位 | Windows Ctrl；macOS Cmd |
| 标题栏 | 不在 renderer 绘制 | 使用各自原生边框与按钮 |
| 字体 | 同一 fallback 列表 | Windows 优先 Segoe UI/微软雅黑；macOS 优先苹方/冬青黑体 |

## P01 桌面外观规则

- 不渲染假的 macOS 红黄绿按钮，不隐藏原生 Windows 控件。
- 不使用持续背景动画或重度毛玻璃。
- 长中文、英文 URL 与系统替代字体不得造成表单横向溢出；连接内容使用可收缩网格与明确最小宽度。
- 默认 BrowserWindow 为 1240×800，最小尺寸 960×640；P05 再做完整响应式验收。

## 分平台验证记录入口

实际截图与人工结果只写入 `docs/TEST-REPORT.md`：

- Windows 11 x64：必须在 Windows 实机单独启动并截图；macOS 截图不能代替。
- macOS Intel x64：必须在 Intel Mac 单独启动并截图。
- macOS Apple Silicon arm64：必须在 Apple Silicon Mac 单独启动 arm64 包并截图。

当前主机的截图产物位于 `artifacts/screenshots/`，该目录是本地测试证据，不作为另一平台验收结论。
