const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { TerminalManager } = require('./terminalManager.cjs');
const ConfigManager = require('./configManager.cjs');
const NotificationManager = require('./notificationManager.cjs');
const OpencodeManager = require('./opencodeManager.cjs');

// Set application name as early as possible (must be before app.whenReady)
app.setName('RI');

// For macOS: set the application name in the About panel
if (process.platform === 'darwin') {
  app.setAboutPanelOptions({
    applicationName: 'RI',
    applicationVersion: '0.1.0',
    version: '0.1.0',
    copyright: 'Copyright © 2024'
  });
}

// Initialize configuration manager
const configManager = new ConfigManager();
const config = configManager.loadConfig();

// Initialize terminal manager with configuration
const terminalManager = new TerminalManager(config);

// Listen for terminal notifications (triggered by magic strings in output)
terminalManager.on('terminal-notification', async ({ sessionId, sessionName, type, message }) => {
  if (!notificationManager) return;
  
  // Map notification types to titles
  let title = 'Terminal Notification';
  if (type === 'completed' || type === 'success') title = 'Task Completed';
  else if (type === 'error' || type === 'failed') title = 'Task Failed';
  else if (type === 'blocked' || type === 'waiting') title = 'Task Blocked';
  
  // Use provided session name or fallback
  const finalSessionName = sessionName || 'Terminal';
  
  await notificationManager.send({
    title,
    body: message,
    type: type === 'error' || type === 'failed' ? 'error' : 'info',
    sessionId,
    sessionName: finalSessionName
  });
});

// Initialize notification manager (will be set after window is created)
let notificationManager = null;

// Initialize OpenCode manager
const opencodeManager = new OpencodeManager();
opencodeManager.setConfig(config);

// Watch for config changes and apply them
configManager.on('config-changed', (newConfig) => {
  console.log('[Main] Config changed, applying...');
  terminalManager.applyConfig(newConfig);
  
  // Update OpenCode manager config
  opencodeManager.setConfig(newConfig);
  
  // Update notification manager config
  if (notificationManager) {
    notificationManager.updateConfig(newConfig);
    console.log('[Main] Notification config updated');
  }
});

// ------------------ IPC: OpenCode ------------------

ipcMain.handle('opencode:start-server', async () => {
  try {
    const result = await opencodeManager.startServer();
    return result;
  } catch (error) {
    console.error('[Main] Failed to start OpenCode server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode:start-web', async () => {
  try {
    const result = await opencodeManager.startWeb();
    return result;
  } catch (error) {
    console.error('[Main] Failed to start OpenCode web:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode:stop-server', async () => {
  try {
    await opencodeManager.stopServer();
    return { success: true };
  } catch (error) {
    console.error('[Main] Failed to stop OpenCode server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode:stop-web', async () => {
  try {
    await opencodeManager.stopWeb();
    return { success: true };
  } catch (error) {
    console.error('[Main] Failed to stop OpenCode web:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode:stop-all', async () => {
  try {
    await opencodeManager.stopAll();
    return { success: true };
  } catch (error) {
    console.error('[Main] Failed to stop all OpenCode processes:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode:get-status', async () => {
  try {
    const status = opencodeManager.getStatus();
    return { success: true, status };
  } catch (error) {
    console.error('[Main] Failed to get OpenCode status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode:get-logs', async () => {
  try {
    const logs = opencodeManager.getLogs();
    return { success: true, logs };
  } catch (error) {
    console.error('[Main] Failed to get OpenCode logs:', error);
    return { success: false, error: error.message };
  }
});

// Start watching config file for changes (hot reload)
configManager.watchConfig();

// Create application menu
function createMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: 'RI',
      submenu: [
        { label: 'About RI', role: 'about' },
        { type: 'separator' },
        { label: 'Preferences...', accelerator: 'Cmd+,', click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('open-settings');
          }
        }},
        { type: 'separator' },
        { label: 'Services', role: 'services' },
        { type: 'separator' },
        { label: 'Hide RI', role: 'hide' },
        { label: 'Hide Others', role: 'hideOthers' },
        { label: 'Show All', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit RI', role: 'quit' }
      ]
    }] : []),
    // File menu
    {
      label: 'File',
      submenu: [
        { label: 'New Session', accelerator: 'CmdOrCtrl+N', click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('new-session');
          }
        }},
        { type: 'separator' },
        isMac ? { label: 'Close Window', role: 'close' } : { label: 'Quit', role: 'quit' }
      ]
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', role: 'undo' },
        { label: 'Redo', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' },
        ...(isMac ? [
          { label: 'Select All', role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { label: 'Start Speaking', role: 'startSpeaking' },
              { label: 'Stop Speaking', role: 'stopSpeaking' }
            ]
          }
        ] : [
          { label: 'Select All', role: 'selectAll' }
        ])
      ]
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { label: 'Reload', role: 'reload' },
        { label: 'Force Reload', role: 'forceReload' },
        { label: 'Toggle Developer Tools', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', role: 'resetZoom' },
        { label: 'Zoom In', role: 'zoomIn' },
        { label: 'Zoom Out', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Full Screen', role: 'togglefullscreen' }
      ]
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', role: 'minimize' },
        { label: 'Zoom', role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { label: 'Bring All to Front', role: 'front' },
          { type: 'separator' },
          { label: 'RI', role: 'window' }
        ] : [
          { label: 'Close', role: 'close' }
        ])
      ]
    },
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Initialize notification manager after window creation
  notificationManager = new NotificationManager(mainWindow, config);
  console.log('[Main] Notification manager initialized');
  
  // Set up OpenCode manager event forwarding
  opencodeManager.on('status-change', (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('opencode:status-change', status);
    }
  });
  
  opencodeManager.on('log', (log) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('opencode:log', log);
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  // Create application menu
  createMenu();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  
  // Auto-start OpenCode if enabled
  const currentConfig = configManager.getConfig();
  if (currentConfig.opencode?.enabled) {
    const delay = currentConfig.opencode.startupDelay || 2000;
    console.log(`[Main] Auto-starting OpenCode in ${delay}ms...`);
    
    setTimeout(async () => {
      if (currentConfig.opencode.startServer) {
        console.log('[Main] Auto-starting OpenCode server...');
        await opencodeManager.startServer();
      }
      if (currentConfig.opencode.startWeb) {
        console.log('[Main] Auto-starting OpenCode web...');
        await opencodeManager.startWeb();
      }
    }, delay);
  }
});

// Clean up all terminals before app quits
const cleanupTerminals = () => {
  console.log('[Main] Cleaning up all terminal processes...');
  terminalManager.disposeAll();
  configManager.cleanup();
};

// Clean up OpenCode processes
const cleanupOpencode = () => {
  console.log('[Main] Cleaning up OpenCode processes...');
  opencodeManager.cleanup();
};

app.on('before-quit', (event) => {
  console.log('[Main] App is about to quit...');
  cleanupTerminals();
  cleanupOpencode();
});

app.on('will-quit', () => {
  console.log('[Main] App will quit...');
  cleanupTerminals();
  cleanupOpencode();
});

app.on('window-all-closed', () => {
  console.log('[Main] All windows closed...');
  cleanupTerminals();
  cleanupOpencode();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ------------------ IPC: terminal ------------------

// ========== 数据批处理类（VS Code 策略）==========
class TerminalDataBuffer {
  constructor() {
    this.buffers = new Map(); // terminalId -> data[]
    this.timers = new Map();
    this.BATCH_INTERVAL = 16; // ~60fps (16ms)
  }
  
  add(terminalId, data) {
    if (!this.buffers.has(terminalId)) {
      this.buffers.set(terminalId, []);
    }
    this.buffers.get(terminalId).push(data);
    
    // 如果没有定时器，创建一个（使用 setImmediate 而不是 setTimeout）
    if (!this.timers.has(terminalId)) {
      const timer = setImmediate(() => {
        this.flush(terminalId);
      });
      this.timers.set(terminalId, timer);
    }
  }
  
  flush(terminalId) {
    const batch = this.buffers.get(terminalId);
    if (!batch || batch.length === 0) {
      this.timers.delete(terminalId);
      return;
    }
    
    // 发送批量数据
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:data', {
        id: terminalId,
        data: batch.join('')
      });
    }
    
    // 清理
    this.buffers.delete(terminalId);
    this.timers.delete(terminalId);
  }
  
  dispose() {
    // 清理所有定时器
    for (const timer of this.timers.values()) {
      clearImmediate(timer);
    }
    this.buffers.clear();
    this.timers.clear();
  }
}

// 创建全局数据缓冲区
const dataBuffer = new TerminalDataBuffer();

// 在应用退出时清理
app.on('before-quit', () => {
  dataBuffer.dispose();
});

ipcMain.handle('terminal:create', (_event, payload) => {
  const term = terminalManager.create(payload || {});

  term.pty.onData((data) => {
    if (!mainWindow) return;
    
    // 使用批处理而不是立即发送
    dataBuffer.add(term.id, data);
    
    // Log terminal output
    terminalManager.logOutput(term.id, data);
  });

  term.pty.onExit(() => {
    if (!mainWindow) return;
    mainWindow.webContents.send('terminal:exit', { id: term.id });
    // Keep this simple: dispose on shell exit.
    terminalManager.dispose(term.id);
  });

  return { id: term.id };
});

ipcMain.on('terminal:write', (_event, payload) => {
  if (!payload || !payload.id) return;
  // Write will automatically log if sessionId is set
  terminalManager.write(payload.id, payload.data || '');
});

ipcMain.on('terminal:resize', (_event, payload) => {
  if (!payload || !payload.id) return;
  terminalManager.resize(payload.id, payload.cols || 80, payload.rows || 24);
});

ipcMain.on('terminal:hide', (_event, payload) => {
  if (!payload || !payload.id) return;
  terminalManager.hide(payload.id);
});

ipcMain.on('terminal:show', (_event, payload) => {
  if (!payload || !payload.id) return;
  terminalManager.show(payload.id);
});

ipcMain.on('terminal:dispose', (_event, payload) => {
  if (!payload || !payload.id) return;
  terminalManager.dispose(payload.id);
});

ipcMain.handle('terminal:get-process-info', (_event, payload) => {
  if (!payload || !payload.id) return null;
  return terminalManager.getProcessInfo(payload.id);
});

// Session log APIs
ipcMain.handle('session:read-log', (_event, payload) => {
  if (!payload || !payload.sessionId) return [];
  return terminalManager.readSessionLog(payload.sessionId, payload.limit);
});

ipcMain.handle('session:get-log-stats', (_event, payload) => {
  if (!payload || !payload.sessionId) return null;
  return terminalManager.getSessionLogStats(payload.sessionId);
});

ipcMain.on('session:delete-log', (_event, payload) => {
  if (!payload || !payload.sessionId) return;
  terminalManager.deleteSessionLog(payload.sessionId);
});

ipcMain.on('session:update-name', (_event, payload) => {
  if (!payload || !payload.sessionId || !payload.sessionName) return;
  terminalManager.updateSessionName(payload.sessionId, payload.sessionName);
});

// ------------------ IPC: config ------------------

ipcMain.handle('config:get', () => {
  return configManager.getConfig();
});

ipcMain.handle('config:update', async (_event, partialConfig) => {
  try {
    const updatedConfig = await configManager.updateConfig(partialConfig);
    return { success: true, config: updatedConfig };
  } catch (error) {
    console.error('[Main] Failed to update config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('config:reset', async () => {
  try {
    const defaultConfig = await configManager.resetToDefault();
    return { success: true, config: defaultConfig };
  } catch (error) {
    console.error('[Main] Failed to reset config:', error);
    return { success: false, error: error.message };
  }
});

// ------------------ IPC: notification ------------------

ipcMain.handle('notification:send', async (_event, payload) => {
  try {
    if (!notificationManager) {
      return { success: false, error: 'Notification manager not initialized' };
    }

    // sessionName should be provided by the caller (renderer)
    // If not provided, use a default value
    const sessionName = payload.sessionName || 'Unknown Session';
    
    // Send notification through notification manager
    const result = await notificationManager.send({
      ...payload,
      sessionName
    });
    
    return result;
  } catch (error) {
    console.error('[Main] Failed to send notification:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notification:get-all', async () => {
  // This is handled by renderer store, just return success
  return { success: true };
});

ipcMain.handle('notification:clear', async (_event, sessionId) => {
  // Notify renderer to clear notifications for this session
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('notification:clear-session', { sessionId });
  }
  return { success: true };
});

ipcMain.handle('notification:clear-all', async () => {
  // Notify renderer to clear all notifications
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('notification:clear-all');
  }
  return { success: true };
});

ipcMain.handle('notification:test-channel', async (_event, channelType) => {
  console.log('[Main] Received test-channel request for:', channelType);
  try {
    if (!notificationManager) {
      console.error('[Main] NotificationManager is not initialized');
      return { success: false, error: 'Notification manager not initialized' };
    }
    console.log('[Main] Calling notificationManager.testChannel...');
    const result = await notificationManager.testChannel(channelType);
    console.log('[Main] Test result:', result);
    return result;
  } catch (error) {
    console.error('[Main] Failed to test channel:', error);
    return { success: false, error: error.message };
  }
});
