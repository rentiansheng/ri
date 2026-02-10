# OM - Open Manager

> [English](./README.md) | [中文文档](#)

OM 是一个现代化的开发者工作空间管理系统，结合了强大的终端会话管理器 (RI) 和集中控制网关。支持本地和远程（通过聊天平台）控制你的开发环境。

## 组件

| 组件 | 描述 | 技术栈 |
|------|------|--------|
| **[RI](./ri/README.md)** | 终端会话管理器，支持工作流自动化 | Electron, React, TypeScript |
| **[Gateway](./gateway/README_CN.md)** | 远程访问的集中控制服务器 | Go |

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                          聊天平台                               │
│              (Slack, Discord, Web UI, Telegram)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Gateway                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │    适配器   │  │   注册中心   │  │        Web UI           │ │
│  │ Slack/Discord│ │  RI 追踪器  │  │    浏览器控制台         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌─────────┐     ┌─────────┐     ┌─────────┐
        │  RI #1  │     │  RI #2  │     │  RI #N  │
        │  (本地) │     │  (远程) │     │  (...)  │
        └─────────┘     └─────────┘     └─────────┘
```

## 快速开始

### RI (本地终端管理器)

```bash
cd ri
npm install
npm run dev
```

### Gateway (远程控制服务器)

```bash
cd gateway

# 设置环境变量
export GATEWAY_WEBUI_ENABLED=true
export GATEWAY_WEBUI_PASSWORD=your-password

# 运行
go run ./cmd/gateway
```

访问 Web UI：`http://localhost:8080/web/login`

## 功能概览

### RI - 终端会话管理器

- **多终端会话** - 独立进程，支持分屏视图
- **工作流自动化** - 定义和运行命令序列 (Flow)
- **文件管理器** - 浏览工作区文件，支持收藏和排序
- **文件查看器** - VSCode 风格编辑器，支持语法高亮
- **通知系统** - 桌面提醒，Slack/Discord Webhook
- **OpenCode 集成** - AI 助手进程管理
- **输入法支持** - 正确处理中日韩输入法

### Gateway - 远程控制服务器

- **多平台支持** - Slack、Discord、Web UI、自定义适配器
- **RI 注册中心** - 跟踪和管理多个 RI 实例
- **长轮询** - 高效的实时通信
- **Web 控制台** - 基于浏览器的 RI 控制聊天界面
- **身份认证** - 基于会话的 Web UI 安全
- **健康监控** - 自动 RI 状态追踪

## 远程控制命令

| 命令 | 描述 |
|------|------|
| `/ai <prompt>` | 发送提示给 AI 助手 |
| `/sessions` | 列出终端会话 |
| `/select <n>` | 切换到会话 N |
| `/status` | 显示 RI 状态 |
| `/stop` | 发送 Ctrl+C 到当前会话 |
| `/y` / `/n` | 确认/拒绝提示 |
| `/help` | 显示命令列表 |

## 配置

### RI 配置

```json
// ~/Library/Application Support/ri/config.json (macOS)
{
  "gateway": {
    "enabled": true,
    "url": "http://localhost:8080"
  }
}
```

### Gateway 配置

通过环境变量：

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `GATEWAY_ADDR` | `:8080` | 服务器监听地址 |
| `GATEWAY_WEBUI_ENABLED` | `false` | 启用 Web UI |
| `GATEWAY_WEBUI_USERNAME` | `admin` | Web UI 用户名 |
| `GATEWAY_WEBUI_PASSWORD` | (必填) | Web UI 密码 |
| `SLACK_SIGNING_SECRET` | - | Slack 应用签名密钥 |
| `DISCORD_PUBLIC_KEY` | - | Discord 应用公钥 |
| `GATEWAY_ENCRYPTION_KEY` | - | 敏感数据加密密钥 |

或通过配置文件：

```bash
./gateway -config config.json
```

## 项目结构

```
om/
├── ri/                      # 终端会话管理器 (Electron)
│   ├── electron/           # 主进程
│   ├── src/renderer/       # React 前端
│   └── docs/               # RI 文档
├── gateway/                 # 远程控制服务器 (Go)
│   ├── cmd/gateway/        # 主入口
│   ├── internal/           # 内部包
│   │   ├── server/        # HTTP 服务器
│   │   ├── registry/      # RI 注册中心
│   │   ├── adapter/       # 平台适配器
│   │   ├── eventbus/      # 事件路由
│   │   ├── webui/         # Web UI 处理器
│   │   └── config/        # 配置
│   └── pkg/               # 公共包
│       ├── bot/           # Bot 逻辑
│       └── riclient/      # RI 客户端 SDK
├── docs/                    # 共享文档
└── scripts/                 # 构建和实用脚本
```

## 开发

### 环境要求

- Node.js v18+
- Go 1.21+
- npm 或 yarn

### 开发模式运行

```bash
# 终端 1: Gateway
cd gateway
go run ./cmd/gateway

# 终端 2: RI
cd ri
npm run dev
```

### 生产构建

```bash
# RI
cd ri
npm run build

# Gateway
cd gateway
go build -o gateway ./cmd/gateway
```

## 文档

- [RI 文档](./ri/README_CN.md)
- [Gateway 文档](./gateway/README_CN.md)
- [Gateway 集成指南](./docs/GATEWAY.md)
- [通知系统](./docs/NOTIFICATIONS.md)
- [OpenCode 插件](./docs/OPENCODE_PLUGIN.md)

## 许可证

本项目为私有项目，目前未获得公开使用许可。
