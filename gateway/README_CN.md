# Gateway

> [English](./README.md) | [中文文档](#)

Gateway 是一个用于管理多个 RI（终端会话管理器）实例的集中控制服务器。它通过聊天平台（Slack、Discord）和内置 Web UI 提供统一的远程终端控制接口。

## 功能特性

- **多平台支持** - Slack、Discord 和自定义平台适配器
- **RI 注册中心** - 跟踪和管理多个 RI 实例，支持健康监控
- **Web UI 控制台** - 基于浏览器的 RI 控制聊天界面
- **长轮询** - 与 RI 客户端的高效实时通信
- **事件总线** - 在平台和 RI 实例之间路由消息
- **身份认证** - Web UI 的会话安全机制
- **加密** - 敏感配置数据的 AES 加密

## 快速开始

### 使用环境变量运行

```bash
# Web UI 必需
export GATEWAY_WEBUI_ENABLED=true
export GATEWAY_WEBUI_PASSWORD=your-secure-password

# 可选
export GATEWAY_ADDR=:8080
export GATEWAY_WEBUI_USERNAME=admin

# 运行
go run ./cmd/gateway
```

### 使用配置文件运行

```bash
go run ./cmd/gateway -config config.json
```

示例 config.json：
```json
{
  "server": {
    "addr": ":8080",
    "poll_timeout": "30s"
  },
  "web_ui": {
    "enabled": true,
    "username": "admin",
    "password": "your-secure-password"
  },
  "slack": {
    "signing_secret": "your-slack-signing-secret"
  },
  "discord": {
    "public_key": "your-discord-public-key"
  },
  "security": {
    "encryption_key": "your-32-byte-encryption-key"
  }
}
```

## Web UI

访问 Web UI：`http://localhost:8080/web/login`

### 功能

- **聊天界面** - 向已连接的 RI 实例发送命令
- **RI 状态面板** - 实时查看已连接 RI 的状态指示
- **配置下载** - 下载 RI 客户端配置
- **命令参考** - 内置可用命令帮助

### 可用命令

| 命令 | 描述 |
|------|------|
| `/help` | 显示可用命令 |
| `/ai <prompt>` | 向当前会话的 AI 助手发送提示 |
| `/sessions` | 列出所有终端会话 |
| `/select <n>` | 切换到第 N 个会话 |
| `/status` | 显示当前 RI 状态 |
| `/stop` | 向当前会话发送 Ctrl+C |
| `/y` | 确认（向终端发送 "y"） |
| `/n` | 拒绝（向终端发送 "n"） |

## 架构

```
┌──────────────────────────────────────────────────────────────┐
│                        Gateway 服务器                        │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │   适配器   │  │  注册中心  │  │        Web UI          │ │
│  │            │  │            │  │                        │ │
│  │ - Slack    │  │ - RI 列表  │  │ - 登录/认证            │ │
│  │ - Discord  │  │ - 健康检查 │  │ - 聊天界面             │ │
│  │ - Gateway  │  │ - 选择管理 │  │ - 状态面板             │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
│         │              │                    │                │
│         └──────────────┼────────────────────┘                │
│                        │                                     │
│                 ┌──────▼──────┐                             │
│                 │  事件总线   │                             │
│                 └──────┬──────┘                             │
├────────────────────────┼─────────────────────────────────────┤
│                 ┌──────▼──────┐                             │
│                 │   连接      │                             │
│                 │   管理器    │                             │
│                 └──────┬──────┘                             │
└────────────────────────┼─────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   ┌─────────┐     ┌─────────┐     ┌─────────┐
   │  RI #1  │     │  RI #2  │     │  RI #N  │
   └─────────┘     └─────────┘     └─────────┘
```

## API 端点

### RI 客户端端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/ri/register` | 注册 RI 实例 |
| POST | `/ri/heartbeat` | 发送心跳 |
| GET | `/ri/poll` | 长轮询获取命令（25秒超时） |
| POST | `/ri/response` | 发送命令响应 |
| POST | `/ri/unregister` | 注销 RI 实例 |

### 平台 Webhook

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/slack/events` | Slack 事件 Webhook |
| POST | `/discord/interactions` | Discord 交互 Webhook |

### Web UI 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/web` | 主聊天界面（需认证） |
| GET | `/web/login` | 登录页面 |
| POST | `/web/login` | 处理登录 |
| POST | `/web/logout` | 登出 |
| POST | `/web/chat` | 发送聊天消息 |
| GET | `/web/status` | 获取 RI 状态（JSON） |
| GET | `/web/config` | 下载 RI 配置 |

### 健康检查

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/health` | 服务器健康状态 |

## 配置

### 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `GATEWAY_ADDR` | `:8080` | 服务器监听地址 |
| `GATEWAY_POLL_TIMEOUT` | `30s` | 长轮询超时时间 |
| `GATEWAY_WEBUI_ENABLED` | `false` | 启用 Web UI |
| `GATEWAY_WEBUI_USERNAME` | `admin` | Web UI 用户名 |
| `GATEWAY_WEBUI_PASSWORD` | (必填) | Web UI 密码 |
| `GATEWAY_ENCRYPTION_KEY` | - | 敏感数据的 AES 加密密钥 |
| `SLACK_SIGNING_SECRET` | - | Slack 应用签名密钥用于验证 |
| `DISCORD_PUBLIC_KEY` | - | Discord 应用公钥用于验证 |
| `REGISTRY_HEARTBEAT_INTERVAL` | `10s` | 预期心跳间隔 |
| `REGISTRY_HEARTBEAT_TIMEOUT` | `25s` | 心跳超时阈值 |
| `REGISTRY_STALE_TIMEOUT` | `60s` | 超过此时间视为离线 |

## 项目结构

```
gateway/
├── cmd/
│   └── gateway/
│       └── main.go          # 主入口
├── internal/
│   ├── server/
│   │   └── server.go        # HTTP 服务器和路由
│   ├── registry/
│   │   └── registry.go      # RI 实例注册中心
│   ├── connection/
│   │   └── manager.go       # 连接管理
│   ├── eventbus/
│   │   └── eventbus.go      # 事件路由
│   ├── adapter/
│   │   ├── adapter.go       # 适配器注册
│   │   └── platform.go      # 平台适配器
│   ├── webui/
│   │   ├── handler.go       # Web UI 处理器
│   │   └── auth.go          # 身份认证
│   ├── config/
│   │   └── config.go        # 配置加载
│   ├── crypto/
│   │   └── crypto.go        # 加密工具
│   └── types/
│       ├── ri.go            # RI 类型
│       └── message.go       # 消息类型
└── pkg/
    ├── bot/
    │   ├── bot.go           # Bot 命令逻辑
    │   └── commands.go      # 命令定义
    └── riclient/
        └── client.go        # RI 客户端 SDK
```

## RI 客户端集成

### 将 RI 连接到 Gateway

在 RI 设置中启用 Gateway 并配置 URL：

```json
{
  "gateway": {
    "enabled": true,
    "url": "http://localhost:8080"
  }
}
```

### RI 注册流程

1. RI 发送 POST `/ri/register` 带实例信息
2. Gateway 将 RI 添加到注册中心
3. RI 开始心跳循环（每 10 秒 POST `/ri/heartbeat`）
4. RI 长轮询获取命令（GET `/ri/poll`）
5. 收到命令后，RI 执行并响应（POST `/ri/response`）

### RI 状态

| 状态 | 描述 |
|------|------|
| `REGISTERED` | 刚注册，等待首次心跳 |
| `ONLINE` | 健康，正在接收心跳 |
| `STALE` | 心跳丢失，可能无法访问 |
| `OFFLINE` | 长时间无心跳 |

## 安全

### Web UI 身份认证

- 基于会话的认证，使用安全 Cookie
- 可配置用户名和密码
- 会话 24 小时后过期

### 平台验证

- **Slack**：使用签名密钥验证请求签名
- **Discord**：使用公钥进行 Ed25519 签名验证

### 数据加密

- 敏感配置数据的 AES-GCM 加密
- 可通过环境变量或配置文件设置加密密钥

## 开发

### 构建

```bash
go build -o gateway ./cmd/gateway
```

### 运行测试

```bash
go test ./...
```

### 启用调试日志运行

```bash
GATEWAY_DEBUG=true go run ./cmd/gateway
```

## 故障排除

### RI 无法连接

1. 验证 RI 设置中的 Gateway URL
2. 检查防火墙是否允许连接到 Gateway 端口
3. 验证 Gateway 正在运行：`curl http://localhost:8080/health`

### Web UI 登录失败

1. 验证 `GATEWAY_WEBUI_ENABLED=true`
2. 验证 `GATEWAY_WEBUI_PASSWORD` 已设置
3. 检查浏览器控制台错误

### 命令无法到达 RI

1. 在 Web UI 侧边栏检查 RI 状态
2. 验证 RI 显示为 "ONLINE"
3. 检查 Gateway 日志中的错误

## 许可证

本项目为私有项目，目前未获得公开使用许可。
