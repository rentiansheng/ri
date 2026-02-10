# Gateway

> [English](#) | [中文文档](./README_CN.md)

Gateway is a centralized control server for managing multiple RI (terminal session manager) instances. It provides a unified interface for remote terminal control via chat platforms (Slack, Discord) and a built-in Web UI.

## Features

- **Multi-Platform Support** - Adapters for Slack, Discord, and custom platforms
- **RI Registry** - Track and manage multiple RI instances with health monitoring
- **Web UI Console** - Browser-based chat interface for RI control
- **Long-Polling** - Efficient real-time communication with RI clients
- **Event Bus** - Route messages between platforms and RI instances
- **Authentication** - Session-based security for Web UI
- **Encryption** - AES encryption for sensitive configuration data

## Quick Start

### Running with Environment Variables

```bash
# Required for Web UI
export GATEWAY_WEBUI_ENABLED=true
export GATEWAY_WEBUI_PASSWORD=your-secure-password

# Optional
export GATEWAY_ADDR=:8080
export GATEWAY_WEBUI_USERNAME=admin

# Run
go run ./cmd/gateway
```

### Running with Config File

```bash
go run ./cmd/gateway -config config.json
```

Example config.json:
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

Access the Web UI at `http://localhost:8080/web/login`

### Features

- **Chat Interface** - Send commands to connected RI instances
- **RI Status Panel** - Real-time view of connected RIs with status indicators
- **Config Download** - Download configuration for RI clients
- **Command Reference** - Built-in help for available commands

### Available Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/ai <prompt>` | Send prompt to AI assistant in active session |
| `/sessions` | List all terminal sessions |
| `/select <n>` | Switch to session number N |
| `/status` | Show current RI status |
| `/stop` | Send Ctrl+C to current session |
| `/y` | Confirm (send "y" to terminal) |
| `/n` | Deny (send "n" to terminal) |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Gateway Server                        │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │  Adapters  │  │  Registry  │  │        Web UI          │ │
│  │            │  │            │  │                        │ │
│  │ - Slack    │  │ - RI List  │  │ - Login/Auth           │ │
│  │ - Discord  │  │ - Health   │  │ - Chat Interface       │ │
│  │ - Gateway  │  │ - Selection│  │ - Status Panel         │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
│         │              │                    │                │
│         └──────────────┼────────────────────┘                │
│                        │                                     │
│                 ┌──────▼──────┐                             │
│                 │  Event Bus  │                             │
│                 └──────┬──────┘                             │
├────────────────────────┼─────────────────────────────────────┤
│                 ┌──────▼──────┐                             │
│                 │ Connection  │                             │
│                 │   Manager   │                             │
│                 └──────┬──────┘                             │
└────────────────────────┼─────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   ┌─────────┐     ┌─────────┐     ┌─────────┐
   │  RI #1  │     │  RI #2  │     │  RI #N  │
   └─────────┘     └─────────┘     └─────────┘
```

## API Endpoints

### RI Client Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ri/register` | Register RI instance |
| POST | `/ri/heartbeat` | Send heartbeat |
| GET | `/ri/poll` | Long-poll for commands (25s timeout) |
| POST | `/ri/response` | Send command response |
| POST | `/ri/unregister` | Unregister RI instance |

### Platform Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/slack/events` | Slack event webhook |
| POST | `/discord/interactions` | Discord interaction webhook |

### Web UI Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/web` | Main chat interface (requires auth) |
| GET | `/web/login` | Login page |
| POST | `/web/login` | Process login |
| POST | `/web/logout` | Logout |
| POST | `/web/chat` | Send chat message |
| GET | `/web/status` | Get RI status (JSON) |
| GET | `/web/config` | Download RI config |

### Health Check

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health status |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_ADDR` | `:8080` | Server listen address |
| `GATEWAY_POLL_TIMEOUT` | `30s` | Long-poll timeout duration |
| `GATEWAY_WEBUI_ENABLED` | `false` | Enable Web UI |
| `GATEWAY_WEBUI_USERNAME` | `admin` | Web UI username |
| `GATEWAY_WEBUI_PASSWORD` | (required) | Web UI password |
| `GATEWAY_ENCRYPTION_KEY` | - | AES encryption key for sensitive data |
| `SLACK_SIGNING_SECRET` | - | Slack app signing secret for verification |
| `DISCORD_PUBLIC_KEY` | - | Discord app public key for verification |
| `REGISTRY_HEARTBEAT_INTERVAL` | `10s` | Expected heartbeat interval |
| `REGISTRY_HEARTBEAT_TIMEOUT` | `25s` | Heartbeat timeout threshold |
| `REGISTRY_STALE_TIMEOUT` | `60s` | RI considered offline after this |

## Project Structure

```
gateway/
├── cmd/
│   └── gateway/
│       └── main.go          # Main entry point
├── internal/
│   ├── server/
│   │   └── server.go        # HTTP server and routing
│   ├── registry/
│   │   └── registry.go      # RI instance registry
│   ├── connection/
│   │   └── manager.go       # Connection management
│   ├── eventbus/
│   │   └── eventbus.go      # Event routing
│   ├── adapter/
│   │   ├── adapter.go       # Adapter registry
│   │   └── platform.go      # Platform adapters
│   ├── webui/
│   │   ├── handler.go       # Web UI handlers
│   │   └── auth.go          # Authentication
│   ├── config/
│   │   └── config.go        # Configuration loading
│   ├── crypto/
│   │   └── crypto.go        # Encryption utilities
│   └── types/
│       ├── ri.go            # RI types
│       └── message.go       # Message types
└── pkg/
    ├── bot/
    │   ├── bot.go           # Bot command logic
    │   └── commands.go      # Command definitions
    └── riclient/
        └── client.go        # RI client SDK
```

## RI Client Integration

### Connecting RI to Gateway

In RI settings, enable Gateway and configure the URL:

```json
{
  "gateway": {
    "enabled": true,
    "url": "http://localhost:8080"
  }
}
```

### RI Registration Flow

1. RI sends POST `/ri/register` with instance info
2. Gateway adds RI to registry
3. RI starts heartbeat loop (POST `/ri/heartbeat` every 10s)
4. RI long-polls for commands (GET `/ri/poll`)
5. When command received, RI executes and responds (POST `/ri/response`)

### RI States

| State | Description |
|-------|-------------|
| `REGISTERED` | Just registered, awaiting first heartbeat |
| `ONLINE` | Healthy, receiving heartbeats |
| `STALE` | Missed heartbeats, may be unreachable |
| `OFFLINE` | No heartbeat for extended period |

## Security

### Web UI Authentication

- Session-based authentication with secure cookies
- Configurable username and password
- Session expiry after 24 hours

### Platform Verification

- **Slack**: Request signature verification using signing secret
- **Discord**: Ed25519 signature verification using public key

### Data Encryption

- AES-GCM encryption for sensitive configuration data
- Optional encryption key via environment or config file

## Development

### Building

```bash
go build -o gateway ./cmd/gateway
```

### Running Tests

```bash
go test ./...
```

### Running with Debug Logging

```bash
GATEWAY_DEBUG=true go run ./cmd/gateway
```

## Troubleshooting

### RI Not Connecting

1. Verify Gateway URL in RI settings
2. Check firewall allows connections to Gateway port
3. Verify Gateway is running: `curl http://localhost:8080/health`

### Web UI Login Fails

1. Verify `GATEWAY_WEBUI_ENABLED=true`
2. Verify `GATEWAY_WEBUI_PASSWORD` is set
3. Check browser console for errors

### Commands Not Reaching RI

1. Check RI status in Web UI sidebar
2. Verify RI shows as "ONLINE"
3. Check Gateway logs for errors

## License

This project is private and not currently licensed for public use.
