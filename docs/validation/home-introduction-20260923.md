# 暗色控件、导论星图与 IDE 打开验收

日期：2026-09-23。分支：main。本轮未提交或推送；后续深浅主题视觉更新属于[另行设计的提案](../全站视觉优化方案.md)，不计入本记录的已实现功能。

## 实施范围

- 保留暗色背景，统一主控件 `#CAD2DC`、实心文字 `#152033`、悬停 `#E0E5EC`、链接 `#CED8E5`、选中底色 `#273247`。浅色主题、五论、进度、错误、图表和 Monokai 语义不变。
- 中央固定黑洞接入独立导论，三节、九道自测；全景循环包含导论和原 17 篇，正文仍显示「第 x / 17 篇」。图谱现有 715 个节点、1056 条关系。
- 单击/Tab 选择，双击/Enter 进入，滚轮进入导论或返回；末级滚轮只缩放。小节保留原 Notebook 和题目 ID，第三节链接既有探索页。新地址 `/#introduction` 与原篇章地址并存。
- 本机服务复用同时检查项目内容与有效 Windows 用户/会话；默认关联失败后查找 VS Code 并直接传入原路径，清除影响 Electron 的继承变量，记录实际错误。接口仍只接受已验证课程 ID。

## 自动检查

- 63 项 Python 检查通过：`test_local_service.py`、`test_local_open.py`、`test_local_desktop.py`、`test_home_graph.py`、`test_home_routes.py`、`test_introduction.py`。
- 46 项 JavaScript 检查通过：`appearance`、`home-graph`、`home-zoom`、`home-renderer`、`home-transition`、`home-layout`、`home-physics`、`introduction`。
- 包含主题控件对比度、导论独立进度、17 篇编号兼容、续学选择、旧目录无导论回退、路由往返、固定中心排除公转布局、末级滚轮及 Canvas 小节材质。
- IDE 模拟检查区分默认关联优先、Unicode 路径、回退参数与环境清理、错误码 1155/5/2、VS Code 非零退出；服务检查包含旧版本/其他用户或会话重启、同上下文复用和判题忙时拒绝强停。

## 实际浏览器操作

在本机 Codex 浏览器实测，未提交任何练习答案：

- 导论 → 前一单元为第 17 / 17 篇 → 下一单元回导论；导论显示独立 0/9，三节分别 0/3。
- Tab 从黑洞切换第一篇，Shift+Tab 返回黑洞；Enter 和双击均进入导论，三节入口齐全，第三节提供自测与探索。
- 实测进入约 **852.9 ms**、返回约 **707.5 ms**（观察节点层过渡期间 inert 状态）；滚轮进出有效，导论末级放大到 240% 仍停留本层且未新增 IDE 请求。
- 主 IDE 按钮悬停背景实测 `rgb(224,229,236)`、文字 `rgb(21,32,51)`；导览、习题、探索、全书目录的背景均为 `rgb(11,17,32)`，主控件变量均为 `#cad2dc`，跨页主题保持。
- 通过开发调试主动丢失 WebGL 上下文，页面切换到 Canvas；深浅全景与导论三节仍可访问。重新加载后恢复 WebGL。
- 检查 1440×900 常规布局、1280×800 侧栏展开及 1920×1080 侧栏隐藏；宽屏信息卡居中且图例可见。较矮窗口沿用现有最小画布高度，底部内容通过纵向滚动访问。本轮未重新完成全套侧栏调宽、超宽屏、跨显卡性能或所有课堂页检查。

截图：[首页](home-introduction-20260923/home-dark.png)、[宽屏](home-introduction-20260923/home-dark-1920.png)、[小窗口](home-introduction-20260923/home-dark-1280.png)、[导论](home-introduction-20260923/introduction-dark.png)、[Canvas 深色](home-introduction-20260923/home-canvas.png)、[Canvas 浅色](home-introduction-20260923/home-canvas-light.png)、[习题](home-introduction-20260923/practice-dark.png)、[导览](home-introduction-20260923/guide-dark.png)、[探索](home-introduction-20260923/explore-dark.png)、[目录](home-introduction-20260923/catalog-dark.png)。部分回退截图摄于最后一项中央重复标题隐藏修订之前，最终首页截图已更新。

## Windows 真实启动与故障区分

1. 在根目录通过 `开始学习.cmd --ensure-only` 启动；修订后服务的上下文标识与当前桌面用户一致。日志改用 UTF-8 保留中文路径及错误。
2. 受限执行账户直接调用同一导论文件的系统默认关联，实际返回 **WinError 5 / errno 13（拒绝访问）**；桌面用户会话中的真实请求则成功。因此确认了账户上下文影响，但旧日志没有保留上下文，不能把所有历史 503 都归因于同一原因。
3. 桌面用户下实际请求 `P00-C01-S01` 与 `P01-C01-S01`，均返回 **202 requested**；浏览器实际点击第三节也得到默认 IDE 请求成功提示。实际 Code 进程参数包含原中文 Notebook 路径。
4. 单独注入默认关联错误 1155，后续查找和启动使用真实已安装 Code.exe，回退返回 `vscode`，`Code.exe --status` 退出码 0。这里的关联失败是模拟，VS Code 启动是真实操作；未更改 Windows 文件关联。
5. 当前工具不提供原生 IDE 画面访问，**没有视觉确认 Notebook 已在 IDE 编辑区显示**；202 只表示操作系统接受打开请求，不能等同于完整 IDE 教学验收。程序缺失、非零退出、忙时重启等边界通过隔离测试覆盖，未卸载应用或干预真实判题任务。

详细账户/进程信息和诊断保存在忽略同步的 `.local` 日志；本记录不复制账户标识。29 份个人学习 JSON 与浏览器检查前的基线逐字节一致；Notebook、题库、评分文件及 AGENTS.md 未改。
