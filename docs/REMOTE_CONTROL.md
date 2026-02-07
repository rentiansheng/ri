# Remote Control - Discord/Slack Bot Integration

> 通过 Discord 或 Slack 机器人远程控制 RI 终端中的 AI CLI 工具

## 概述

Remote Control 功能允许你通过 Discord 或 Slack 聊天机器人远程控制 RI 终端会话中运行的 AI CLI 工具（如 OpenCode、Aider、Cursor 等）。适用于以下场景：

- 📱 在手机上监控和控制正在运行的 AI 编程任务
- 🖥️ 不在电脑前时远程发送指令
- 👥 团队协作，多人共同监控 AI 工作进度
- 🔔 实时接收 AI 输出通知

## 功能特性

- **双平台支持**：同时支持 Discord 和 Slack
- **实时输出转发**：终端输出自动推送到聊天
- **多会话管理**：列出、切换多个终端会话
- **安全控制**：用户/频道白名单机制
- **智能防刷屏**：输出去抖动和分片发送

## 快速开始

### 1. 安装依赖

```bash
cd /path/to/om
npm install discord.js @slack/bolt
```

### 2. 配置机器人

#### Discord Bot 配置

1. 访问 [Discord Developer Portal](https://discord.com/developers/applications)
2. 点击 "New Application" 创建应用
3. 进入 "Bot" 页面，点击 "Add Bot"
4. **重要**：开启 "MESSAGE CONTENT INTENT"（在 Privileged Gateway Intents 下）
5. 复制 Bot Token
6. 生成邀请链接并邀请机器人到服务器：
   - OAuth2 → URL Generator
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Read Message History`

#### Slack Bot 配置

1. 访问 [Slack API Apps](https://api.slack.com/apps)
2. 点击 "Create New App" → "From scratch"
3. 进入 "Socket Mode"，启用并获取 **App-Level Token** (`xapp-...`)
4. 进入 "OAuth & Permissions"：
   - 添加 Bot Token Scopes: `chat:write`, `channels:history`, `groups:history`, `im:history`, `mpim:history`
   - 安装到工作区，获取 **Bot Token** (`xoxb-...`)
5. 进入 "Event Subscriptions"，订阅事件: `message.channels`, `message.groups`, `message.im`

### 3. 在 RI 中配置

1. 打开 RI 应用
2. 进入 Settings（⚙️）→ Remote Control（📡）
3. 填入相应的 Token
4. 开启 "Enable Remote Control"

## 命令参考

| 命令 | 说明 | 示例 |
|------|------|------|
| `/ai <prompt>` | 发送提示词到 AI | `/ai 请帮我重构 auth 模块` |
| `/sessions` | 列出所有可用终端会话 | `/sessions` |
| `/select <n>` | 切换到指定会话（序号或 ID） | `/select 2` |
| `/status` | 查看连接状态 | `/status` |
| `/stop` | 发送中断信号 (Ctrl+C) | `/stop` |
| `/y` 或 `/yes` | 发送确认 "y" | `/y` |
| `/n` 或 `/no` | 发送否认 "n" | `/n` |

> 💡 提示：命令也支持 `!` 前缀，如 `!ai hello`

## 架构说明

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Discord/Slack │────▶│ RemoteControlMgr │────▶│ TerminalManager │
│      Bots       │◀────│                  │◀────│                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        │  commands              │  write()               │  pty
        │                        │                        │
        ▼                        ▼                        ▼
   Chat Messages          terminal-output event      AI CLI Process
```

### 数据流

1. **用户 → AI**：
   - 用户在 Discord/Slack 发送 `/ai <prompt>`
   - RemoteControlManager 收到消息
   - 调用 `terminalManager.write()` 写入终端
   - AI CLI 收到输入并处理

2. **AI → 用户**：
   - AI CLI 产生输出
   - TerminalManager 发出 `terminal-output` 事件
   - RemoteControlManager 监听事件，收集输出
   - 去抖动（500ms）后发送到聊天

## 安全配置

### 用户白名单

只允许特定用户发送命令：

```
Allowed User IDs: U1234567890, U0987654321
```

### 频道白名单

只在特定频道响应命令：

```
Allowed Channel IDs: C1234567890, #ai-control
```

> ⚠️ 如果两个白名单都为空，则允许所有用户和频道（不推荐在公开服务器使用）

## 输出处理

### 去抖动

终端输出会在 500ms 内合并，避免频繁发送消息。

### ANSI 清理

自动移除 ANSI 转义序列（颜色码等），确保聊天消息可读。

### 消息分片

超过 1900 字符的消息会自动分片发送，避免超过平台限制。

## 故障排除

### Discord Bot 不响应

1. 确认已开启 MESSAGE CONTENT INTENT
2. 检查 Bot Token 是否正确
3. 确认机器人已邀请到服务器
4. 查看 RI 控制台日志

### Slack Bot 不响应

1. 确认 Socket Mode 已启用
2. 检查两个 Token（Bot Token 和 App Token）是否都填写
3. 确认已订阅消息事件
4. 检查 Bot 是否已添加到频道

### 输出不转发

1. 确认有活跃会话（使用 `/sessions` 查看）
2. 使用 `/select` 切换到正确的会话
3. 检查 RI 控制台是否有错误日志

## 配置文件结构

配置保存在 RI 的配置文件中：

```json
{
  "remoteControl": {
    "enabled": true,
    "discord": {
      "enabled": true,
      "botToken": "your-discord-bot-token"
    },
    "slack": {
      "enabled": true,
      "botToken": "xoxb-your-slack-bot-token",
      "appToken": "xapp-your-slack-app-token"
    },
    "allowedUsers": ["U1234567890"],
    "allowedChannels": ["C1234567890"]
  }
}
```

## 相关文件

| 文件 | 说明 |
|------|------|
| `electron/remoteControlManager.cjs` | 核心管理器，处理 Bot 连接和命令 |
| `electron/main.cjs` | 主进程集成和 IPC 处理 |
| `electron/preload.cjs` | 暴露 `window.remoteControl` API |
| `src/renderer/components/Settings/RemoteControlSettings.tsx` | 设置界面 |
| `src/renderer/types/global.d.ts` | TypeScript 类型定义 |

---

# Terminal View Command

> 让 AI CLI 工具触发 RI 打开文件

## 概述

View Command 功能允许终端中运行的程序（如 AI CLI）通过打印特殊字符串来触发 RI 打开指定文件。这实现了 AI 工具与 RI 编辑器的深度集成。

## 使用方式

### 可见格式（推荐用于调试）

```bash
echo "__RI_VIEW:/path/to/file.ts__"
```

### 不可见格式（推荐用于生产）

使用 OSC 转义序列，用户看不到输出：

```bash
printf '\033]__RI_VIEW:/path/to/file.ts__\007'
```

## 在 AI CLI 中集成

### OpenCode 插件示例

```javascript
// 在 OpenCode 输出中嵌入 view 命令
function viewFile(filePath) {
  // 使用不可见的 OSC 序列
  process.stdout.write(`\x1b]__RI_VIEW:${filePath}__\x07`);
}

// 当 AI 编辑完文件后调用
viewFile('/Users/me/project/src/app.ts');
```

### Shell 脚本示例

```bash
#!/bin/bash
# 编辑完成后在 RI 中打开文件

edit_and_view() {
  local file="$1"
  # ... 编辑文件的逻辑 ...
  
  # 触发 RI 打开文件
  printf '\033]__RI_VIEW:%s__\007' "$file"
}

edit_and_view "/path/to/edited/file.py"
```

## 技术实现

1. `TerminalManager.parseForViewCommand()` 监听终端输出
2. 检测 `__RI_VIEW:path__` 或 OSC 变体 `\x1b]__RI_VIEW:path__\x07`
3. 发出 `terminal-view-file` 事件
4. `main.cjs` 监听事件，通过 IPC 发送到渲染进程
5. `App.tsx` 调用 `openFileTab()` 打开文件

## 支持的格式

| 格式 | 正则表达式 | 可见性 |
|------|------------|--------|
| 可见 | `__RI_VIEW:(.+?)__` | 用户可见 |
| OSC | `\x1b]__RI_VIEW:(.+?)__\x07` | 不可见 |

---

## License

This feature is part of RI (Second Brain OS) and follows the same license terms.
