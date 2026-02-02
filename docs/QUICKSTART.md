# RI Quick Start Guide

> [English](#) | [快速开始 (中文)](./QUICKSTART_CN.md)

Welcome to RI! This guide will help you get started quickly.

## Installation & First Launch

```bash
# Clone and install
git clone <repository-url>
cd om
npm install

# Start development
npm run dev
```

## 5-Minute Tutorial

### 1. Create Your First Terminal Session (30 seconds)

1. RI opens with the Sessions view active (⚡ icon highlighted)
2. Click the **+ button** in the top-right corner
3. A new terminal session appears with a default name like "Session 1"
4. Type any command (e.g., `ls` or `npm --version`)
5. **Auto-naming magic**: The session automatically renames itself based on your first command!

### 2. Manage Multiple Sessions (1 minute)

**Create more sessions:**
- Click the **+** button again to create another session
- Each session runs independently with its own process

**Switch between sessions:**
- Click on session names in the left panel, OR
- Click on tabs in the top tab bar

**Rename a session:**
- Double-click the session name in the left panel
- Type your new name and press Enter

**Delete a session:**
- Click the 🗑 trash icon next to the session
- Confirm deletion in the context menu

### 3. View Command History (1 minute)

1. Click the **📜 History** icon in the left sidebar
2. See all your sessions with command counts and activity times
3. Click any session to view its full command history
4. A history tab opens: `[H]: session-name`
5. Browse all commands with timestamps and outputs
6. Expand/collapse long outputs with the toggle button

**Clear history:**
- Hover over a session in the history list
- Click the **× button** to clear its logs

### 4. Set Up Notifications (1 minute)

**Enable notifications:**
1. Click the **⚙ Settings** icon in the sidebar
2. Go to **Notifications** section
3. Toggle on "Enable Notifications"
4. Choose your notification theme (VSCode, macOS, Windows, Material)
5. Set toast duration (default: 3000ms)
6. Click **Save Changes**

**Test notifications:**
```bash
# In any terminal, send a test notification
printf "\033]9;Hello from RI!\007"
```

You should see a notification appear!

**View notifications:**
1. Click the **🔔 Notify** icon in the sidebar
2. See notifications grouped by session
3. Unread badge shows on the icon and in session list

### 5. OpenCode Integration (2 minutes)

If you use OpenCode (AI coding assistant), RI can integrate seamlessly:

**Auto-start OpenCode:**
1. Go to Settings → OpenCode
2. Enable "Enable Auto-Start"
3. Toggle on "Start Server" and/or "Start Web"
4. Set startup delay (default: 2 seconds)
5. Save changes

**Install OpenCode Plugin:**
1. In the same Settings → OpenCode page
2. Scroll to "RI Notification Plugin" section
3. Click **"Install Plugin"**
4. Wait for success notification

**Use OpenCode in RI:**
1. Open any terminal session in RI
2. Run `opencode`
3. The plugin activates automatically (check for activation message)
4. Work with OpenCode as normal
5. Get notifications in RI when OpenCode completes tasks!

## Essential Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New Session | Click **+** button |
| Close Tab | Click **×** on tab |
| Switch Views | Click sidebar icons |
| Rename Session | Double-click name |

## Pro Tips

### Tab Management
- **Close tab ≠ Delete session**: Closing a tab hides it, session keeps running
- **Reopen closed tabs**: Click the session name in the Sessions list
- **Drag tabs**: Reorder tabs by dragging them left/right
- **Tab prefixes**: 
  - Terminal: No prefix (e.g., "my-project")
  - History: `[H]:` prefix (e.g., "[H]: my-project")
  - Settings: `[S]:` prefix

### Navigation Panel
- **Collapse for space**: Click the **◀** toggle button to hide the navigation panel
- **Expand when needed**: Click **▶** to bring it back
- **Auto-resize**: Terminal resizes automatically when panel collapses/expands

### Session Organization
- **Meaningful names**: Let the first command auto-name, or rename manually
- **Delete unused sessions**: Keep your workspace clean
- **Check history**: Review what you did in past sessions

### Notifications
- **Magic Strings**: Use `printf "\033]9;message\007"` to send custom notifications
- **External channels**: Configure Slack, Discord, Telegram for remote alerts
- **Toast themes**: Pick a theme that matches your desktop environment

### OpenCode Workflow
- **Background monitoring**: OpenCode notifications work even if you switch tabs
- **Session context**: Notifications include the session name where OpenCode is running
- **Non-intrusive**: Plugin only activates in RI terminals

## Common Workflows

### Frontend Development
```bash
# Session 1: Development server
npm run dev

# Session 2: Git operations
git status
git add .
git commit -m "feat: add feature"

# Session 3: Testing
npm test -- --watch
```

### Backend Development
```bash
# Session 1: API server
npm run start:dev

# Session 2: Database
docker-compose up postgres

# Session 3: Logs
tail -f logs/app.log

# Session 4: Testing API
curl http://localhost:3000/api/health
```

### AI-Assisted Coding with OpenCode
```bash
# Session 1: OpenCode
opencode
# Ask: "Implement user authentication"
# Get notification when complete

# Session 2: Run tests
npm test
# Get notification about test results

# Session 3: Preview
npm run dev
```

## Next Steps

### Explore Advanced Features
- **Flow View** (⚙️ icon): Workflow automation (coming soon)
- **AI Tool Detection**: Automatic detection of OpenCode, Copilot, Aider, Cursor, Cline
- **External Integrations**: Set up Slack, Discord, or other notification channels

### Read Full Documentation
- [README.md](../README.md) - Complete feature list
- [NOTIFICATIONS.md](./NOTIFICATIONS.md) - Notification system details
- [NOTIFICATION_API.md](./NOTIFICATION_API.md) - Magic String protocol
- [OPENCODE_PLUGIN.md](./OPENCODE_PLUGIN.md) - OpenCode integration guide

### Customize Your Setup
- **Notification Theme**: Match your desktop environment
- **OpenCode Auto-Start**: Save time on app launch
- **External Channels**: Get notifications on mobile via Telegram/Discord

## Getting Help

### Troubleshooting
- **Terminal not showing**: Close and reopen the tab
- **Notifications not working**: Check Settings → Notifications → Enable Notifications
- **Plugin not activating**: Verify installation in Settings → OpenCode
- **Zombie processes**: Run `./cleanup-processes.sh`

### Resources
- Check the [README.md](../README.md) for detailed documentation
- Review [PROCESS_CLEANUP.md](../PROCESS_CLEANUP.md) for process management
- Visit the docs folder for specific feature guides

## Welcome!

You're now ready to use RI effectively. Enjoy your enhanced terminal experience! 🚀

---

**Quick Reference Card**

```
Views:        ⚡ Sessions | 📜 History | 🔔 Notify | ⚙️ Flow | ⚙ Settings
New Session:  Click + button
Close Tab:    Click × on tab (session stays alive)
Delete Session: Click 🗑 icon → Confirm
Rename:       Double-click session name
History:      Click 📜 → Select session → View commands
Notify:       printf "\033]9;message\007"
Settings:     Click ⚙ → Configure → Save Changes
```
