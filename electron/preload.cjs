const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('terminal', {
  create: (payload) => ipcRenderer.invoke('terminal:create', payload),
  write: (payload) => ipcRenderer.send('terminal:write', payload),
  resize: (payload) => ipcRenderer.send('terminal:resize', payload),
  hide: (payload) => ipcRenderer.send('terminal:hide', payload),
  show: (payload) => ipcRenderer.send('terminal:show', payload),
  dispose: (payload) => ipcRenderer.send('terminal:dispose', payload),
  getProcessInfo: (payload) => ipcRenderer.invoke('terminal:get-process-info', payload),
  onData: (handler) => {
    const fn = (_event, payload) => handler(payload);
    ipcRenderer.on('terminal:data', fn);
    return () => ipcRenderer.removeListener('terminal:data', fn);
  },
  onExit: (handler) => {
    const fn = (_event, payload) => handler(payload);
    ipcRenderer.on('terminal:exit', fn);
    return () => ipcRenderer.removeListener('terminal:exit', fn);
  },
});

contextBridge.exposeInMainWorld('sessionLog', {
  read: (payload) => ipcRenderer.invoke('session:read-log', payload),
  getStats: (payload) => ipcRenderer.invoke('session:get-log-stats', payload),
  delete: (payload) => ipcRenderer.send('session:delete-log', payload),
  updateName: (payload) => ipcRenderer.send('session:update-name', payload),
});

contextBridge.exposeInMainWorld('config', {
  get: () => ipcRenderer.invoke('config:get'),
  update: (config) => ipcRenderer.invoke('config:update', config),
  reset: () => ipcRenderer.invoke('config:reset'),
  onChange: (callback) => {
    const handler = (_event, config) => callback(config);
    ipcRenderer.on('config:changed', handler);
    return () => ipcRenderer.removeListener('config:changed', handler);
  },
});

contextBridge.exposeInMainWorld('notification', {
  // 发送通知
  send: (payload) => ipcRenderer.invoke('notification:send', payload),
  
  // 获取所有通知
  getAll: () => ipcRenderer.invoke('notification:get-all'),
  
  // 清除指定 session 的通知
  clear: (sessionId) => ipcRenderer.invoke('notification:clear', sessionId),
  
  // 清除所有通知
  clearAll: () => ipcRenderer.invoke('notification:clear-all'),
  
  // 测试通知渠道
  testChannel: (channelType) => ipcRenderer.invoke('notification:test-channel', channelType),
  
  // 监听通知点击事件
  onClick: (callback) => {
    const handler = (_event, data) => callback(data.sessionId);
    ipcRenderer.on('notification:clicked', handler);
    return () => ipcRenderer.removeListener('notification:clicked', handler);
  },
  
  // 监听新通知
  onReceived: (callback) => {
    const handler = (_event, notification) => callback(notification);
    ipcRenderer.on('notification:received', handler);
    return () => ipcRenderer.removeListener('notification:received', handler);
  },
  
  // 监听清除事件
  onClearSession: (callback) => {
    const handler = (_event, data) => callback(data.sessionId);
    ipcRenderer.on('notification:clear-session', handler);
    return () => ipcRenderer.removeListener('notification:clear-session', handler);
  },
  
  onClearAll: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('notification:clear-all', handler);
    return () => ipcRenderer.removeListener('notification:clear-all', handler);
  }
});

contextBridge.exposeInMainWorld('opencode', {
  startServer: () => ipcRenderer.invoke('opencode:start-server'),
  startWeb: () => ipcRenderer.invoke('opencode:start-web'),
  stopServer: () => ipcRenderer.invoke('opencode:stop-server'),
  stopWeb: () => ipcRenderer.invoke('opencode:stop-web'),
  stopAll: () => ipcRenderer.invoke('opencode:stop-all'),
  getStatus: () => ipcRenderer.invoke('opencode:get-status'),
  getLogs: () => ipcRenderer.invoke('opencode:get-logs'),
  onStatusChange: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('opencode:status-change', handler);
    return () => ipcRenderer.removeListener('opencode:status-change', handler);
  },
  onLog: (callback) => {
    const handler = (_event, log) => callback(log);
    ipcRenderer.on('opencode:log', handler);
    return () => ipcRenderer.removeListener('opencode:log', handler);
  }
});

contextBridge.exposeInMainWorld('flow', {
  getLogs: (flowId) => ipcRenderer.invoke('flow:get-logs', flowId),
  runNow: (flow) => ipcRenderer.invoke('flow:run-now', flow),
  clearLogs: (flowId) => ipcRenderer.send('flow:clear-logs', flowId),
});

contextBridge.exposeInMainWorld('opencodePlugin', {
  check: () => ipcRenderer.invoke('opencode-plugin:check'),
  install: () => ipcRenderer.invoke('opencode-plugin:install'),
  uninstall: () => ipcRenderer.invoke('opencode-plugin:uninstall'),
  openDir: () => ipcRenderer.invoke('opencode-plugin:open-dir'),
  openDocs: () => ipcRenderer.invoke('opencode-plugin:open-docs'),
  getInfo: () => ipcRenderer.invoke('opencode-plugin:get-info'),
});

