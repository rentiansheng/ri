# OM - Open Manager

> [English](#) | [中文文档](./README_CN.md)

OM is a modern developer workspace management system combining a powerful terminal session manager (RI) with a centralized control gateway. Control your development environments locally or remotely via chat platforms.

## Components

| Component | Description | Tech Stack |
|-----------|-------------|------------|
| **[RI](./ri/README.md)** | Terminal session manager with workflow automation | Electron, React, TypeScript |
| **[Gateway](./gateway/README.md)** | Centralized control server for remote access | Go |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Chat Platforms                          │
│              (Slack, Discord, Web UI, Telegram)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Gateway                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Adapters  │  │   Registry  │  │        Web UI           │ │
│  │ Slack/Discord│ │  RI Tracker │  │  Browser-based Console  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌─────────┐     ┌─────────┐     ┌─────────┐
        │  RI #1  │     │  RI #2  │     │  RI #N  │
        │ (Local) │     │ (Remote)│     │  (...)  │
        └─────────┘     └─────────┘     └─────────┘
```

## Quick Start

### RI (Local Terminal Manager)

```bash
cd ri
npm install
npm run dev
```

### Gateway (Remote Control Server)

```bash
cd gateway

# Set environment variables
export GATEWAY_WEBUI_ENABLED=true
export GATEWAY_WEBUI_PASSWORD=your-password

# Run
go run ./cmd/gateway
```

Access Web UI at `http://localhost:8080/web/login`

## Features Overview

### RI - Terminal Session Manager

- **Multiple Terminal Sessions** - Independent processes with split view support
- **Workflow Automation** - Define and run command sequences (Flow)
- **File Manager** - Browse workspace files with favorites and sorting
- **File Viewer** - VSCode-style editor with syntax highlighting
- **Notifications** - Desktop alerts, Slack/Discord webhooks
- **OpenCode Integration** - AI assistant process management
- **IME Support** - Proper CJK input method handling

### Gateway - Remote Control Server

- **Multi-Platform Support** - Slack, Discord, Web UI, custom adapters
- **RI Registry** - Track and manage multiple RI instances
- **Long-Polling** - Efficient real-time communication
- **Web Console** - Browser-based chat interface for RI control
- **Authentication** - Session-based Web UI security
- **Health Monitoring** - Automatic RI status tracking

## Remote Control Commands

| Command | Description |
|---------|-------------|
| `/ai <prompt>` | Send prompt to AI assistant |
| `/sessions` | List terminal sessions |
| `/select <n>` | Switch to session N |
| `/status` | Show RI status |
| `/stop` | Send Ctrl+C to current session |
| `/y` / `/n` | Confirm/deny prompts |
| `/help` | Show command list |

## Configuration

### RI Configuration

```json
// ~/Library/Application Support/ri/config.json (macOS)
{
  "gateway": {
    "enabled": true,
    "url": "http://localhost:8080"
  }
}
```

### Gateway Configuration

Via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_ADDR` | `:8080` | Server listen address |
| `GATEWAY_WEBUI_ENABLED` | `false` | Enable Web UI |
| `GATEWAY_WEBUI_USERNAME` | `admin` | Web UI username |
| `GATEWAY_WEBUI_PASSWORD` | (required) | Web UI password |
| `SLACK_SIGNING_SECRET` | - | Slack app signing secret |
| `DISCORD_PUBLIC_KEY` | - | Discord app public key |
| `GATEWAY_ENCRYPTION_KEY` | - | Encryption key for sensitive data |

Or via config file:

```bash
./gateway -config config.json
```

## Project Structure

```
om/
├── ri/                      # Terminal session manager (Electron)
│   ├── electron/           # Main process
│   ├── src/renderer/       # React frontend
│   └── docs/               # RI documentation
├── gateway/                 # Remote control server (Go)
│   ├── cmd/gateway/        # Main entry point
│   ├── internal/           # Internal packages
│   │   ├── server/        # HTTP server
│   │   ├── registry/      # RI registry
│   │   ├── adapter/       # Platform adapters
│   │   ├── eventbus/      # Event routing
│   │   ├── webui/         # Web UI handler
│   │   └── config/        # Configuration
│   └── pkg/               # Public packages
│       ├── bot/           # Bot logic
│       └── riclient/      # RI client SDK
├── docs/                    # Shared documentation
└── scripts/                 # Build and utility scripts
```

## Development

### Prerequisites

- Node.js v18+
- Go 1.21+
- npm or yarn

### Running in Development

```bash
# Terminal 1: Gateway
cd gateway
go run ./cmd/gateway

# Terminal 2: RI
cd ri
npm run dev
```

### Building for Production

```bash
# RI
cd ri
npm run build

# Gateway
cd gateway
go build -o gateway ./cmd/gateway
```

## Documentation

- [RI Documentation](./ri/README.md)
- [Gateway Documentation](./gateway/README.md)
- [Gateway Integration Guide](./docs/GATEWAY.md)
- [Notification System](./docs/NOTIFICATIONS.md)
- [OpenCode Plugin](./docs/OPENCODE_PLUGIN.md)

## License

This project is private and not currently licensed for public use.
