# RI

> [English](#) | [中文文档](./README_CN.md)

A modern terminal session manager built with Electron, React, and TypeScript. Organize your development workflows with multiple terminal sessions, command history tracking, notifications, and an intuitive unified interface.

## Features

### Core Features
- **Multiple Terminal Sessions**: Create and manage multiple terminal sessions with independent processes
- **Unified Tab System**: All content (terminals, history, settings) displayed in a single tab bar with type prefixes
  - Terminal tabs: Session name (e.g., "Session 1")
  - History tabs: `[H]: Session name` prefix
  - Settings tabs: `[S]: Settings` prefix
- **Robust Process Management**: Automatically cleans up all child processes (process groups) when a session is closed or the app exits. No more zombie processes.
- **Session Persistence**: Sessions remain alive even when tabs are closed
- **Drag-and-Drop Tabs**: Reorder tabs by dragging them to your preferred position

### Navigation & Views
- **Icon Sidebar**: Quick access to different views
  - ⚡ Sessions - Manage terminal sessions
  - 📜 History - View command history per session
  - 🔔 Notify - Monitor terminal notifications
  - ⚙️ Flow - Workflow automation
  - ⚙ Settings - Application configuration
- **Collapsible Navigation Panel**: Context-aware left panel for session/history lists
- **Master-Detail Layout**: List navigation on left, detailed content on right

### Terminal Features
- **Full xterm.js terminal emulation** with auto-fit sizing
- **Command history preservation** with session log tracking
- **Color output support** and proper ANSI sequence handling
- **Auto-naming**: First command automatically names the session
- **AI Tool Detection**: Monitor AI assistant usage (OpenCode, Copilot, Aider, Cursor, Cline)
- **Safe Deletion**: Context-menu style confirmation for deleting sessions to prevent accidental data loss.

### History & Logging
- **Session Logs**: Automatic command history recording per session
- **Statistics**: Track record count, file size, and last activity time
- **History Viewer**: Browse past commands with timestamps
- **Log Management**: Clear individual session history when needed

### Notifications
- **Real-time Alerts**: Desktop notifications for important terminal events
- **Activity Monitoring**: Track session activity and command completion
- **Unread Counts**: Badge indicators for new notifications
- **Grouped Display**: Notifications organized by session
- **Magic Strings**: Support for terminal-triggered notifications via special escape sequences.

### OpenCode Integration
- **Auto-Start**: Automatically launch OpenCode server and web interface on app startup
- **Process Management**: Independent control of server and web processes
- **Status Monitoring**: Real-time PIDs, port numbers, and process state
- **Log Streaming**: Live logs for debugging and monitoring
- **Configurable**: Startup delay, auto-restart, log levels
- **RI Notification Plugin**: One-click installation of OpenCode plugin for seamless RI integration
  - Sends notifications to RI when OpenCode completes tasks
  - Auto-detects RI terminal environment
  - Zero configuration required - uses sensible defaults
  - Easy management: Install, reinstall, open directory, view docs

## Tech Stack

- **Frontend**: React 18, TypeScript
- **Desktop**: Electron 30
- **State Management**: Zustand (unified tab system)
- **Terminal**: xterm.js 5.2.0 with xterm-addon-fit
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

Alternatively, use the provided build script:
```bash
./build-app.sh
```

## Scripts

- `npm run dev` - Start development environment with hot reload
- `npm run build` - Build the application for production
- `npm start` - Start the Electron app (production mode)
- `npm run lint` - Run ESLint to check code quality
- `./cleanup-processes.sh` - Clean up any residual terminal processes

## Project Structure

```
.
├── electron/                    # Electron main process files
│   ├── main.cjs                # Main process entry point
│   ├── terminalManager.cjs     # Terminal process management (with PGID cleanup)
│   ├── sessionLogger.cjs       # Command history logging
│   ├── notificationManager.cjs # Desktop notifications
│   └── opencodePlugin.cjs      # OpenCode plugin installation manager
├── src/
│   └── renderer/               # React renderer process
│       ├── components/         # React components
│       │   ├── Sidebar.tsx           # Icon sidebar navigation
│       │   ├── TabBar.tsx            # Unified tab bar (terminals/history/settings)
│       │   ├── Terminal.tsx          # xterm.js terminal component
│       │   ├── ConfirmContextMenu.tsx # Context-aware deletion confirmation
│       │   ├── SessionList.tsx       # Session navigation list
│       │   ├── HistoryList.tsx       # History session list
│       │   ├── Settings/
│       │   │   ├── OpencodeSettings.tsx # OpenCode configuration and plugin management
│       │   │   └── OpencodeSettings.css
│       │   └── SettingsView.tsx      # Main settings interface
...
├── docs/                        # Documentation
│   ├── NOTIFICATIONS.md        # Notification system details
│   ├── NOTIFICATION_API.md     # Terminal notification protocol
│   └── OPENCODE_PLUGIN.md      # OpenCode plugin integration guide
├── opencode-ri-notification/   # OpenCode RI notification plugin source
│   ├── index.ts                # Plugin entry point
│   ├── lib/                    # Plugin implementation
│   ├── README.md               # Plugin documentation
│   └── package.json            # Plugin manifest
├── PROCESS_CLEANUP.md           # Details on zombie process prevention
├── README.md                   # This file
└── README_CN.md                # Chinese version
```

## Usage

### Creating a Terminal Session

1. Click the `+` button in the Sessions list (left navigation panel)
2. A new terminal session will be created with a default name
3. A terminal tab will automatically open in the tab bar
4. The first command you type will rename the session automatically

### Managing Tabs

The unified tab bar shows all open content with type prefixes:

- **Terminal tabs**: Display the session name (e.g., "Session 1", "bash", "npm dev")
- **History tabs**: Show `[H]: Session Name` to indicate history view
- **Settings tab**: Shows `[S]: Settings` for app configuration

**Tab Actions**:
- **Switch tabs**: Click on any tab in the tab bar
- **Close tab**: Hover over a tab and click the `×` button
  - Closing a terminal tab hides it but keeps the session alive
  - Closing a history tab removes it from the bar
  - Settings tab can be reopened by clicking the Settings icon
- **Reorder tabs**: Drag and drop tabs to rearrange their order
- **Reopen closed sessions**: Click on the session in the Sessions list

### Working with History

1. **View History**: Click the 📜 History icon in the sidebar
2. **Browse Sessions**: The left panel shows all sessions with command history
   - Displays record count, file size, and last activity time
3. **Open History Tab**: Click on a session to open its history in a new `[H]:` tab
4. **View Commands**: Browse all commands executed in that session with timestamps
5. **Clear History**: Hover over a session and click the `×` button to clear its logs

### Session Management

**In the Sessions List** (when ⚡ Sessions view is active):
- **Rename**: Double-click on a session name, edit, and press Enter
- **Delete**: Click the trash icon (🗑). A confirmation menu will appear to prevent accidental deletion.
- **Open/Close**: Click a session to toggle its terminal tab in the tab bar
- **Session indicators**:
  - ● (solid circle) = Session tab is open
  - ○ (hollow circle) = Session exists but tab is closed

### Notifications

1. **View Notifications**: Click the 🔔 Notify icon in the sidebar
2. **Browse by Session**: Left panel shows notification groups (max 3 preview per session)
3. **Unread Badge**: Red badge shows total unread notification count
4. **View All**: Click a session to see all its notifications in the main area
5. **Mark as Read**: Notifications are marked as read when viewed

### Sidebar Navigation

- **Icon Sidebar** (48px, always visible):
  - ⚡ Sessions - Create and manage terminal sessions
  - 📜 History - Browse command history
  - 🔔 Notify - View notifications
  - ⚙️ Flow - Workflow automation (future feature)
  - ⚙ Settings - App configuration

- **Navigation Panel** (250px, collapsible):
  - Shows context-relevant lists (sessions, history, notifications)
  - **Collapse/Expand**: Click the toggle button (`◀`/`▶`) to save screen space
  - Only visible for Sessions, History, and Notify views

### Settings

1. Click the ⚙ Settings icon in the sidebar
2. A `[S]: Settings` tab opens in the tab bar
3. Configure:
   - **Notifications**: Desktop alerts, themes, toast duration, external integrations
     - System notifications (macOS Notification Center)
     - In-app toast notifications with customizable themes
     - External channels: Slack, Discord, Telegram, DingTalk (钉钉), WeCom (企业微信)
   - **OpenCode**: Auto-start and plugin management
     - Server and web interface auto-start options
     - Process control and monitoring
     - Live log streaming
     - **RI Notification Plugin**: One-click install/reinstall OpenCode plugin
       - Automatically sends OpenCode task completion notifications to RI
       - Plugin auto-detects RI environment (no config needed)
       - Manage plugin: Install, Reinstall, Open Directory, View Documentation
   - Terminal preferences (coming soon)
   - UI appearance options (coming soon)
   - Advanced settings (coming soon)

### OpenCode Integration

RI includes built-in integration with OpenCode, allowing you to automatically start OpenCode services when the application launches.

**Configuration Features:**
- Auto-start OpenCode Server and/or Web interface on app launch
- Independent control of server and web processes
- Real-time status monitoring with PIDs and port numbers
- Live log streaming for debugging
- Configurable startup delay to ensure smooth initialization
- Auto-restart on crash (optional)
- Choose log level (DEBUG, INFO, WARN, ERROR)

**RI Notification Plugin:**

RI provides a dedicated OpenCode plugin that sends notifications when OpenCode completes tasks, making it easy to track your AI assistant's work.

**Features:**
- **One-Click Installation**: Install the plugin directly from RI Settings
- **Auto-Detection**: Plugin automatically detects RI terminal environment
- **Zero Configuration**: Works out of the box with sensible defaults
- **Non-Intrusive**: Only active in RI terminals, doesn't affect OpenCode elsewhere
- **Easy Management**: Reinstall, open directory, or view documentation from Settings

**Setup:**
1. Go to Settings → OpenCode tab
2. Scroll to "RI Notification Plugin" section
3. Click "Install Plugin" button
4. Plugin is now active in all RI terminal sessions

**How it Works:**
- When you run `opencode` in an RI terminal, the plugin activates automatically
- OpenCode sends notifications to RI when tasks complete (builds, tests, errors, etc.)
- Notifications appear in RI's notification panel and as system alerts
- In non-RI terminals, the plugin stays inactive

**Notification Types:**
- ✅ Task completion
- 🔨 Build and test results
- ❌ Error alerts
- 🔒 Permission requests
- ⏱️ Long-running command notifications

### AI Tool Monitoring

The app automatically detects when you're using AI coding assistants:
- **Supported tools**: OpenCode, GitHub Copilot, Aider, Cursor, Cline
- **Status indicators**: Emoji icons in tabs show AI tool activity
  - 🤔 Thinking
  - ⏸ Waiting for input
  - ⚡ Executing command
  - ✅ Completed

## Architecture Highlights

### Unified Tab System

The app uses a **unified tab system** where all content types (terminals, history views, settings) are managed through a single tab bar:

```typescript
// Tab types
type TabType = 'terminal' | 'history' | 'settings';

interface Tab {
  id: string;           // Unique tab ID
  type: TabType;        // Tab content type
  sessionId?: string;   // For terminal and history tabs
  title: string;        // Display title with prefix
}
```

### Robust Process Cleanup

RI ensures that no terminal processes are left behind.
- **Unix**: Uses process groups (`setsid`) and `pkill -P` to kill the entire tree.
- **Windows**: Uses `taskkill /T /F` to ensure recursive termination.
- **Main Process**: Listens for `before-quit` and `will-quit` to ensure all sessions are destroyed.

### State Management with Zustand

Three main stores handle application state:

1. **terminalStore.ts**: 
   - Terminal sessions and processes
   - Unified tab system (tabs, activeTabId)
   - Session lifecycle management

2. **notifyStore.ts**:
   - Notification management
   - Read/unread status
   - Real-time notification listeners

3. **configStore.ts**:
   - Application configuration
   - User preferences
   - Settings persistence

## Troubleshooting

### Terminal not displaying or input not working

**Issue**: Terminal shows black screen or can't type
- **Cause**: xterm.js initialization timing issues
- **Fix**: Terminal uses lazy initialization - only opens when tab becomes visible
- Check browser console for errors
- Try closing and reopening the terminal tab

### Residual Processes

**Issue**: `opencode` or other processes still running after RI closes.
- **Fix**: Run `./cleanup-processes.sh` to manually purge orphans.
- Report the issue as the app should handle this automatically via its PGID killing logic.

---

## Documentation

### Getting Started
- [Quick Start Guide](./docs/QUICKSTART.md) - Get up and running in 5 minutes
- [中文快速开始](./docs/QUICKSTART_CN.md) (coming soon)

### Core Features
- [Notification System](./docs/NOTIFICATIONS.md) - How notifications work
- [Notification API (Magic Strings)](./docs/NOTIFICATION_API.md) - Send custom notifications from terminal
- [Process Cleanup](./PROCESS_CLEANUP.md) - Zombie process prevention

### Integrations
- [OpenCode Plugin Guide](./docs/OPENCODE_PLUGIN.md) - Complete OpenCode integration guide
- [OpenCode Plugin (中文)](./docs/OPENCODE_PLUGIN_CN.md) (coming soon)

### Chinese Documentation
- [中文版 README](./README_CN.md) (coming soon)
- [通知系统 (中文)](./docs/NOTIFICATIONS_CN.md) (coming soon)
- [通知 API (中文)](./docs/NOTIFICATION_API_CN.md) (coming soon)

---

## License

This project is private and not currently licensed for public use.

