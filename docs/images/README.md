# Screenshots Guide

This directory should contain the following screenshots for the README documentation.

## Required Screenshots

### Main Interface Screenshots

| Filename | Description | How to Capture |
|----------|-------------|----------------|
| `main-interface.png` | Main app window with terminal session | Open app, create a session, run some commands |
| `sidebar-navigation.png` | Sidebar with all icons highlighted | Hover over sidebar icons |
| `terminal-split.png` | Terminal with split panes | Create session, use split button |

### Flow Feature Screenshots

| Filename | Description | How to Capture |
|----------|-------------|----------------|
| `flow-list.png` | Flow list with folders expanded | Navigate to Flow view, expand folders |
| `flow-editor.png` | Flow editor with commands | Click on a flow to open editor |
| `flow-management.png` | Context menu on flow item | Right-click on a flow |
| `flow-editor-detail.png` | Editor showing all features | Add multiple commands, show reorder buttons |
| `create-flow.png` | New flow creation dialog | Right-click → New Flow |
| `run-flow.png` | Flow running in terminal | Double-click a flow to run |

### Session Screenshots

| Filename | Description | How to Capture |
|----------|-------------|----------------|
| `create-session.png` | Session creation | Click + button in session list |

### File Manager Screenshots

| Filename | Description | How to Capture |
|----------|-------------|----------------|
| `file-manager.png` | File manager with expanded directories | Navigate to Sessions view, expand a session, click on working directory |
| `file-manager-context.png` | File manager context menu | Right-click on a directory in file manager |
| `file-manager-favorites.png` | File manager with favorites section | Add directories to favorites |

### Settings Screenshots

| Filename | Description | How to Capture |
|----------|-------------|----------------|
| `settings-view.png` | Settings page | Click settings icon, show tabs |
| `settings-files-view.png` | Files View settings | Navigate to Settings → Files View |
| `settings-terminal.png` | Terminal settings with scrollback | Navigate to Settings → Terminal |

## Screenshot Guidelines

1. **Resolution**: Capture at 1920x1080 or similar 16:9 aspect ratio
2. **Theme**: Use the default dark theme
3. **Content**: Use realistic but non-sensitive data
4. **Format**: PNG with reasonable compression
5. **Size**: Keep each image under 500KB if possible

## Capture Commands (macOS)

```bash
# Full window screenshot
Cmd + Shift + 4, then Space, then click window

# Region screenshot
Cmd + Shift + 4, then drag to select region
```

## Adding Screenshots

1. Capture the screenshot following guidelines above
2. Save to this directory with the correct filename
3. Optimize if needed: `optipng -o2 filename.png`
4. Commit with message: `docs: add screenshot for [feature]`
