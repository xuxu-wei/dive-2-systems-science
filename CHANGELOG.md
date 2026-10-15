# 变更记录

按版本记录面向使用者的变化，采用 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 的分类方式。

## [未发布]

本次迁移范围与检查结果见[网页教学核对记录](docs/validation/web-teaching-20261015.md)。

### 新增

- 导论及第 1 篇的 12 节网页讲授，含本地公式渲染、代码与实验结果、前后节导航。
- 从网页新标签页打开指定 JupyterLab 实验，自动使用本项目 Python 环境。

### 变更

- 导论及第 1 篇按网页阅读重组：补清概念定义，以手算、表格和图替代整段实验代码；见[修订核对](docs/validation/web-reading-revision-20261015.md)。
- 网页成为主要教学窗口，已迁移 Notebook 专用于动手实验；第 2—17 篇保留原教学内容。
- README 与 ROADMAP 按当前使用方式和未来优先级整理，历史实施记录由本文件与验收文件承接。

### 修复

- 修复中文术语含英文括注时的粗体显示，移除习题页没有对应内容的 JupyterLab 按钮。
- 课程目录更新后知识星图失效；目录和星图同步构建，并按 JSON 内容校验。

### 移除

- 默认 IDE / VS Code 打开接口、桌面关联探测及 VS Code 自动启动任务。
- 已迁移 Notebook 的服务启动单元与重复题面；练习由原题库继续提供。

## [0.1.0] - 2026-10-06

### 新增

- 导论及十七篇教材、可运行 Notebook、交互探索、选择题和 Python 计算题。
- 本机判题与个人学习记录、章节目录和知识星图。

### 变更

- 完成逐篇语言与习题表述修订，原成绩兼容；见[导论与第 1 篇](docs/validation/intro-part01-rewrite-20261005.md)、[第 2—17 篇交付索引](docs/validation/style-rewrite-index-20261006.md)。
- 补充微积分手算与条件期望桥接，见[数学桥接记录](docs/validation/math-bridges-20261003.md)。

### 修复

- 修订科学表述、量纲契约和术语误注，具体核查见 `docs/validation/` 中对应勘误记录。
- 修复项目移动后的学习入口，见[启动修复记录](docs/validation/local-service-relocation-20261002.md)。

### 移除

- 在正式内容交付后清理独立制作样章，保留 Git 历史与原验收记录。
