# RI

> [English](#) | [中文文档](./README_CN.md)

A modern terminal session manager built with Electron, React, and TypeScript. Organize your development workflows with multiple terminal sessions, command history tracking, workflow automation, and an intuitive unified interface.

A modern terminal session manager built with Electron, React, and TypeScript. Organize your development workflows with multiple terminal sessions, command history tracking, workflow automation, and an intuitive unified interface.

## Features

### Core Features
- **Multiple Terminal Sessions**: Create and manage multiple terminal sessions with independent processes
- **Unified Tab System**: All content (terminals, history, flows, settings) displayed in a single tab bar
  - Terminal tabs: Session name (e.g., "Session 1")
  - Flow tabs: `⚡ Flow Name` prefix
  - History tabs: `[H]: Session name` prefix
  - Settings tabs: `[S]: Settings` prefix
- **Robust Process Management**: Automatically cleans up all child processes when a session is closed
- **Session Persistence**: Sessions remain alive even when tabs are closed
- **Drag-and-Drop Tabs**: Reorder tabs by dragging them to your preferred position

### Navigation & Views
- **Icon Sidebar**: Quick access to different views
  - ⚡ Sessions - Manage terminal sessions
  - 📁 Files - Browse workspace files
  - 📜 History - View command history per session
  - 🔔 Notify - Monitor terminal notifications
  - 🔧 Flow - Workflow automation
  - ⚙ Settings - Application configuration
- **Collapsible Navigation Panel**: Context-aware left panel for session/history/flow lists
- **Master-Detail Layout**: List navigation on left, detailed content on right

### Terminal Features
- **Full xterm.js terminal emulation** with auto-fit sizing
- **Split Terminal Support**: Horizontal and vertical splits within a session
- **Command history preservation** with session log tracking
- **Color output support** and proper ANSI sequence handling
- **Auto-naming**: First command automatically names the session
- **AI Tool Detection**: Monitor AI assistant usage (OpenCode, Copilot, Aider, Cursor, Cline)
- **Safe Deletion**: Context-menu style confirmation for deleting sessions
- **IME Support**: Proper handling of input method editors (Chinese, Japanese, Korean)
  - Enter key respects IME composing state
  - Backspace respects IME composition state
- **Click-to-Activate**: Click anywhere on split terminal (including text content) to activate it

### Workflow Automation (Flow)

Automate your development workflows with the Flow feature:

- **Tree Structure**: Organize workflows in folders and subfolders
- **Visual Editor**: Edit workflow commands with line numbers
- **Auto-Add Lines**: New line automatically added when typing in the last row
- **One-Click Run**: Execute all workflow commands in a new session
- **Right-Click Menu**: Quick actions for create, rename, and delete
- **Collapsible Folders**: Keep your workflow list organized
- **Scheduled Execution**: Run flows on a cron schedule

**Flow Features:**
- 📁 **Folder Organization**: Group related workflows together
- ⚡ **Quick Execution**: Double-click to run a workflow
- ✏️ **Inline Rename**: Edit names directly in the tree
- 🔄 **Command Editor**: Full-featured command sequence editor with auto-add
- 💾 **Auto-Save**: Changes persist automatically

### History & Logging
- **Session Logs**: Automatic command history recording per session
- **Statistics**: Track record count, file size, and last activity time
- **History Viewer**: Browse past commands with timestamps
- **Log Management**: Clear individual session history when needed

### File Manager

Workspace file browser with powerful features:

- **Multi-Mode View**: Switch between Current session, Open Tabs, or All sessions
- **Directory Navigation**: Expand/collapse directories with lazy loading
- **Favorites**: Pin frequently used directories (persisted across sessions)
- **Sorting Options**: Sort by name, size, modified time, or created time
- **Hidden Files Toggle**: Global setting with per-directory override
- **Context Menu**: Right-click for quick actions
- **Horizontal Scroll**: Navigate deep directory structures easily
- **File Details**: View file size and modification time

**File Manager Features:**
| Feature | Description |
|---------|-------------|
| **View Modes** | Current (active session), Tabs (open tabs), All (all sessions) |
| **Favorites** | ⭐ Pin directories for quick access, always visible |
| **Sort By** | Name, Size, Modified time, Created time (ascending/descending) |
| **Hidden Files** | Global toggle in Settings, per-directory override via right-click |
| **Directory Tree** | Expand/collapse with file icons based on type |
| **File Info** | Size and modification time displayed inline |

**Context Menu Actions:**
- Add/Remove from Favorites
- Show/Hide Hidden Files (per-directory)
- Collapse All subdirectories
- Sort options submenu

### File Viewer (RIView)

VSCode-style file editor with powerful features:

- **Toolbar Actions**: Save (💾), Format (📐), Validate (✓), Toggle Preview (👁️)
- **Format Support**: JSON, YAML, XML validation and auto-formatting
- **Markdown Preview**: Side-by-side split view with draggable resizer
- **Tree View**: Collapsible JSON/YAML tree structure viewer
- **Syntax Highlighting**: Prism.js-powered highlighting for multiple languages
- **Search**: Find text within files with result navigation
- **Status Bar**: Line count, encoding, language indicator

**Toolbar buttons:**
| Button | Function | File Types |
|--------|----------|------------|
| 💾 | Save file (Cmd+S / Ctrl+S) | All files |
| 📐 | Format/prettify code | JSON, YAML, XML |
| ✓ | Validate syntax | JSON, YAML, XML |
| 👁️ | Toggle split preview | Markdown |
| 🌳 | Toggle tree view | JSON, YAML |
| 🔍 | Search file content | All files |

| Feature | JSON | YAML | XML | Markdown |
|---------|------|------|-----|----------|
| Syntax Highlighting | ✓ | ✓ | ✓ | ✓ |
| Format/Prettify | ✓ | ✓ | ✓ | - |
| Validation | ✓ | ✓ | ✓ | - |
| Tree View | ✓ | ✓ | - | - |
| Live Preview | - | - | - | ✓ (Split) |

### Notifications
- **Real-time Alerts**: Desktop notifications for important terminal events
- **Activity Monitoring**: Track session activity and command completion
- **Unread Counts**: Badge indicators for new notifications
- **Grouped Display**: Notifications organized by session
- **Magic Strings**: Support for terminal-triggered notifications
- **External Channels**: Slack, Discord, Telegram, DingTalk, WeCom webhooks

### Remote Control

Control RI terminals remotely via chat platforms:

- **Gateway Integration**: Connect to Gateway server for centralized control
- **Discord/Slack Bots**: Send commands via chat messages
- **Web UI**: Browser-based chat interface at Gateway `/web`
- **Commands**: `/ai`, `/sessions`, `/select`, `/status`, `/stop`, `/y`, `/n`, `/help`

### OpenCode Integration
- **Auto-Start**: Automatically launch OpenCode server and web interface
- **Process Management**: Independent control of server and web processes
- **Status Monitoring**: Real-time PIDs, port numbers, and process state
- **Log Streaming**: Live logs for debugging and monitoring
- **RI Notification Plugin**: One-click installation for seamless integration

## Tech Stack

- **Frontend**: React 18, TypeScript
- **Desktop**: Electron 30
- **State Management**: Zustand (unified tab system)
- **Terminal**: xterm.js 5.2.0 with xterm-addon-fit, WebGL addon
- **Build Tool**: Vite 5
- **Process Management**: node-pty
- **Styling**: CSS with VSCode-inspired dark theme

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Installation

```bash
# Install dependencies
npm install
```

## Development

```bash
# Start development server with hot reload
npm run dev
```

This command will:
1. Start Vite dev server on http://127.0.0.1:5173
2. Wait for the server to be ready
3. Launch Electron in development mode

## Build

```bash
# Build for production
npm run build
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development environment with hot reload |
| `npm run build` | Build the application for production |
| `npm start` | Start the Electron app (production mode) |
| `npm run lint` | Run ESLint to check code quality |

## Project Structure

```
ri/
├── electron/                    # Electron main process files
│   ├── main.cjs                # Main process entry point
│   ├── preload.cjs             # Preload script for IPC
│   ├── terminalManager.cjs     # Terminal process management
│   ├── sessionLogger.cjs       # Command history logging
│   ├── configManager.cjs       # Configuration management
│   ├── notificationManager.cjs # Desktop notifications
│   ├── flowManager.cjs         # Workflow management
│   ├── gatewayClient.cjs       # Gateway connection client
│   ├── remoteControlManager.cjs # Remote control handling
│   ├── opencodeManager.cjs     # OpenCode process management
│   └── opencodePlugin.cjs      # OpenCode plugin manager
├── src/
│   └── renderer/               # React renderer process
│       ├── components/         # React components
│       │   ├── Sidebar.tsx           # Icon sidebar navigation
│       │   ├── TabBar.tsx            # Unified tab bar
│       │   ├── Terminal.tsx          # xterm.js terminal
│       │   ├── FlowList.tsx          # Workflow tree navigation
│       │   ├── FlowEditor.tsx        # Workflow command editor
│       │   ├── FlowView.tsx          # Flow main view
│       │   ├── FileManager.tsx       # Workspace file browser
│       │   ├── RIView.tsx            # VSCode-style file viewer/editor
│       │   ├── SessionList.tsx       # Session navigation list
│       │   ├── HistoryList.tsx       # History session list
│       │   ├── SettingsView.tsx      # Settings container
│       │   └── Settings/             # Settings components
│       ├── store/              # Zustand state management
│       │   ├── terminalStore.ts      # Terminal/session state
│       │   ├── xtermStore.ts         # xterm.js instances
│       │   ├── configStore.ts        # Configuration state
│       │   ├── notifyStore.ts        # Notifications state
│       │   └── uiEditStore.ts        # UI editing state
│       ├── contexts/           # React contexts
│       └── styles/             # CSS stylesheets
├── docs/                        # Documentation
│   ├── GATEWAY.md              # Gateway integration guide
│   ├── NOTIFICATIONS.md        # Notification system details
│   ├── NOTIFICATION_API.md     # Terminal notification protocol
│   └── OPENCODE_PLUGIN.md      # OpenCode plugin guide
└── package.json
```

## Usage Guide

### Creating a Terminal Session

1. Click the `+` button in the Sessions list
2. A new terminal session will be created with a default name
3. A terminal tab will automatically open in the tab bar
4. The first command you type will rename the session automatically

### Managing Terminal Sessions

| Action | How To |
|--------|--------|
| **Create** | Click `+` button in Sessions list |
| **Switch** | Click on session in list or tab |
| **Rename** | Double-click session name |
| **Delete** | Click trash icon (🗑) with confirmation |
| **Split** | Right-click → Split Horizontally/Vertically, or Cmd+D / Cmd+Shift+D |

**Session Indicators:**
- ● (solid circle) = Session tab is open
- ○ (hollow circle) = Session exists but tab is closed

### Using Workflows (Flow)

The Flow feature lets you define reusable command sequences:

#### Creating a Workflow

1. Click the ⚡ Flow icon in the sidebar
2. Click the `+` button or right-click → "New Flow"
3. Enter a name for your workflow
4. Click on the flow to open the editor
5. Add commands one per line
6. Click "Save" or press `Ctrl+S` / `Cmd+S`

#### Organizing Workflows

- **Create Folder**: Right-click → "New Folder"
- **Move Items**: Drag and drop to reorganize
- **Rename**: Right-click → "Rename" or click and edit
- **Delete**: Right-click → "Delete"

#### Running a Workflow

- **Double-click** on a flow to run it immediately
- **Click "▶ Run"** button in the Flow Editor
- Commands execute in sequence in a new terminal session

#### Flow Editor Features

| Feature | Description |
|---------|-------------|
| **Line Numbers** | Visual reference for command order |
| **Auto-Add Line** | New line added automatically when typing in last row |
| **Add Command** | Press Enter or click `+` to insert line anywhere |
| **Remove Command** | Press Backspace on empty line or click `×` |
| **Reorder** | Use ↑↓ buttons or drag and drop |
| **Working Directory** | Set `cwd` for command execution |
| **Keyboard Shortcuts** | `Ctrl+S`/`Cmd+S` to save |

### Settings

Access settings via the ⚙ icon:

| Tab | Options |
|-----|---------|
| **Notification** | Desktop alerts, themes, external integrations (Slack, Discord, etc.) |
| **OpenCode** | Auto-start, plugin management |
| **Remote Control** | Discord/Slack/Gateway bot integration for remote terminal control |
| **Terminal** | Font family, colors, cursor, scrollback (supports k unit: 1k, 1.5k, 10k) |
| **Editor** | Auto-save settings |
| **Files View** | Show/hide hidden files globally |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` / `Cmd+T` | New terminal session |
| `Ctrl+W` / `Cmd+W` | Close current tab |
| `Ctrl+Tab` | Switch to next tab |
| `Ctrl+Shift+Tab` | Switch to previous tab |
| `Ctrl+S` / `Cmd+S` | Save (in editors) |
| `Ctrl+,` / `Cmd+,` | Open settings |
| `Cmd+D` | Split terminal vertically |
| `Cmd+Shift+D` | Split terminal horizontally |
| `Cmd+F` / `Ctrl+F` | Search in terminal |
| `Cmd+K` / `Ctrl+L` | Clear terminal |
| `Cmd+1-9` / `Ctrl+1-9` | Switch to tab by index |
| `Cmd+Option+1-9` / `Ctrl+Alt+1-9` | Switch to terminal by index (within split session) |
| `Cmd+Option+Tab` / `Ctrl+Alt+Tab` | Cycle through terminals (within split session) |

## Troubleshooting

### Terminal Black Screen

**Issue**: Terminal shows black screen after switching tabs
- **Cause**: xterm.js DOM detachment
- **Fix**: Close and reopen the tab, or switch views

### IME Issues

**Issue**: Chinese/Japanese/Korean input not working correctly
- **Fix**: Ensure you're clicking inside the terminal area to focus
- Enter key now properly respects IME composing state

### Residual Processes

**Issue**: Processes still running after RI closes
- **Fix**: Run `./cleanup-processes.sh`
- **Prevention**: Always close RI properly (don't force quit)

### Flow Not Saving

**Issue**: Workflow changes not persisting
- **Fix**: Ensure you click "Save" or press `Ctrl+S`
- **Check**: Verify config file permissions

## Configuration

Configuration is stored in:
- macOS: `~/Library/Application Support/ri/config.json`
- Linux: `~/.config/ri/config.json`
- Windows: `%APPDATA%/ri/config.json`

## License

This project is private and not currently licensed for public use.
