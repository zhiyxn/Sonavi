# P10 打包、兼容性与发布前审计报告

日期：2026-09-15
状态：P10 当前 macOS Intel 未签名开发包代码闸门通过；三目标 P10 CI、正式签名/公证和各平台完整实机发布验收未完成

## 测试环境

- 本机：macOS 13.7.8（22H730），Intel x64。
- Node.js v22.19.0（NVM），npm 10.9.3。
- Electron 44.3.0，electron-vite 5.0.0，electron-builder 26.15.3。
- 分支 `main`；HEAD/origin 为 `fb430a1`，P10 改动尚未提交。
- Electron 冒烟只连接 `127.0.0.1` 临时 OpenSubsonic fixture，使用合成 WAV/PNG，不读取用户服务或凭据。

## 命令结果

| 命令/操作 | 结果 | 证据 |
| --- | --- | --- |
| `git diff --check` / `npm run lint` | 通过 | 无空白错误；0 warning |
| `npm run typecheck` | 通过 | node/preload、renderer、tests 三组；x64 构建重复通过 |
| `npm test` | 通过 | 23 个文件、102 项测试 |
| 包验证器定向测试 | 通过 | 6 项：三个目标、PE 架构、Mach-O 名称归一、发行签名判定、权限拒绝、SHA-256 |
| `npm audit --audit-level=high --registry=https://registry.npmjs.org` | 通过 | 0 vulnerabilities |
| `npm run test:e2e` | 通过 | 最终源码 Electron 完整 P01～P10 回归 |
| `npm run build:mac:x64` | 通过 | 最终未签名 x64 DMG 生成；首次沙箱运行因 GitHub DNS 失败，授权联网后完成 |
| `npm run verify:package -- mac-x64` | 通过 | 架构、标识、版本、macOS 13、DMG、ASAR、图标、签名状态与 SHA-256 |
| `npm run test:e2e:package -- mac-x64` | 通过 | 最终包内完整 P01～P10 回归 |
| DMG 只读挂载与临时安装 | 通过 | hdiutil 校验所有分区 CRC，复制后的应用元数据和 ASAR 正确 |
| DMG 安装后 Electron 冒烟 | 通过 | preload/CSP/媒体协议/safeStorage/重启恢复等完整流程 |
| 截图目视 | 通过（当前 Intel Mac） | 浅色/深色、中文/英文、导航、播放器无明显截断/重叠/横向溢出 |

## 发现并修复的问题

1. 旧包 Info.plist 自动带入相机、麦克风、蓝牙和音频采集 usage description，而 Sonavi 不使用这些能力。P10 使用 `extendInfo: null` 删除五项声明，验证器会阻止回归；main 的权限请求默认拒绝保持不变。
2. 旧 `app.asar` 为约 55 MiB，包含近万条构建期依赖和四千余个 source map。main 仅有 Zod 外部运行时依赖，因此将 Zod 内联并排除 `node_modules`；最终 ASAR 为 1,959,330 字节，只包含 `out/` 与 `package.json`，DMG 从约 145.8 MB 降至 137.3 MB。
3. 第一版验证器把 `lipo` 的 `x86_64` 与产品目标名 `x64` 直接比较，产生假失败。已增加明确归一并补测试，不放宽对多架构或错误架构的拒绝。
4. P07 Electron 冒烟仅给 now-playing 条件 3 秒、submission 使用固定 2.4 秒等待，慢 CI 容易产生时序误报。统一改为最长 10 秒条件等待，仍要求真实请求出现。

## 最终 macOS Intel 包

- 路径：`release/0.1.0/Sonavi-0.1.0-mac-x64.dmg`（本地忽略目录）。
- 大小：137,343,264 字节。
- SHA-256：`f5afe1f70024d71cdf319b561f4a59d0fb7c8fb4ffe682b889b6f6855a648074`。
- 应用：Mach-O x64；Bundle ID `com.sonavi.desktop`；版本 0.1.0；`LSMinimumSystemVersion=13.0`。
- 资源：`app.asar` 和 `icon.png` 存在；ASAR 1,959,330 字节。
- 签名：未签名；无 Team ID；未公证、未 staple。只能作开发测试包。
- manifest：`release/0.1.0/Sonavi-0.1.0-mac-x64.manifest.json`。

包内冒烟启动到连接 UI 约 1114 ms，20 轮设置/首页切换工作集增量 48,352 KiB、媒体请求 +0。最终 DMG 临时安装后的对应数字约 1111 ms、47,148 KiB、+0。均是一次受控采样，不是跨平台性能承诺。

## 安装后自动覆盖

- BrowserWindow：`contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`、`webSecurity=true`、无 webview/insecure content/drag navigation。
- CSP：`default-src 'none'` 与 `frame-ancestors 'none'`；renderer 没有 Node/`process`/原始 IPC。
- 连接：固定 IPC、发送者和输入校验；token/salt 认证；两页专辑、详情和封面。
- 媒体：renderer 只见不透明 `sonavi-media`；真实 HTMLAudioElement 流式请求、Range/seek、取消和句柄撤销。
- 播放：队列、重复项、前后切歌、歌词、now-playing/submission、兼容转码与 `transcodeOffset` 完整时间线。
- 服务器写入：fixture 收藏与歌单 CRUD、重复歌曲按索引移除和写后重读。
- 桌面：Media Session、关闭隐藏同一 BrowserWindow、应用激活恢复、20 轮切页无新增媒体请求。
- userData：隔离路径内 safeStorage 加密往返、凭据跨进程恢复/删除、暂停队列以新媒体句柄恢复；应用/安装目录没有写用户配置。

## 分平台证据

| 验证项 | Windows 11 x64 | macOS 13+ Intel x64 | macOS 13+ arm64 |
| --- | --- | --- | --- |
| `fb430a1` 源码 lint/typecheck/test | CI 通过 96 项 | CI lint/typecheck/test 通过，Electron 冒烟失败 | CI 通过 96 项 |
| `fb430a1` 源码 Electron 冒烟 | CI 通过 | CI 失败；当前本机此前/本轮包内通过 | CI 通过 |
| `fb430a1` 安装包构建 | NSIS 成功，未保留产物检查 | 因前置冒烟失败而跳过 | arm64 DMG 成功，未保留产物检查 |
| 当前 P10 102 项测试 | 待新 CI | 本机通过 | 待新 CI |
| 当前 P10 包验证/包内冒烟 | 待新 CI | 通过 | 待新 CI |
| 安装器实际安装/启动 | 未验证 | 未签名 DMG 挂载和临时安装通过 | 未验证 |
| 签名/公证 | 未验证、无证书 | 未签名、未公证 | 未验证、无证书 |
| 截图与字体 | 未验证 | 通过当前截图范围 | 未验证 |
| 真实服务器/物理听音/媒体键 | 未验证 | 未验证 | 未验证 |
| 最低系统版本 | Windows 11 实机未验证 | 当前 13.7.8 通过；13.0 未验证 | 13.0 未验证 |

GitHub Actions run `34842121215` 不能记作全绿。当前 CI 配置已在三个 package step 后加入 `verify:package` 与 `test:e2e:package`，但只有 P10 提交后才能取得结果。

## 发布前安全审计

- [x] Electron 安全偏好、严格 CSP、导航/新窗口/权限默认拒绝未放宽。
- [x] preload 仅固定业务方法；main 对每个 IPC 检查受信 sender 和 Zod 输入，会话/权限在服务层再次约束。
- [x] renderer ESLint 禁止 Node、`process`、localStorage、sessionStorage 与 `v-html`；未发现任意 URL 代理或原始 IPC。
- [x] 密码/token/salt/Cookie/Authorization 不进入 renderer store、日志、认证输出或明文 userData；safeStorage 失败不落盘明文。
- [x] API/媒体禁止重定向；HTTPS 证书校验不关闭；手动代理拒绝 URL 内嵌凭据。
- [x] 音频流保留背压，不整首缓冲/缓存/Base64 IPC；Range 只接受单段并正确处理 200/206/416。
- [x] 诊断限量脱敏；歌词纯文本；renderer 不使用 `v-html`，减少 XSS 面。
- [x] 收藏/歌单写入固定端点和参数、写后重读；scrobble 按 queueEntryId 防重且不盲目重试未知结果。
- [x] 队列、封面缓存和凭据按账号范围隔离；忘记账号清除对应状态。
- [x] ASAR 不含构建期 node_modules、测试或项目源码；`npm audit` 为 0 vulnerabilities。
- [ ] Windows Authenticode、macOS Developer ID、公证/stapling 和下载隔离属性下系统安全检查未执行。

## 未验证、已知问题与结论

- 当前包未签名/未公证，不能作为正式公开发布物；不得用关闭 Gatekeeper/SmartScreen 等方式替代签名。
- Windows 和 Apple Silicon 的 P10 package verifier、打包应用 Electron 冒烟、安装 UI、图标、桌面行为与声音仍待对应环境。
- macOS Intel 未人工操作 Finder/Dock 图标遮罩、菜单栏每一项、物理媒体键、睡眠/锁屏和扬声器。
- 用户真实服务器的格式、转码器、代理、歌单权限、scrobble 计数和大型资料库仍需单独验证。
- 0.1.0 没有旧公开版本迁移样本；当前只证明同一 candidate 的 versioned userData 可跨进程重启恢复。
- 构建仍有 Rollup 移除 Zod 注释位置的非阻断提示；Zod 已正确内联，类型、测试和包内运行均通过。

结论：P10 的实现和当前 macOS Intel 未签名开发包达到本机代码闸门，但尚未达到三平台正式发布验收。发布仍被三目标 P10 CI、对应实机安装、正式签名/公证、真实服务器与人工音频/桌面测试阻断。
