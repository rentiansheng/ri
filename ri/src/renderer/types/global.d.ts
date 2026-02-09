/**
 * Global type definitions for Electron IPC
 */

export interface ProcessInfo {
  shellPid: number;
  processes: Array<{
    pid: number;
    ppid: number;
    comm: string;
    state: string;
  }>;
  cwd: string | null;
}

export interface SessionLogRecord {
  timestamp: number;
  type: 'command' | 'output' | 'prompt' | 'interactive' | 'noise';
  data: string;  // Raw data
  cleaned: string;  // Cleaned text for display
}

export interface SessionLogStats {
  exists: boolean;
  recordCount: number;
  fileSize: number;
  oldestRecord: number | null;
  newestRecord: number | null;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  path?: string;
  order?: number;
  mode: 'cron' | 'template';
  commands: string[];
  cwd?: string;
  cron?: string;
  enabled: boolean;
  lastRunTime?: number;
  lastRunStatus?: 'success' | 'error';
}

export interface Config {
  version: string;
  history: {
    logsDirectory: string;
    maxRecordsPerFile: number;
    retentionDays: number;
    trimDebounceMs: number;
    autoTrim: boolean;
    enableFiltering: boolean;
  };
  terminal: {
    defaultShell: string | null;
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    fontWeightBold: string;
    lineHeight: number;
    letterSpacing: number;
    cursorStyle: 'block' | 'underline' | 'bar';
    cursorBlink: boolean;
    scrollback: number;
    smoothScrollDuration: number;
    fastScrollModifier: 'alt' | 'shift' | 'ctrl';
    fastScrollSensitivity: number;
    scrollSensitivity: number;
    allowTransparency: boolean;
    theme: {
      name: string;
      background: string;
      foreground: string;
      cursor: string;
      cursorAccent: string;
      selectionBackground: string;
      black: string;
      red: string;
      green: string;
      yellow: string;
      blue: string;
      magenta: string;
      cyan: string;
      white: string;
      brightBlack: string;
      brightRed: string;
      brightGreen: string;
      brightYellow: string;
      brightBlue: string;
      brightMagenta: string;
      brightCyan: string;
      brightWhite: string;
    };
  };
  window: {
    width: number;
    height: number;
    alwaysOnTop: boolean;
    sidebarCollapsed: boolean;
    navigationWidth?: number;
  };
  ai: {
    enabled: boolean;
    provider: string | null;
    apiKey: string | null;
    model: string | null;
  };
  flows?: Flow[];
  advanced: {
    devToolsOnStartup: boolean;
    enablePerformanceMonitoring: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  notification?: {
    enabled: boolean;
    theme?: string;
    toastDuration?: number;
    maxNotificationsPerSession?: number;
    channels: {
      system: { enabled: boolean };
      inApp: { enabled: boolean };
      slack: {
        enabled: boolean;
        webhookUrl: string;
        channel: string;
        username: string;
      };
      discord: {
        enabled: boolean;
        webhookUrl: string;
        username: string;
      };
      telegram: {
        enabled: boolean;
        botToken: string;
        chatId: string;
      };
      dingtalk: {
        enabled: boolean;
        webhookUrl: string;
        secret: string;
      };
      wecom: {
        enabled: boolean;
        webhookUrl: string;
      };
    };
  };
  opencode?: {
    enabled: boolean;
    startServer: boolean;
    startWeb: boolean;
    startupDelay: number;
    autoRestart: boolean;
    logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  };
  editor?: {
    autoSave: boolean;
    autoSaveDelay: number;
  };
  remoteControl?: {
    enabled: boolean;
    requireApproval?: boolean;
    discord?: {
      enabled: boolean;
      botToken: string;
    };
    slack?: {
      enabled: boolean;
      botToken: string;
      appToken: string;
    };
    allowedUsers?: string[];
    allowedChannels?: string[];
  };
  fileManager?: {
    favorites: string[];
    showHidden: boolean;
    sortBy: 'name' | 'size' | 'mtime' | 'ctime';
    sortOrder: 'asc' | 'desc';
  };
  gateway?: {
    enabled: boolean;
    url: string;
    riID: string;
    pollTimeout: number;
    heartbeatInterval: number;
    reconnectInterval: number;
    maxReconnectDelay: number;
  };
}

export interface ViewFilePayload {
  sessionId?: string;
  terminalId: string;
  filePath: string;
}

export interface Terminal {
  create: (payload?: { taskId?: string; cwd?: string; sessionName?: string; sessionId?: string }) => Promise<{ id: string }>;
  write: (payload: { id: string; data: string }) => void;
  resize: (payload: { id: string; cols: number; rows: number }) => void;
  hide: (payload: { id: string }) => void;
  show: (payload: { id: string }) => void;
  dispose: (payload: { id: string }) => void;
  getProcessInfo: (payload: { id: string }) => Promise<ProcessInfo | null>;
  onData: (handler: (payload: { id: string; data: string }) => void) => () => void;
  onExit: (handler: (payload: { id: string }) => void) => () => void;
  onViewFile: (handler: (payload: ViewFilePayload) => void) => () => void;
}

export interface SessionLog {
  read: (payload: { sessionId: string; limit?: number }) => Promise<SessionLogRecord[]>;
  getStats: (payload: { sessionId: string }) => Promise<SessionLogStats | null>;
  delete: (payload: { sessionId: string }) => void;
  updateName: (payload: { sessionId: string; sessionName: string }) => void;
}

export interface ConfigAPI {
  get: () => Promise<Config>;
  update: (config: Partial<Config>) => Promise<{ success: boolean; config?: Config; error?: string }>;
  reset: () => Promise<{ success: boolean; config?: Config; error?: string }>;
  onChange: (callback: (config: Config) => void) => () => void;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationPayload {
  sessionId: string;
  title: string;
  body: string;
  type: NotificationType;
  icon?: string;
  silent?: boolean;
  sessionName?: string;  // Optional, will be added by caller if available
}

export interface NotificationItem {
  id: string;
  sessionId: string;
  sessionName: string;
  title: string;
  body: string;
  type: NotificationType;
  icon?: string;
  timestamp: number;
  read: boolean;
}

export interface NotificationGroup {
  sessionId: string;
  sessionName: string;
  notifications: NotificationItem[];
  unreadCount: number;
  latestTimestamp: number;
}

export interface NotificationAPI {
  send: (payload: NotificationPayload) => Promise<{ success: boolean; id?: string; error?: string }>;
  getAll: () => Promise<{ success: boolean }>;
  clear: (sessionId: string) => Promise<{ success: boolean }>;
  clearAll: () => Promise<{ success: boolean }>;
  testChannel: (channelType: string) => Promise<{ success: boolean; result?: any; error?: string }>;
  onClick: (callback: (payload: { sessionId: string; notificationId?: string }) => void) => () => void;
  onReceived: (callback: (notification: NotificationItem) => void) => () => void;
  onClearSession: (callback: (payload: { sessionId: string }) => void) => () => void;
  onClearAll: (callback: () => void) => () => void;
}

export interface OpencodeStatus {
  serverRunning: boolean;
  webRunning: boolean;
  serverPid: number | null;
  webPid: number | null;
  serverPort: number | null;
  webPort: number | null;
  lastError: string | null;
}

export interface OpencodeLogEntry {
  timestamp: number;
  service: 'server' | 'web' | 'system';
  level: 'info' | 'debug' | 'error';
  message: string;
}

export interface OpencodeAPI {
  startServer: () => Promise<{ success: boolean; error?: string }>;
  startWeb: () => Promise<{ success: boolean; error?: string }>;
  stopServer: () => Promise<{ success: boolean; error?: string }>;
  stopWeb: () => Promise<{ success: boolean; error?: string }>;
  stopAll: () => Promise<{ success: boolean; error?: string }>;
  getStatus: () => Promise<{ success: boolean; status?: OpencodeStatus; error?: string }>;
  getLogs: () => Promise<{ success: boolean; logs?: OpencodeLogEntry[]; error?: string }>;
  onStatusChange: (callback: (status: OpencodeStatus) => void) => () => void;
  onLog: (callback: (log: OpencodeLogEntry) => void) => () => void;
}

export interface FlowAPI {
  getLogs: (flowId: string) => Promise<string>;
  runNow: (flow: Flow) => Promise<void>;
  clearLogs: (flowId: string) => void;
}

export interface FileStat {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  mtime: number;
  ctime: number;
}

export interface FileEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  path: string;
  size?: number;
  mtime?: number;
  ctime?: number;
  isHidden?: boolean;
}

export interface FileAPI {
  read: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  write: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  exists: (filePath: string) => Promise<{ success: boolean; exists?: boolean; error?: string }>;
  stat: (filePath: string) => Promise<{ success: boolean; stat?: FileStat; error?: string }>;
  readDir: (dirPath: string) => Promise<{ success: boolean; files?: FileEntry[]; error?: string }>;
  openDialog: (options?: object) => Promise<{ success: boolean; canceled?: boolean; filePaths?: string[]; error?: string }>;
  saveDialog: (options?: object) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
  mkdir: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  move: (srcPath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
  delete: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
  create: (filePath: string, content?: string) => Promise<{ success: boolean; error?: string }>;
}

export interface OpencodePluginInfo {
  installed: boolean;
  path: string;
  version: string | null;
  sourcePath?: string;
  configEnabled?: boolean;
  configExists?: boolean;
  configValid?: boolean;
}

export interface OpencodeInstallation {
  id: string;
  path: string;
  version: string | null;
  pluginDir: string;
  source: 'shell' | 'filesystem' | 'manual';
  isValid: boolean;
  isActive: boolean;
  shellType?: string;
}

export interface OpencodePluginAPI {
  check: () => Promise<{ success: boolean; installed?: boolean; path?: string; version?: string; error?: string }>;
  install: () => Promise<{ success: boolean; path?: string; configUpdated?: boolean; configAdded?: boolean; warning?: string; error?: string }>;
  uninstall: () => Promise<{ success: boolean; error?: string }>;
  openDir: () => Promise<{ success: boolean; error?: string }>;
  openDocs: () => Promise<{ success: boolean; error?: string }>;
  getInfo: () => Promise<{ 
    success: boolean; 
    plugin?: OpencodePluginInfo;
    opencode?: {
      installed: boolean;
      version: string | null;
    };
    error?: string;
  }>;
  detectAll: () => Promise<{ 
    success: boolean; 
    installations: OpencodeInstallation[];
    error?: string;
  }>;
  getCached: () => Promise<{ 
    success: boolean; 
    installations: OpencodeInstallation[];
    error?: string;
  }>;
  getActive: () => Promise<{ 
    success: boolean; 
    installation?: OpencodeInstallation;
    error?: string;
  }>;
  setActive: (installationId: string) => Promise<{ 
    success: boolean; 
    installation?: OpencodeInstallation;
    error?: string;
  }>;
  addCustomPath: (path: string) => Promise<{ 
    success: boolean; 
    installation?: OpencodeInstallation;
    error?: string;
  }>;
  removeCustomPath: (path: string) => Promise<{ 
    success: boolean; 
    error?: string;
  }>;
  checkConfig: () => Promise<{ 
    success: boolean; 
    enabled: boolean;
    configExists: boolean;
    configValid: boolean;
    error?: string;
  }>;
  enableConfig: () => Promise<{ 
    success: boolean; 
    added?: boolean;
    error?: string;
  }>;
  disableConfig: () => Promise<{ 
    success: boolean; 
    removed?: boolean;
    error?: string;
  }>;
  openConfig: () => Promise<{ 
    success: boolean; 
    error?: string;
  }>;
}

export interface RemoteControlStatus {
  discordConnected: boolean;
  slackConnected: boolean;
  activeSession: {
    sessionId: string;
    platform: string;
  } | null;
}

export interface RemoteControlTestResult {
  timestamp: string;
  tests: Array<{
    name: string;
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }>;
}

export interface RemoteControlConnectionResult {
  platform: string;
  success: boolean;
  message: string;
  details?: {
    username?: string;
    tag?: string;
    id?: string;
    guilds?: number;
    guildNames?: string[];
    user?: string;
    userId?: string;
    team?: string;
    teamId?: string;
    botId?: string;
  };
}

export interface RemoteControlNotificationResult {
  platform: string;
  success: boolean;
  message: string;
  channelId?: string;
  channelName?: string;
  ts?: string;
}

export interface RemoteControlConfigError {
  field: string;
  message: string;
}

export interface RemoteControlValidationResult {
  discord: {
    valid: boolean;
    skipped?: boolean;
    errors: RemoteControlConfigError[];
    details: {
      username?: string;
      tag?: string;
      id?: string;
      guilds?: number;
      guildNames?: string[];
    } | null;
  };
  slack: {
    valid: boolean;
    skipped?: boolean;
    errors: RemoteControlConfigError[];
    details: {
      user?: string;
      userId?: string;
      team?: string;
      teamId?: string;
      botId?: string;
    } | null;
  };
  warnings: RemoteControlConfigError[];
}

export interface RemoteControlMessage {
  id: string;
  type: 'incoming' | 'outgoing' | 'executed' | 'approved' | 'rejected';
  platform: string;
  user: string;
  content: string;
  timestamp: string;
  userId?: string;
  channelId?: string;
  guildId?: string;
}

export interface RemoteControlApproval {
  id: string;
  command: string;
  commandType: string;
  args: Record<string, unknown>;
  platform: string;
  timestamp: string;
  user: string;
}

export interface RemoteControlAPI {
  getStatus: () => Promise<{ success: boolean; status?: RemoteControlStatus; error?: string }>;
  initialize: () => Promise<{ success: boolean; error?: string }>;
  cleanup: () => Promise<{ success: boolean; error?: string }>;
  test: (testType?: string) => Promise<{ success: boolean; results?: RemoteControlTestResult; error?: string }>;
  simulate: (command: string) => Promise<{ success: boolean; response: string }>;
  testConnection: (platform: string) => Promise<RemoteControlConnectionResult>;
  sendTestNotification: (platform: string, channelId?: string) => Promise<RemoteControlNotificationResult>;
  validateConfig: () => Promise<{ success: boolean; result?: RemoteControlValidationResult; error?: string }>;
  getMessages: (limit?: number) => Promise<{ success: boolean; messages?: RemoteControlMessage[]; error?: string }>;
  clearMessages: () => Promise<{ success: boolean; error?: string }>;
  sendMessage: (platform: string, message: string, channelId?: string) => Promise<{ success: boolean; error?: string }>;
  getPendingApprovals: () => Promise<{ success: boolean; approvals?: RemoteControlApproval[]; error?: string }>;
  approveCommand: (approvalId: string) => Promise<{ success: boolean; error?: string }>;
  rejectCommand: (approvalId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  onMessage: (callback: (msg: RemoteControlMessage) => void) => () => void;
  onApprovalRequired: (callback: (approval: RemoteControlApproval) => void) => () => void;
}

export interface GatewayStatus {
  connected: boolean;
  state: string;
  gatewayURL: string;
  riID: string;
  activeSession: { sessionId: string } | null;
}

export interface GatewayAPI {
  getStatus: () => Promise<{ success: boolean; status?: GatewayStatus; error?: string }>;
  connect: () => Promise<{ success: boolean; error?: string }>;
  disconnect: () => Promise<{ success: boolean; error?: string }>;
  testConnection: () => Promise<{ success: boolean; error?: string }>;
  onStateChange: (callback: (state: { oldState: string; newState: string }) => void) => () => void;
  onMessage: (callback: (msg: { eventID: string; platform: string; text: string }) => void) => () => void;
}

declare global {
  interface Window {
    terminal: Terminal;
    sessionLog: SessionLog;
    config: ConfigAPI;
    notification: NotificationAPI;
    opencode: OpencodeAPI;
    flow: FlowAPI;
    file: FileAPI;
    opencodePlugin: OpencodePluginAPI;
    remoteControl: RemoteControlAPI;
    gateway: GatewayAPI;
  }
}

export {};
