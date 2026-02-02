# OpenCode RI Notification Plugin

> [English](#) | [中文文档](./OPENCODE_PLUGIN_CN.md)

This document describes the OpenCode RI Notification Plugin integration and how to use it.

## Overview

The OpenCode RI Notification Plugin enables seamless communication between OpenCode (AI coding assistant) and RI (terminal manager). When you use OpenCode within an RI terminal session, it automatically sends notifications about task completions, build results, errors, and other important events directly to RI's notification system.

## Features

- **Automatic Environment Detection**: Plugin detects when it's running in an RI terminal and activates automatically
- **Zero Configuration**: Works out of the box with sensible defaults
- **Non-Intrusive**: Only active in RI terminals - doesn't affect OpenCode in other environments
- **Rich Notification Types**: Supports multiple notification categories
- **Easy Management**: Install, reinstall, and manage the plugin from RI Settings

## Installation

### Method 1: One-Click Install from RI Settings (Recommended)

1. Open RI application
2. Click the **⚙ Settings** icon in the left sidebar
3. Select **OpenCode** from the settings navigation
4. Scroll to the **"RI Notification Plugin"** section
5. Click **"Install Plugin"** button
6. Wait for the success notification

The plugin will be installed to `~/.config/opencode/plugins/opencode-ri-notification/`

### Method 2: Manual Installation

If you prefer to install manually or need to troubleshoot:

```bash
# Copy plugin from RI directory to OpenCode plugins directory
cp -r /path/to/ri/opencode-ri-notification ~/.config/opencode/plugins/

# Verify installation
ls -la ~/.config/opencode/plugins/opencode-ri-notification/
```

## Usage

### Basic Usage

1. **Open an RI Terminal Session**
2. **Start OpenCode**:
   ```bash
   opencode
   ```
3. **Verify Plugin Activation**:
   - Look for the log message: `[ri-notification] Plugin activated in session: [session-name]`
   - If you see: `Not running in RI terminal, plugin disabled` - you're in a different terminal

4. **Work with OpenCode**:
   - Ask OpenCode to run builds, tests, or other tasks
   - Notifications will appear in RI when tasks complete

### Notification Types

The plugin sends different types of notifications based on OpenCode's activity:

| Type | Icon | Trigger | Example |
|------|------|---------|---------|
| **Task Completion** | ✅ | OpenCode finishes a task | "Task completed: Add login feature" |
| **Build/Test** | 🔨 | Build or test commands complete | "Build completed successfully" |
| **Error Alert** | ❌ | Errors or failures occur | "Build failed: Missing dependency" |
| **Permission Request** | 🔒 | OpenCode needs confirmation | "Permission required to modify files" |
| **Long-Running Commands** | ⏱️ | Commands take longer than threshold | "Command running for 2 minutes" |
| **Info** | ℹ️ | General information | "Starting development server" |

### Environment Variables

The plugin automatically detects RI environment through these variables (set by RI):

```bash
RI_TERMINAL=true           # Indicates running in RI
RI_SESSION_ID=abc123       # Current RI session ID
RI_SESSION_NAME=my-project # Current RI session name
```

**Note**: You don't need to set these manually - RI sets them automatically for all terminal sessions.

## Plugin Management

### Viewing Plugin Status

In RI Settings → OpenCode → RI Notification Plugin section:

- **Plugin Status**: Shows if installed or not installed
- **Plugin Version**: Displays the current plugin version (if installed)
- **Plugin Path**: Shows the installation directory
- **OpenCode Status**: Indicates if OpenCode is installed

### Reinstalling the Plugin

Useful when updating to a new version or fixing issues:

1. Go to Settings → OpenCode
2. Scroll to "RI Notification Plugin" section
3. Click **"Reinstall Plugin"** button
4. Confirm the action
5. Wait for success notification

This will replace the existing plugin with the latest version from RI.

### Opening Plugin Directory

To view or manually edit plugin files:

1. Go to Settings → OpenCode
2. Click **"Open Plugin Directory"** button
3. Your file manager opens to `~/.config/opencode/plugins/opencode-ri-notification/`

### Viewing Documentation

To read the plugin's README:

1. Go to Settings → OpenCode
2. Click **"View Documentation"** button
3. The plugin's README.md opens in your default markdown viewer

## Configuration

### Default Configuration

The plugin uses these default settings (no configuration file needed):

```typescript
{
  enabled: true,
  notificationTypes: {
    taskComplete: true,
    buildTest: true,
    error: true,
    permission: true,
    longRunning: true,
    info: true
  },
  longRunningThreshold: 120000,  // 2 minutes
  protocol: '__OM_NOTIFY'
}
```

### Custom Configuration (Advanced)

If you need to customize the plugin, create a config file:

```bash
# Create config file
nano ~/.config/opencode/plugins/opencode-ri-notification/config.json
```

Example custom configuration:

```json
{
  "enabled": true,
  "notificationTypes": {
    "taskComplete": true,
    "buildTest": true,
    "error": true,
    "permission": false,
    "longRunning": false,
    "info": false
  },
  "longRunningThreshold": 300000
}
```

**Note**: The plugin works perfectly with defaults - only customize if you have specific needs.

## How It Works

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   OpenCode  │────▶│  RI Plugin   │────▶│ RI Terminal │
│   (AI Tool) │     │  (Detector)  │     │   Manager   │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ __OM_NOTIFY  │
                    │  Protocol    │
                    └──────────────┘
```

### Communication Flow

1. **Plugin Initialization**:
   - OpenCode loads the plugin on startup
   - Plugin checks for `RI_TERMINAL` environment variable
   - If detected, plugin activates and subscribes to OpenCode events

2. **Event Detection**:
   - Plugin monitors OpenCode task lifecycle
   - Detects completion, errors, permission requests, etc.
   - Categorizes events into notification types

3. **Notification Sending**:
   - Plugin formats notification data
   - Sends via `__OM_NOTIFY` protocol to terminal output
   - RI's terminal manager intercepts and displays the notification

### Protocol Details

The plugin uses RI's Magic String protocol:

```bash
printf "\x1b]9;{\"title\":\"Task Complete\",\"body\":\"Build finished\",\"type\":\"success\"}\x07"
```

Format: `\x1b]9;{JSON_PAYLOAD}\x07`

See [NOTIFICATION_API.md](./NOTIFICATION_API.md) for full protocol details.

## Troubleshooting

### Plugin Not Activating

**Symptom**: OpenCode starts but no notifications appear in RI

**Solutions**:
1. **Check Plugin Installation**:
   ```bash
   ls ~/.config/opencode/plugins/opencode-ri-notification/
   ```
   If directory doesn't exist, reinstall from RI Settings

2. **Verify RI Environment**:
   ```bash
   echo $RI_TERMINAL
   echo $RI_SESSION_ID
   ```
   Should show `true` and a session ID. If empty, you're not in an RI terminal.

3. **Check OpenCode Logs**:
   - Look for plugin activation message in OpenCode output
   - If you see "plugin disabled", the environment wasn't detected

### Notifications Not Appearing

**Symptom**: Plugin activates but notifications don't show in RI

**Solutions**:
1. **Check RI Notification Settings**:
   - Go to Settings → Notifications
   - Ensure "Enable Notifications" is ON
   - Check if In-App Toast or System Notifications are enabled

2. **Verify Protocol**:
   - Test the notification protocol manually:
   ```bash
   printf "\x1b]9;Test Notification\x07"
   ```
   - Should appear as a notification in RI

3. **Restart RI Session**:
   - Close and reopen the terminal session
   - Restart OpenCode

### Plugin Version Mismatch

**Symptom**: Old plugin version or outdated features

**Solution**:
1. Go to Settings → OpenCode
2. Click "Reinstall Plugin"
3. Confirm and wait for completion
4. Restart OpenCode in your terminal

### Permission Errors

**Symptom**: "Permission denied" when installing plugin

**Solution**:
```bash
# Fix permissions for OpenCode config directory
chmod 755 ~/.config/opencode
chmod 755 ~/.config/opencode/plugins
```

## FAQ

### Q: Will the plugin slow down OpenCode?

**A**: No. The plugin has minimal overhead and only activates in RI terminals.

### Q: Can I use OpenCode normally in other terminals?

**A**: Yes. The plugin auto-detects RI environment and stays disabled elsewhere.

### Q: Do I need to configure anything?

**A**: No. The plugin works out of the box with sensible defaults.

### Q: How do I update the plugin?

**A**: Use the "Reinstall Plugin" button in RI Settings → OpenCode.

### Q: Can I disable the plugin temporarily?

**A**: Yes. Create a config file and set `enabled: false`, or unset the `RI_TERMINAL` environment variable.

### Q: Does the plugin work in SSH sessions?

**A**: Yes, as long as the SSH session is running inside an RI terminal.

### Q: Can I customize notification types?

**A**: Yes. Create a custom config file (see Configuration section above).

## Support

For issues, questions, or feature requests:

1. Check the [README.md](../README.md) for general RI documentation
2. Review [NOTIFICATIONS.md](./NOTIFICATIONS.md) for notification system details
3. Check the plugin's own [README](../opencode-ri-notification/README.md)

## Related Documentation

- [RI Main Documentation](../README.md)
- [Notification System](./NOTIFICATIONS.md)
- [Notification API Protocol](./NOTIFICATION_API.md)
- [OpenCode Plugin Source](../opencode-ri-notification/)
