# Terminal Notification System

RI features a robust notification system that bridge the gap between long-running terminal processes and the user's desktop environment.

## Overview

The notification system consists of three main layers:
1. **Detection Layer**: Monitors terminal output for specific patterns (Magic Strings).
2. **Persistence Layer**: Stores notifications in `notifyStore` and allows historical viewing.
3. **UI Layer**: Displays desktop alerts and unread badges.

## Logic Flow

1. **Terminal Output**: When a process outputs data, it's sent to the renderer via IPC.
2. **Magic String Matching**: The terminal component (or a specialized hook) scans the incoming buffer for the pattern `\x1b]9;{message}\x07`.
3. **Store Update**: If a match is found, `notifyStore.addNotification` is called.
4. **Main Process Alert**: `notifyStore` triggers an IPC call to the main process to show a native OS notification.

## Badge Indicators

- **Global Badge**: Shown on the 🔔 sidebar icon. Represents the sum of all unread notifications.
- **Session Badge**: Shown in the Sessions list to indicate which specific session needs attention.

## Background Monitoring

Unlike traditional terminals, RI keeps sessions alive in the background. Even if the terminal tab is closed, the notification logic remains active as long as the session process exists in the Electron main process.
