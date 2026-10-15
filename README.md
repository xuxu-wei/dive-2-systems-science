# 动手学系统科学

以人体与生命系统为贯穿案例，通过问题、数学解释和计算实验学习系统科学。面向掌握基础 Python 和中学数学的读者，必要的大学数学在使用前引入。

**网页承载讲授、可视化和练习；JupyterLab 中的 Notebook 用于修改代码、运行实验和比较结果。** 导论及第 1—11 篇已提供 140 节网页讲授和对应实验。第 12—17 篇暂保留完整 Notebook 教学，可从网页目录打开。全书现有 206 本 Notebook、939 道练习，支持普通 PC 的 CPU 实验。

## 开始学习

首次使用，在项目根目录打开终端，用 Python 3.11 或以上版本安装学习环境（本机验证为 Python 3.13）：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[learn]"
```

随后双击 [开始学习.cmd](开始学习.cmd)，从浏览器中的[导论](http://127.0.0.1:8000/introduction/)开始。点击“打开 JupyterLab 实验”会在新标签页打开本项目的原 Notebook，并使用项目 Python 环境。网页公式、图形和练习资源均随仓库提供，安装后可离线学习。

<a id="run-m1"></a>
启动程序负责运行本机服务；直接双击 HTML 无法启动 Python 或 JupyterLab。服务已运行时，可直接访问 [首页](http://127.0.0.1:8000/)或浏览器书签。环境配置、移动目录与故障处理见[学习指南](docs/学习指南.md)。

## 项目导航

| 内容 | 入口 |
|---|---|
| 当前范围与下一步 | [ROADMAP](ROADMAP.md) |
| 课程组织、写作与概念引入 | [教材设计](docs/教材设计.md) |
| 页面、实验和生成源 | [工程设计](docs/工程设计.md) |
| 制作与核对 | [制作检查表](docs/教材制作检查表.md) |
| 已发布变化 | [CHANGELOG](CHANGELOG.md) |

模拟数据、环境、个人作答记录与临时文件不进入 Git。教材运行独立于外部数据生成器。

## 帮助与维护

项目发起者与贡献者共同维护，具体贡献见 Git 记录。使用问题可提交到[仓库 Issues](https://github.com/xuxu-wei/dive-2-systems-science/issues)，附上篇章、操作步骤和错误信息。项目采用 [MIT 许可](LICENSE)，第三方资源保留各自的许可证。
