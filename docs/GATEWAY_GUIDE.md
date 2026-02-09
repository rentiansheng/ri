# Gateway / RI Bot 系统使用指南

## 概述

本系统实现了一个 **Bot → Gateway → RI（Remote Instance）** 的通用架构，用于解决第三方 Bot（Slack / Discord）无法直接访问内网 PC 程序的问题。

### 核心原则

- Gateway 作为 **唯一公网入口**
- RI（运行在 PC / 私网）**不暴露任何公网端口**
- RI 主动与 Gateway 建立连接（HTTP Long Polling）
- Gateway 不承载业务逻辑，仅作为 **事件总线 + 路由中枢**

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        公网                                  │
│  ┌──────────┐    ┌──────────┐                               │
│  │ Slack Bot│    │Discord Bot│                              │
│  └────┬─────┘    └────┬─────┘                               │
│       │               │                                      │
│       └───────┬───────┘                                      │
│               ▼                                              │
│       ┌───────────────┐                                      │
│       │   Gateway     │                                      │
│       │  (Go Server)  │                                      │
│       └───────┬───────┘                                      │
└───────────────┼──────────────────────────────────────────────┘
                │ HTTP Long Polling (RI 主动连接)
┌───────────────┼──────────────────────────────────────────────┐
│               ▼                        私网 / PC             │
│       ┌───────────────┐                                      │
│       │      RI       │                                      │
│       │ (业务处理端)   │                                      │
│       └───────────────┘                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. Gateway 配置与启动

### 1.1 环境变量配置

```bash
# Gateway 监听地址
export GATEWAY_ADDR=":8080"

# Long Polling 超时时间
export GATEWAY_POLL_TIMEOUT="30s"

# Slack 签名密钥（用于验证 Webhook）
export SLACK_SIGNING_SECRET="your-slack-signing-secret"

# Discord 公钥（用于验证 Webhook）
export DISCORD_PUBLIC_KEY="your-discord-public-key"

# 健康检查参数
export REGISTRY_HEARTBEAT_INTERVAL="10s"
export REGISTRY_HEARTBEAT_TIMEOUT="25s"
export REGISTRY_STALE_TIMEOUT="60s"
```

### 1.2 配置文件方式

创建 `gateway-config.json`：

```json
{
  "server": {
    "addr": ":8080",
    "poll_timeout": 30000000000
  },
  "slack": {
    "signing_secret": "your-slack-signing-secret"
  },
  "discord": {
    "public_key": "your-discord-public-key"
  },
  "registry": {
    "heartbeat_interval": 10000000000,
    "heartbeat_timeout": 25000000000,
    "stale_timeout": 60000000000
  }
}
```

> 注意：时间单位为纳秒（1秒 = 1000000000 纳秒）

### 1.3 构建与启动

```bash
# 构建
cd /path/to/om
go build -o bin/gateway ./gateway/cmd/gateway

# 使用环境变量启动
./bin/gateway

# 或使用配置文件启动
./bin/gateway -config gateway-config.json
```

### 1.4 验证 Gateway 运行

```bash
# 检查健康状态
curl http://localhost:8080/health

# 响应示例
{
  "status": "ok",
  "ri_count": 0,
  "inflight": 0,
  "timestamp": 1707472890
}
```

---

## 2. Gateway API 端点

| 端点 | 方法 | 描述 | 调用方 |
|------|------|------|--------|
| `/ri/register` | POST | RI 注册 | RI |
| `/ri/poll` | GET | Long Polling 获取事件 | RI |
| `/ri/response` | POST | RI 返回事件响应 | RI |
| `/ri/heartbeat` | POST | RI 心跳上报 | RI |
| `/ri/list` | GET | 列出所有注册的 RI | 管理 |
| `/webhook/slack` | POST | Slack Webhook 入口 | Slack |
| `/webhook/discord` | POST | Discord Webhook 入口 | Discord |
| `/health` | GET | 健康检查 | 监控 |

---

## 3. RI 客户端实现指南

RI 需要实现以下功能：

### 3.1 注册到 Gateway

```bash
# 请求
POST /ri/register
Content-Type: application/json

{
  "ri_id": "my-pc-001",
  "version": "1.0.0",
  "capabilities": ["slack.message", "discord.command"],
  "max_concurrency": 4,
  "labels": {
    "os": "mac",
    "env": "personal"
  }
}

# 响应
{
  "ri_id": "my-pc-001",
  "version": "1.0.0",
  "capabilities": ["slack.message", "discord.command"],
  "max_concurrency": 4,
  "state": "REGISTERED",
  "last_heartbeat": "2024-02-09T10:00:00Z",
  "connected_at": "2024-02-09T10:00:00Z"
}
```

**capabilities 说明**：
- 格式：`{platform}.{event_type}`
- 示例：`slack.message`、`slack.app_mention`、`discord.application_command`
- Gateway 根据 capabilities 路由事件到对应的 RI

### 3.2 Long Polling 获取事件

```bash
# 请求
GET /ri/poll
X-RI-ID: my-pc-001

# 响应（有事件时）
{
  "events": [
    {
      "type": "event",
      "id": "evt-uuid-123",
      "timestamp": 1707472890,
      "payload": {
        "session_id": "evt-uuid-123",
        "platform": "slack",
        "event_type": "message",
        "data": {
          "text": "hello",
          "user": "U12345",
          "channel": "C12345"
        }
      }
    }
  ]
}

# 响应（无事件，超时返回）
{
  "events": []
}
```

### 3.3 返回事件响应

```bash
# 请求
POST /ri/response
X-RI-ID: my-pc-001
Content-Type: application/json

{
  "type": "response",
  "id": "evt-uuid-123",
  "timestamp": 1707472895,
  "payload": {
    "platform": "slack",
    "response_url": "https://hooks.slack.com/actions/xxx",
    "body": {
      "text": "收到消息，已处理完成！"
    }
  }
}
```

### 3.4 心跳上报

```bash
# 请求（建议每 10 秒发送一次）
POST /ri/heartbeat
X-RI-ID: my-pc-001
Content-Type: application/json

{
  "status": "ok",
  "load": 0.3,
  "inflight": 2
}
```

**status 取值**：
- `ok`：正常运行
- `degraded`：性能下降或部分功能受限

---

## 4. RI 客户端示例代码

### 4.1 TypeScript/Node.js 示例

```typescript
import axios from 'axios';

const GATEWAY_URL = 'http://your-gateway-server:8080';
const RI_ID = 'my-pc-001';

interface Event {
  type: string;
  id: string;
  timestamp: number;
  payload: {
    session_id: string;
    platform: string;
    event_type: string;
    data: Record<string, any>;
  };
}

class RIClient {
  private running = false;

  async register() {
    const response = await axios.post(`${GATEWAY_URL}/ri/register`, {
      ri_id: RI_ID,
      version: '1.0.0',
      capabilities: ['slack.message', 'slack.app_mention'],
      max_concurrency: 4,
      labels: { env: 'development' }
    });
    console.log('注册成功:', response.data);
  }

  async startPolling() {
    this.running = true;
    
    while (this.running) {
      try {
        const response = await axios.get(`${GATEWAY_URL}/ri/poll`, {
          headers: { 'X-RI-ID': RI_ID },
          timeout: 35000
        });

        const events: Event[] = response.data.events || [];
        
        for (const event of events) {
          await this.handleEvent(event);
        }
      } catch (error) {
        console.error('Poll 错误:', error);
        await this.sleep(1000);
      }
    }
  }

  async handleEvent(event: Event) {
    console.log('收到事件:', event.id, event.payload.event_type);

    // 处理业务逻辑
    const result = await this.processEvent(event);

    // 返回响应
    await axios.post(`${GATEWAY_URL}/ri/response`, {
      type: 'response',
      id: event.id,
      timestamp: Date.now(),
      payload: {
        platform: event.payload.platform,
        body: result
      }
    }, {
      headers: { 'X-RI-ID': RI_ID }
    });
  }

  async processEvent(event: Event): Promise<Record<string, any>> {
    // 在这里实现你的业务逻辑
    const text = event.payload.data.text || '';
    return { text: `收到消息: ${text}` };
  }

  startHeartbeat() {
    setInterval(async () => {
      try {
        await axios.post(`${GATEWAY_URL}/ri/heartbeat`, {
          status: 'ok',
          load: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
          inflight: 0
        }, {
          headers: { 'X-RI-ID': RI_ID }
        });
      } catch (error) {
        console.error('心跳失败:', error);
      }
    }, 10000);
  }

  stop() {
    this.running = false;
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 启动
async function main() {
  const client = new RIClient();
  await client.register();
  client.startHeartbeat();
  await client.startPolling();
}

main().catch(console.error);
```

### 4.2 Go 示例

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	GatewayURL = "http://your-gateway-server:8080"
	RIID       = "my-pc-001"
)

type Envelope struct {
	Type      string          `json:"type"`
	ID        string          `json:"id"`
	Timestamp int64           `json:"timestamp"`
	Payload   json.RawMessage `json:"payload"`
}

type EventPayload struct {
	SessionID string                 `json:"session_id"`
	Platform  string                 `json:"platform"`
	EventType string                 `json:"event_type"`
	Data      map[string]interface{} `json:"data"`
}

type RIClient struct {
	httpClient *http.Client
}

func NewRIClient() *RIClient {
	return &RIClient{
		httpClient: &http.Client{Timeout: 35 * time.Second},
	}
}

func (c *RIClient) Register() error {
	body := map[string]interface{}{
		"ri_id":           RIID,
		"version":         "1.0.0",
		"capabilities":    []string{"slack.message"},
		"max_concurrency": 4,
	}

	data, _ := json.Marshal(body)
	resp, err := c.httpClient.Post(GatewayURL+"/ri/register", "application/json", bytes.NewReader(data))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	fmt.Println("注册成功")
	return nil
}

func (c *RIClient) Poll() ([]Envelope, error) {
	req, _ := http.NewRequest("GET", GatewayURL+"/ri/poll", nil)
	req.Header.Set("X-RI-ID", RIID)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Events []Envelope `json:"events"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Events, nil
}

func (c *RIClient) SendResponse(eventID string, body map[string]interface{}) error {
	payload, _ := json.Marshal(map[string]interface{}{
		"platform": "slack",
		"body":     body,
	})

	envelope := map[string]interface{}{
		"type":      "response",
		"id":        eventID,
		"timestamp": time.Now().Unix(),
		"payload":   json.RawMessage(payload),
	}

	data, _ := json.Marshal(envelope)
	req, _ := http.NewRequest("POST", GatewayURL+"/ri/response", bytes.NewReader(data))
	req.Header.Set("X-RI-ID", RIID)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

func (c *RIClient) Heartbeat() {
	ticker := time.NewTicker(10 * time.Second)
	for range ticker.C {
		body := map[string]interface{}{
			"status":   "ok",
			"load":     0.3,
			"inflight": 0,
		}
		data, _ := json.Marshal(body)

		req, _ := http.NewRequest("POST", GatewayURL+"/ri/heartbeat", bytes.NewReader(data))
		req.Header.Set("X-RI-ID", RIID)
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			fmt.Println("心跳失败:", err)
			continue
		}
		resp.Body.Close()
	}
}

func main() {
	client := NewRIClient()

	if err := client.Register(); err != nil {
		panic(err)
	}

	go client.Heartbeat()

	for {
		events, err := client.Poll()
		if err != nil {
			fmt.Println("Poll 错误:", err)
			time.Sleep(time.Second)
			continue
		}

		for _, event := range events {
			fmt.Printf("收到事件: %s\n", event.ID)

			var payload EventPayload
			json.Unmarshal(event.Payload, &payload)

			// 处理业务逻辑
			response := map[string]interface{}{
				"text": fmt.Sprintf("收到: %v", payload.Data["text"]),
			}

			client.SendResponse(event.ID, response)
		}
	}
}
```

---

## 5. Slack Bot 配置

### 5.1 创建 Slack App

1. 访问 https://api.slack.com/apps
2. 点击 "Create New App" → "From scratch"
3. 输入 App 名称，选择 Workspace

### 5.2 配置 Event Subscriptions

1. 进入 "Event Subscriptions"
2. 开启 "Enable Events"
3. 设置 Request URL: `https://your-gateway-domain/webhook/slack`
4. 订阅事件：
   - `message.channels`
   - `message.groups`
   - `message.im`
   - `app_mention`

### 5.3 获取 Signing Secret

1. 进入 "Basic Information"
2. 复制 "Signing Secret"
3. 配置到 Gateway 的 `SLACK_SIGNING_SECRET` 环境变量

### 5.4 安装 App 到 Workspace

1. 进入 "OAuth & Permissions"
2. 添加必要的 Scopes：
   - `chat:write`
   - `channels:history`
   - `groups:history`
   - `im:history`
3. 点击 "Install to Workspace"

---

## 6. Discord Bot 配置

### 6.1 创建 Discord Application

1. 访问 https://discord.com/developers/applications
2. 点击 "New Application"
3. 输入名称，创建应用

### 6.2 配置 Bot

1. 进入 "Bot" 页面
2. 点击 "Add Bot"
3. 复制 Token（用于 RI 客户端发送消息）

### 6.3 配置 Interactions Endpoint

1. 进入 "General Information"
2. 复制 "Public Key"，配置到 Gateway 的 `DISCORD_PUBLIC_KEY`
3. 设置 "Interactions Endpoint URL": `https://your-gateway-domain/webhook/discord`

### 6.4 邀请 Bot 到服务器

生成邀请链接：
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2048&scope=bot%20applications.commands
```

---

## 7. RI 状态机

### Gateway 视角的 RI 状态

```
OFFLINE → REGISTERED → ONLINE → STALE → OFFLINE
                         ↑        │
                         └────────┘
```

| 状态 | 描述 | 触发条件 |
|------|------|----------|
| OFFLINE | 离线 | 初始状态 / 超过 stale_timeout 无心跳 |
| REGISTERED | 已注册 | 调用 /ri/register 成功 |
| ONLINE | 在线 | 收到状态为 "ok" 的心跳 |
| STALE | 不稳定 | 超过 heartbeat_timeout 无心跳 / 心跳状态为 "degraded" |

---

## 8. 断线重连策略

RI 客户端应实现指数退避重连：

```
重试间隔: 1s → 2s → 4s → 8s → 16s → 30s (最大)
```

- 连接成功后重置退避时间
- 收到 401/403 错误时终止重连（配置错误）

---

## 9. 安全建议

1. **Gateway 部署在公网**：配置 HTTPS（使用 nginx 或 caddy 反代）
2. **验证签名**：务必配置 Slack/Discord 的签名验证
3. **RI 认证**：生产环境建议在 /ri/register 添加 Token 验证
4. **网络隔离**：RI 不应暴露任何公网端口
5. **日志脱敏**：避免记录敏感信息

---

## 10. 常见问题

### Q: Poll 请求超时怎么办？

A: 这是正常行为。Long Polling 会等待事件到达或超时返回空数组。RI 应立即发起下一次 Poll。

### Q: RI 重启后需要重新注册吗？

A: 是的。RI 每次启动都需要调用 /ri/register。Gateway 会自动清理旧连接。

### Q: 如何支持多个 RI？

A: Gateway 支持多 RI 注册。事件会根据 capabilities 和负载均衡路由到合适的 RI。

### Q: 心跳失败会怎样？

A: 超过 heartbeat_timeout（默认25秒）后，RI 状态变为 STALE，新事件不会路由到该 RI。超过 stale_timeout（默认60秒）后，RI 被标记为 OFFLINE 并清理连接。

---

## 11. 监控与运维

### 查看已注册的 RI

```bash
curl http://localhost:8080/ri/list
```

### 健康检查

```bash
curl http://localhost:8080/health
```

### 日志

Gateway 使用标准 log 包输出日志，可通过重定向或日志收集工具管理：

```bash
./bin/gateway 2>&1 | tee gateway.log
```

---

## 12. RI (Electron App) 配置

RI 桌面应用内置了 Gateway 客户端，只需在配置文件中启用即可。

### 12.1 配置文件位置

- **macOS**: `~/Library/Application Support/RI/config.json`
- **Windows**: `%APPDATA%\RI\config.json`
- **Linux**: `~/.config/RI/config.json`

### 12.2 Gateway 配置项

在 `config.json` 中添加或修改 `gateway` 配置：

```json
{
  "gateway": {
    "enabled": true,
    "url": "http://your-gateway-server:8080",
    "riID": "my-desktop-001",
    "pollTimeout": 30000,
    "heartbeatInterval": 10000,
    "reconnectInterval": 1000,
    "maxReconnectDelay": 30000
  }
}
```

| 配置项 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| `enabled` | boolean | `false` | 是否启用 Gateway 连接 |
| `url` | string | `http://localhost:8080` | Gateway 服务器地址 |
| `riID` | string | 自动生成 | RI 唯一标识（建议手动设置） |
| `pollTimeout` | number | `30000` | Long Polling 超时（毫秒） |
| `heartbeatInterval` | number | `10000` | 心跳间隔（毫秒） |
| `reconnectInterval` | number | `1000` | 初始重连间隔（毫秒） |
| `maxReconnectDelay` | number | `30000` | 最大重连间隔（毫秒） |

### 12.3 启动 RI

1. 启动 Gateway 服务器
2. 在 RI 配置中设置 `gateway.enabled = true` 和 `gateway.url`
3. 启动 RI 桌面应用
4. RI 会自动连接到 Gateway

### 12.4 验证连接

```bash
# 在 Gateway 服务器检查已注册的 RI
curl http://localhost:8080/ri/list

# 响应示例
[
  {
    "ri_id": "my-desktop-001",
    "version": "1.0.0",
    "capabilities": ["chat", "command", "terminal"],
    "max_concurrency": 10,
    "state": "ONLINE",
    "last_heartbeat": "2024-02-09T16:30:00Z",
    "load": 0.1,
    "inflight": 0
  }
]
```

### 12.5 支持的命令

通过 Slack/Discord 发送以下命令控制 RI：

| 命令 | 描述 |
|------|------|
| `/ai <prompt>` | 发送 prompt 到当前 terminal 会话 |
| `/sessions` | 列出所有 terminal 会话 |
| `/select <n>` | 切换到第 n 个会话 |
| `/status` | 显示连接状态 |
| `/stop` | 发送 Ctrl+C 中断当前进程 |
| `/y` 或 `/n` | 发送确认/取消 |
| `/help` | 显示帮助信息 |

---

## 13. 内置 Bot 使用

Gateway 自带一个 Bot 实现，可用于测试或作为独立的 Bot 服务。

### 13.1 构建和启动

```bash
# 构建
cd /path/to/om
go build -o bin/bot ./gateway/cmd/bot

# 启动（连接到本地 Gateway）
./bin/bot -gateway http://localhost:8080 -id test-bot

# 启动交互模式（用于测试）
./bin/bot -gateway http://localhost:8080 -id test-bot -interactive
```

### 13.2 命令行参数

| 参数 | 默认值 | 描述 |
|------|--------|------|
| `-gateway` | `http://localhost:8080` | Gateway URL |
| `-id` | `ri-bot` | Bot ID |
| `-name` | `RI Bot` | Bot 显示名称 |
| `-prefix` | `/` | 命令前缀 |
| `-interactive` | `false` | 启用交互模式 |

### 13.3 交互模式

交互模式下可以直接发送模拟消息进行测试：

```
> /health          # 检查 Gateway 健康状态
> /list            # 列出已连接的 RI
> /ping            # 测试 Bot 响应
> /quit            # 退出
```

### 13.4 编程使用

```go
package main

import (
    "context"
    "om/gateway/pkg/bot"
    "om/gateway/pkg/riclient"
)

func main() {
    cfg := bot.Config{
        RIClient: riclient.Config{
            GatewayURL: "http://localhost:8080",
            RIID:       "my-bot",
        },
        CommandPrefix: "/",
    }

    b := bot.New(cfg)
    bot.RegisterBuiltinCommands(b)

    // 注册自定义命令
    b.RegisterCommand("hello", func(ctx context.Context, cmd *bot.Command) (*bot.Response, error) {
        return &bot.Response{Text: "Hello, World!"}, nil
    })

    b.Start(context.Background())
    defer b.Stop()

    // 保持运行
    select {}
}
```
