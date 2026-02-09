const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { TerminalManager } = require('./terminalManager.cjs');
const ConfigManager = require('./configManager.cjs');
const NotificationManager = require('./notificationManager.cjs');
const OpencodeManager = require('./opencodeManager.cjs');
const OpencodePluginManager = require('./opencodePlugin.cjs');
const FlowManager = require('./flowManager.cjs');
const RemoteControlManager = require('./remoteControlManager.cjs');

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

// Initialize flow manager
const flowManager = new FlowManager(terminalManager, configManager);
flowManager.setupIpc();
flowManager.startScheduler();

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

// Listen for view file requests (triggered by magic strings in output)
// Format: __RI_VIEW:/path/to/file__ or OSC: \x1b]__RI_VIEW:/path__\x07
terminalManager.on('terminal-view-file', ({ sessionId, terminalId, filePath }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  
  console.log(`[Main] View file request: ${filePath} from terminal ${terminalId}`);
  mainWindow.webContents.send('terminal:view-file', { sessionId, terminalId, filePath });
});

// Initialize notification manager (will be set after window is created)
let notificationManager = null;

// Initialize OpenCode manager
const opencodeManager = new OpencodeManager();
opencodeManager.setConfig(config);

// Initialize OpenCode plugin manager
const opencodePluginManager = new OpencodePluginManager();
opencodePluginManager.setConfigManager(configManager);

const remoteControlManager = new RemoteControlManager(terminalManager, config);

configManager.on('config-changed', (newConfig) => {
  console.log('[Main] Config changed, applying...');
  terminalManager.applyConfig(newConfig);
  
  opencodeManager.setConfig(newConfig);
  
  remoteControlManager.setConfig(newConfig);
  
  if (notificationManager) {
    notificationManager.updateConfig(newConfig);
    console.log('[Main] Notification config updated');
  }
});

// ------------------ IPC: File Operations ------------------
const fs = require('fs');
const { dialog } = require('electron');

ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:write', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:exists', async (event, filePath) => {
  try {
    return { success: true, exists: fs.existsSync(filePath) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:stat', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      success: true,
      stat: {
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        mtime: stats.mtime.getTime(),
        ctime: stats.ctime.getTime(),
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:read-dir', async (event, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = entries.map(entry => {
      const fullPath = path.join(dirPath, entry.name);
      const isHidden = entry.name.startsWith('.');
      let size = 0;
      let mtime = 0;
      let ctime = 0;
      
      // Get stat info for files (skip for directories to avoid performance issues)
      if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          size = stats.size;
          mtime = stats.mtime.getTime();
          ctime = stats.ctime.getTime();
        } catch (e) {
          // Ignore stat errors (permission denied, etc.)
        }
      } else if (entry.isDirectory()) {
        try {
          const stats = fs.statSync(fullPath);
          mtime = stats.mtime.getTime();
          ctime = stats.ctime.getTime();
        } catch (e) {
          // Ignore stat errors
        }
      }
      
      return {
        name: entry.name,
        isFile: entry.isFile(),
        isDirectory: entry.isDirectory(),
        path: fullPath,
        size,
        mtime,
        ctime,
        isHidden,
      };
    });
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:open-dialog', async (event, options) => {
  try {
    const result = await dialog.showOpenDialog(options || {
      properties: ['openFile'],
      filters: [
        { name: 'Text Files', extensions: ['txt', 'md', 'json', 'yaml', 'yml', 'js', 'ts', 'tsx', 'jsx', 'css', 'html'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return { success: true, canceled: result.canceled, filePaths: result.filePaths };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:save-dialog', async (event, options) => {
  try {
    const result = await dialog.showSaveDialog(options || {
      filters: [
        { name: 'Text Files', extensions: ['txt', 'md', 'json', 'yaml', 'yml'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return { success: true, canceled: result.canceled, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:mkdir', async (event, dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:move', async (event, srcPath, destPath) => {
  try {
    // Check if source exists
    if (!fs.existsSync(srcPath)) {
      return { success: false, error: 'Source path does not exist' };
    }
    // Check if destination already exists
    if (fs.existsSync(destPath)) {
      return { success: false, error: 'Destination already exists' };
    }
    fs.renameSync(srcPath, destPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:delete', async (event, targetPath) => {
  try {
    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:create', async (event, filePath, content = '') => {
  try {
    // Check if file already exists
    if (fs.existsSync(filePath)) {
      return { success: false, error: 'File already exists' };
    }
    // Ensure parent directory exists
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
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

// ------------------ IPC: OpenCode Plugin ------------------

ipcMain.handle('opencode-plugin:check', async () => {
  try {
    const result = await opencodePluginManager.checkPlugin();
    return { success: true, ...result };
  } catch (error) {
    console.error('[Main] Failed to check plugin:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode-plugin:install', async () => {
  try {
    const result = await opencodePluginManager.installPlugin();
    return result;
  } catch (error) {
    console.error('[Main] Failed to install plugin:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode-plugin:uninstall', async () => {
  try {
    const result = await opencodePluginManager.uninstallPlugin();
    return result;
  } catch (error) {
    console.error('[Main] Failed to uninstall plugin:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode-plugin:open-dir', async () => {
  try {
    const result = await opencodePluginManager.openPluginDirectory();
    return result;
  } catch (error) {
    console.error('[Main] Failed to open plugin directory:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode-plugin:open-docs', async () => {
  try {
    const result = await opencodePluginManager.openPluginDocs();
    return result;
  } catch (error) {
    console.error('[Main] Failed to open plugin docs:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode-plugin:get-info', async () => {
  try {
    const result = await opencodePluginManager.getPluginInfo();
    return result;
  } catch (error) {
    console.error('[Main] Failed to get plugin info:', error);
    return { success: false, error: error.message };
  }
});

// New IPC handlers for multi-path detection
ipcMain.handle('opencode-plugin:detect-all', async () => {
  try {
    const installations = await opencodePluginManager.detectAllInstallations(true); // force refresh
    return { success: true, installations };
  } catch (error) {
    console.error('[Main] Failed to detect installations:', error);
    return { success: false, error: error.message, installations: [] };
  }
});

ipcMain.handle('opencode-plugin:get-cached', async () => {
  try {
    const installations = await opencodePluginManager.detectAllInstallations(false); // use cache
    return { success: true, installations: installations || [] };
  } catch (error) {
    console.error('[Main] Failed to get cached installations:', error);
    return { success: false, error: error.message, installations: [] };
  }
});

ipcMain.handle('opencode-plugin:get-active', async () => {
  try {
    const installation = await opencodePluginManager.getActiveInstallation();
    return { success: true, installation };
  } catch (error) {
    console.error('[Main] Failed to get active installation:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode-plugin:set-active', async (event, installationId) => {
  try {
    const installation = await opencodePluginManager.setActiveInstallation(installationId);
    return { success: true, installation };
  } catch (error) {
    console.error('[Main] Failed to set active installation:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode-plugin:add-custom-path', async (event, customPath) => {
  try {
    const installation = await opencodePluginManager.addCustomPath(customPath);
    return { success: true, installation };
  } catch (error) {
    console.error('[Main] Failed to add custom path:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode-plugin:remove-custom-path', async (event, customPath) => {
  try {
    await opencodePluginManager.removeCustomPath(customPath);
    return { success: true };
  } catch (error) {
    console.error('[Main] Failed to remove custom path:', error);
    return { success: false, error: error.message };
  }
});

// OpenCode configuration management handlers
ipcMain.handle('opencode-plugin:check-config', async () => {
  try {
    return await opencodePluginManager.checkPluginConfig();
  } catch (error) {
    console.error('[Main] Failed to check plugin config:', error);
    return { 
      success: false, 
      error: error.message,
      enabled: false,
      configExists: false,
      configValid: false
    };
  }
});

ipcMain.handle('opencode-plugin:enable-config', async () => {
  try {
    return await opencodePluginManager.enablePluginInConfig();
  } catch (error) {
    console.error('[Main] Failed to enable plugin config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode-plugin:disable-config', async () => {
  try {
    return await opencodePluginManager.disablePluginInConfig();
  } catch (error) {
    console.error('[Main] Failed to disable plugin config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('opencode-plugin:open-config', async () => {
  try {
    return await opencodePluginManager.openOpencodeConfig();
  } catch (error) {
    console.error('[Main] Failed to open plugin config:', error);
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
  createMenu();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  
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
  
  if (currentConfig.remoteControl?.enabled) {
    console.log('[Main] Initializing Remote Control...');
    remoteControlManager.initialize().catch(err => {
      console.error('[Main] Failed to initialize Remote Control:', err);
    });
  }
});

const cleanupTerminals = () => {
  console.log('[Main] Cleaning up all terminal processes...');
  terminalManager.disposeAll();
  configManager.cleanup();
};

const cleanupOpencode = () => {
  console.log('[Main] Cleaning up OpenCode processes...');
  opencodeManager.cleanup();
};

const cleanupRemoteControl = () => {
  console.log('[Main] Cleaning up Remote Control...');
  remoteControlManager.cleanup();
};

app.on('before-quit', (event) => {
  console.log('[Main] App is about to quit...');
  cleanupTerminals();
  cleanupOpencode();
  cleanupRemoteControl();
});

app.on('will-quit', () => {
  console.log('[Main] App will quit...');
  cleanupTerminals();
  cleanupOpencode();
  cleanupRemoteControl();
});

app.on('window-all-closed', () => {
  console.log('[Main] All windows closed...');
  cleanupTerminals();
  cleanupOpencode();
  cleanupRemoteControl();
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
    this.lastFlushTime = new Map();
    this.BATCH_INTERVAL = 16; // ~60fps (16ms)
    this.MAX_CHUNK_SIZE = 64 * 1024; // 64KB
  }
  
  add(terminalId, data) {
    // 阶段 1.3 优化：CJK 字符绝对快速通道，完全跳过缓冲区和定时器
    const hasCJK = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(data);
    
    if (hasCJK) {
      const t1 = Date.now();
      // 直接发送 IPC，不进入缓冲区，零延迟
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('terminal:data', {
          id: terminalId,
          data: data
        });
      }
      const t2 = Date.now();
      // 改进日志：只显示前20个字符，避免混淆
      const preview = data.substring(0, 20).replace(/\r/g, '\\r').replace(/\n/g, '\\n');
      console.log(`[DataBuffer] CJK bypass: ${t2-t1}ms, len: ${data.length}, preview: "${preview}"`);
      return;
    }
    
    // 非 CJK 数据进入正常流程
    if (!this.buffers.has(terminalId)) {
      this.buffers.set(terminalId, []);
    }
    
    const buffer = this.buffers.get(terminalId);
    buffer.push(data);
    
    // 交互优化：将阈值提升至 1KB，覆盖大部分打字回显（包括 ANSI 颜色码）
    const isSmallData = data.length < 1024;
    const hasInteractiveKey = /[\r\n\t\x08\x7f ]/.test(data);
    
    let currentSize = 0;
    for (const chunk of buffer) currentSize += chunk.length;
    
    // 如果是小数据包、包含按键，立即刷新，实现零延迟
    if (currentSize > this.MAX_CHUNK_SIZE || isSmallData || hasInteractiveKey) {
      this.flush(terminalId);
      return;
    }
    
    if (!this.timers.has(terminalId)) {
      const now = Date.now();
      const lastFlush = this.lastFlushTime.get(terminalId) || 0;
      
      if (now - lastFlush > this.BATCH_INTERVAL) {
        const timer = setImmediate(() => {
          this.flush(terminalId);
        });
        this.timers.set(terminalId, timer);
      } else {
        const delay = this.BATCH_INTERVAL - (now - lastFlush);
        const timer = setTimeout(() => {
          this.flush(terminalId);
        }, delay);
        this.timers.set(terminalId, timer);
      }
    }
  }
  
  flush(terminalId) {
    const timer = this.timers.get(terminalId);
    if (timer) {
      // 这里的清理要区分类型，或者简单点两个都调
      clearImmediate(timer);
      clearTimeout(timer);
      this.timers.delete(terminalId);
    }

    const batch = this.buffers.get(terminalId);
    if (!batch || batch.length === 0) {
      return;
    }
    
    const t1 = Date.now();
    const joinedData = batch.join('');
    const hasCJK = /[\u4e00-\u9fa5]/.test(joinedData);
    
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('terminal:data', {
        id: terminalId,
        data: joinedData
      });
    }
    
    const t2 = Date.now();
    if (t2 - t1 > 5 || hasCJK) {
      console.log(`[Main] Flush ${batch.length} chunks (${joinedData.length} bytes) took ${t2-t1}ms, hasCJK: ${hasCJK}`);
    }
    
    this.lastFlushTime.set(terminalId, Date.now());
    this.buffers.delete(terminalId);
  }
  
  dispose() {
    // 清理所有定时器
    for (const timer of this.timers.values()) {
      clearImmediate(timer);
      clearTimeout(timer);
    }
    this.buffers.clear();
    this.timers.clear();
    this.lastFlushTime.clear();
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
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
    
    const t1 = Date.now();
    
    // 恢复批处理 Buffer，降低 IPC 频率，为输入法留出 CPU
    dataBuffer.add(term.id, data);
    
    const t2 = Date.now();
    
    if (t2 - t1 > 5) {
      console.log(`[Main] PTY -> dataBuffer took ${t2-t1}ms, data length: ${data.length}`);
    }
    
    // Tier 3: 将日志记录移至 setImmediate，确保数据回显 IPC 具有更高优先级
    setImmediate(() => {
      terminalManager.logOutput(term.id, data);
    });
  });

  term.pty.onExit(() => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
      // 即使窗口销毁了，也要清理 PTY 资源
      terminalManager.dispose(term.id);
      return;
    }
    mainWindow.webContents.send('terminal:exit', { id: term.id });
    // Keep this simple: dispose on shell exit.
    terminalManager.dispose(term.id);
  });

  return { id: term.id };
});

ipcMain.on('terminal:write', (_event, payload) => {
  if (!payload || !payload.id) return;
  
  // 调试：主进程收到写入请求
  console.log(`[Main] IPC terminal:write for ${payload.id}:`, JSON.stringify(payload.data));
  
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

// ------------------ IPC: Remote Control ------------------
console.log('[Main] Registering remote-control IPC handlers...');

ipcMain.handle('remote-control:get-status', async () => {
  try {
    const status = remoteControlManager.getStatus();
    return { success: true, status };
  } catch (error) {
    console.error('[Main] Failed to get remote control status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remote-control:initialize', async () => {
  console.log('[Main] remote-control:initialize handler invoked');
  try {
    await remoteControlManager.initialize();
    return { success: true };
  } catch (error) {
    console.error('[Main] Failed to initialize remote control:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remote-control:cleanup', async () => {
  try {
    await remoteControlManager.cleanup();
    return { success: true };
  } catch (error) {
    console.error('[Main] Failed to cleanup remote control:', error);
    return { success: false, error: error.message };
  }
});

// 测试功能
ipcMain.handle('remote-control:test', async (event, testType) => {
  try {
    const results = await remoteControlManager.runTest(testType);
    return { success: true, results };
  } catch (error) {
    console.error('[Main] Remote control test failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remote-control:simulate', async (event, command) => {
  try {
    const result = await remoteControlManager.simulateCommand(command);
    return result;
  } catch (error) {
    console.error('[Main] Remote control simulate failed:', error);
    return { success: false, response: error.message };
  }
});

ipcMain.handle('remote-control:test-connection', async (event, platform) => {
  try {
    const result = await remoteControlManager.testConnection(platform);
    return result;
  } catch (error) {
    console.error('[Main] Remote control test connection failed:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('remote-control:send-test-notification', async (event, platform, channelId) => {
  try {
    const result = await remoteControlManager.sendTestNotification(platform, channelId);
    return result;
  } catch (error) {
    console.error('[Main] Remote control send test notification failed:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('remote-control:validate-config', async () => {
  try {
    const result = await remoteControlManager.validateAndTestConfig();
    return { success: true, result };
  } catch (error) {
    console.error('[Main] Remote control validate config failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remote-control:get-messages', async (event, limit) => {
  try {
    const messages = remoteControlManager.getMessageLog(limit);
    return { success: true, messages };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remote-control:clear-messages', async () => {
  try {
    remoteControlManager.clearMessageLog();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remote-control:send-message', async (event, platform, message, channelId) => {
  try {
    const result = await remoteControlManager.sendMessageToRemote(platform, message, channelId);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remote-control:get-pending-approvals', async () => {
  try {
    const approvals = remoteControlManager.getPendingApprovals();
    return { success: true, approvals };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remote-control:approve-command', async (event, approvalId) => {
  try {
    const result = await remoteControlManager.approveCommand(approvalId);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remote-control:reject-command', async (event, approvalId, reason) => {
  try {
    const result = await remoteControlManager.rejectCommand(approvalId, reason);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

remoteControlManager.on('message', (msg) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('remote-control:message', msg);
  }
});

remoteControlManager.on('approval-required', (approval) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('remote-control:approval-required', approval);
  }
});
