# RI (Research Intelligence)

> [English](./README.md) | [中文文档](#)

RI 是一个基于 Electron、React 和 TypeScript 构建的现代终端会话管理器。它旨在通过多会话管理、命令历史追踪、实时通知和统一的选项卡界面，帮助开发者高效组织工作流。

## 核心特性

### 基础管理
- **多终端会话**：创建并管理多个独立的终端进程。
- **统一选项卡系统**：所有的终端、历史记录、设置都在同一个选项卡栏中展示，带有清晰的类型前缀。
  - 终端：显示会话名称（如 "Session 1"）。
  - 历史：`[H]: 会话名称`。
  - 设置：`[S]: Settings`。
- **强健的进程管理**：在关闭会话或退出应用时，自动清理所有子进程（进程组），彻底告别僵尸进程。
- **会话持久化**：即使关闭选项卡，终端进程仍保持运行，随时可以重新开启。
- **拖拽排序**：支持通过拖拽自由调整选项卡的顺序。

### 视图与导航
- **侧边栏图标**：快速切换核心功能。
  - ⚡ 会话 (Sessions) - 管理终端。
  - 📜 历史 (History) - 查看命令日志。
  - 🔔 通知 (Notify) - 监控终端事件。
  - ⚙️ 工作流 (Flow) - 自动化任务（开发中）。
  - ⚙ 设置 (Settings) - 应用配置。
- **可折叠导航栏**：左侧面板可根据当前视图显示相关列表，支持折叠以节省空间。

### 终端功能
- **完整的终端模拟**：基于 xterm.js，支持自动适配窗口大小。
- **命令历史记录**：自动追踪并保存每个会话的命令执行日志。
- **AI 工具检测**：自动识别 AI 编程助手（如 OpenCode, Copilot, Aider, Cursor, Cline）的状态。
- **安全删除**：删除会话时提供上下文确认菜单，防止误删。

### 通知系统
- **桌面通知**：重要终端事件的即时提醒。
- **Toast 通知**：应用内浮层提示，支持多种主题（VSCode、macOS、Windows、Material）。
- **未读计数**：侧边栏图标显示未读通知总数。
- **Magic Strings**：支持通过特定的终端转义序列触发应用级通知。
- **外部集成**：支持发送通知到 Slack、Discord、Telegram、钉钉、企业微信等外部平台。

### OpenCode 集成
- **自动启动**：应用启动时可自动开启 OpenCode 服务端和 Web 界面。
- **进程管理**：独立控制 Server 和 Web 进程的启动与停止。
- **状态监控**：实时查看 PID、端口号和运行日志。
- **日志流**：实时查看 OpenCode 运行日志，便于调试。
- **可配置**：支持启动延迟、自动重启、日志级别等配置。
- **RI 通知插件**：一键安装 OpenCode 插件，无缝集成 RI 通知系统。
  - OpenCode 完成任务时自动发送通知到 RI。
  - 插件自动检测 RI 终端环境。
  - 零配置，开箱即用。
  - 轻松管理：安装、重装、打开目录、查看文档。

---

## 技术栈

- **前端**: React 18, TypeScript
- **桌面壳**: Electron 30
- **状态管理**: Zustand
- **终端引擎**: xterm.js
- **构建工具**: Vite 5
- **进程通讯**: node-pty

## 安装与开发

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 生产构建
```bash
# 使用常规脚本
npm run build
# 或使用自动化构建脚本
./build-app.sh
```

### 清理残留进程
如果遇到进程残留，可以运行：
```bash
./cleanup-processes.sh
```

## 项目结构

```
.
├── electron/                   # Electron 主进程代码
│   ├── main.cjs               # 主进程入口
│   ├── terminalManager.cjs    # 终端进程管理（含 PGID 清理）
│   ├── sessionLogger.cjs      # 命令历史记录
│   ├── notificationManager.cjs # 桌面通知管理
│   └── opencodePlugin.cjs     # OpenCode 插件安装管理器
├── src/                       # 渲染进程 (React) 代码
│   └── renderer/
│       ├── components/        # React 组件
│       │   ├── Sidebar.tsx              # 侧边栏导航
│       │   ├── TabBar.tsx               # 统一选项卡栏
│       │   ├── Terminal.tsx             # xterm.js 终端组件
│       │   ├── SessionList.tsx          # 会话列表
│       │   ├── HistoryList.tsx          # 历史记录列表
│       │   ├── NotifyList.tsx           # 通知列表
│       │   ├── Settings/
│       │   │   ├── OpencodeSettings.tsx # OpenCode 配置与插件管理
│       │   │   └── OpencodeSettings.css
│       │   └── SettingsView.tsx         # 主设置界面
│       ├── store/             # Zustand 状态管理
│       └── styles/            # CSS 样式
├── docs/                       # 详细技术文档
│   ├── QUICKSTART.md          # 快速开始指南（英文）
│   ├── NOTIFICATIONS.md       # 通知系统详解（英文）
│   ├── NOTIFICATION_API.md    # 通知 API 协议（英文）
│   └── OPENCODE_PLUGIN.md     # OpenCode 插件指南（英文）
├── opencode-ri-notification/  # OpenCode RI 通知插件源码
│   ├── index.ts               # 插件入口
│   ├── lib/                   # 插件实现
│   ├── README.md              # 插件文档
│   └── package.json           # 插件清单
├── PROCESS_CLEANUP.md         # 关于进程清理机制的说明
├── README.md                  # 英文文档
└── README_CN.md               # 本文件（中文文档）
```

## 快速开始

### 创建终端会话
1. 点击左侧导航栏的 **+ 按钮**。
2. 新会话将以默认名称创建（如 "Session 1"）。
3. 输入你的第一条命令。
4. 会话将自动根据首条命令重命名。

### 管理选项卡
- **切换选项卡**：点击顶部选项卡栏中的任意选项卡。
- **关闭选项卡**：悬停后点击选项卡上的 `×` 按钮。
  - 关闭终端选项卡仅隐藏它，进程仍在后台运行。
  - 可通过左侧会话列表重新打开。
- **拖拽排序**：拖动选项卡以调整顺序。

### 查看命令历史
1. 点击侧边栏的 **📜 历史** 图标。
2. 左侧面板显示所有包含历史记录的会话。
3. 点击某个会话，在主区域打开 `[H]: 会话名称` 选项卡。
4. 浏览所有命令及其时间戳和输出。

### 配置通知
1. 点击侧边栏的 **⚙ 设置** 图标。
2. 进入 **Notifications（通知）** 分类。
3. 启用 "Enable Notifications"。
4. 选择通知主题（VSCode、macOS、Windows、Material）。
5. 设置 Toast 持续时间（默认 3000ms）。
6. 配置外部集成（可选）：
   - Slack：输入 Webhook URL 和频道。
   - Discord：输入 Webhook URL。
   - Telegram：输入 Bot Token 和 Chat ID。
   - 钉钉：输入 Webhook URL 和 Secret（可选）。
   - 企业微信：输入 Webhook URL。
7. 点击 **Save Changes（保存更改）**。

### OpenCode 集成

**自动启动 OpenCode：**
1. 进入设置 → OpenCode 分类。
2. 启用 "Enable Auto-Start"。
3. 勾选 "Start Server" 和/或 "Start Web"。
4. 设置启动延迟（默认 2 秒）。
5. 保存配置。

**安装 RI 通知插件：**
1. 在设置 → OpenCode 页面中。
2. 滚动到 "RI Notification Plugin（RI 通知插件）" 部分。
3. 点击 **"Install Plugin（安装插件）"** 按钮。
4. 等待成功通知。

**使用插件：**
1. 在 RI 中打开任意终端会话。
2. 运行 `opencode`。
3. 插件自动激活（查看激活消息）。
4. 正常使用 OpenCode。
5. OpenCode 完成任务时，RI 会收到通知！

**插件管理：**
- **重装插件**：点击 "Reinstall Plugin" 按钮。
- **打开目录**：点击 "Open Plugin Directory" 在 Finder 中打开插件目录。
- **查看文档**：点击 "View Documentation" 打开插件 README。

### 发送自定义通知

在终端中使用 Magic Strings 协议：

```bash
# 简单文本通知
printf "\033]9;任务完成！\007"

# JSON 格式通知（带标题、正文、类型）
printf "\033]9;{\"title\":\"构建状态\",\"body\":\"生产环境构建完成\",\"type\":\"success\"}\007"
```

支持的通知类型：
- `info`（信息，蓝色）
- `success`（成功，绿色）
- `warning`（警告，黄色）
- `error`（错误，红色）

## 文档索引

### 入门指南
- [快速开始（英文）](./docs/QUICKSTART.md)
- [快速开始（中文）](./docs/QUICKSTART_CN.md)（即将推出）

### 核心功能
- [通知系统（英文）](./docs/NOTIFICATIONS.md)
- [通知系统（中文）](./docs/NOTIFICATIONS_CN.md)（即将推出）
- [通知 API 协议（英文）](./docs/NOTIFICATION_API.md)
- [通知 API（中文）](./docs/NOTIFICATION_API_CN.md)（即将推出）
- [进程清理机制](./PROCESS_CLEANUP.md)

### 集成
- [OpenCode 插件指南（英文）](./docs/OPENCODE_PLUGIN.md)
- [OpenCode 插件（中文）](./docs/OPENCODE_PLUGIN_CN.md)（即将推出）

## 常见问题

### 终端显示黑屏或无法输入
- **原因**：xterm.js 初始化时序问题。
- **解决**：关闭选项卡并重新打开，终端使用懒加载机制。

### 关闭应用后仍有残留进程
- **解决**：运行 `./cleanup-processes.sh` 手动清理。
- 正常情况下应自动清理，如有问题请反馈。

### 通知不显示
- 检查设置 → 通知 → 确保 "Enable Notifications" 已启用。
- 确保 "System Notifications" 或 "In-App Toast" 至少启用一个。

### OpenCode 插件未激活
- 检查插件安装：设置 → OpenCode → 插件状态应显示 "Installed"。
- 确认在 RI 终端中运行：执行 `echo $RI_TERMINAL` 应输出 `true`。
- 查看 OpenCode 日志是否有激活消息。

## 许可证

本项目为私有项目，目前未获得公开发布许可。
