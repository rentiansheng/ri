import React, { useState, useEffect, useRef } from 'react';
import { useConfigStore } from '../../store/configStore';
import { useNotifyStore } from '../../store/notifyStore';
import { OpencodeStatus, OpencodeLogEntry } from '../../types/global';
import './OpencodeSettings.css';

const OpencodeSettings: React.FC = () => {
  const configStore = useConfigStore();
  const notifyStore = useNotifyStore();
  
  // Local state for form
  const [enabled, setEnabled] = useState(false);
  const [startServer, setStartServer] = useState(false);
  const [startWeb, setStartWeb] = useState(false);
  const [startupDelay, setStartupDelay] = useState(2);
  const [autoRestart, setAutoRestart] = useState(false);
  const [logLevel, setLogLevel] = useState<'DEBUG' | 'INFO' | 'WARN' | 'ERROR'>('INFO');
  
  // Status and logs
  const [status, setStatus] = useState<OpencodeStatus | null>(null);
  const [logs, setLogs] = useState<OpencodeLogEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Refs
  const logsEndRef = useRef<HTMLDivElement>(null);
  const statusCleanupRef = useRef<(() => void) | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  
  // Load config and status on mount
  useEffect(() => {
    loadConfig();
    loadStatus();
    loadLogs();
    
    // Subscribe to status changes
    statusCleanupRef.current = window.opencode.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });
    
    // Subscribe to logs
    logCleanupRef.current = window.opencode.onLog((log) => {
      setLogs(prev => [...prev, log].slice(-100)); // Keep last 100 logs
      
      // Auto-scroll to bottom
      setTimeout(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
    
    return () => {
      statusCleanupRef.current?.();
      logCleanupRef.current?.();
    };
  }, []);
  
  const loadConfig = async () => {
    const config = await window.config.get();
    if (config.opencode) {
      setEnabled(config.opencode.enabled || false);
      setStartServer(config.opencode.startServer || false);
      setStartWeb(config.opencode.startWeb || false);
      setStartupDelay((config.opencode.startupDelay || 2000) / 1000);
      setAutoRestart(config.opencode.autoRestart || false);
      setLogLevel(config.opencode.logLevel || 'INFO');
    }
  };
  
  const loadStatus = async () => {
    try {
      const result = await window.opencode.getStatus();
      if (result.success && result.status) {
        setStatus(result.status);
      }
    } catch (error) {
      console.error('Failed to load OpenCode status:', error);
    }
  };
  
  const loadLogs = async () => {
    try {
      const result = await window.opencode.getLogs();
      if (result.success && result.logs) {
        setLogs(result.logs);
      }
    } catch (error) {
      console.error('Failed to load OpenCode logs:', error);
    }
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await configStore.updateConfig({
        opencode: {
          enabled,
          startServer,
          startWeb,
          startupDelay: startupDelay * 1000,
          autoRestart,
          logLevel
        }
      });
      
      if (result) {
        notifyStore.addNotification({
          id: Date.now().toString(),
          sessionId: 'settings',
          sessionName: 'Settings',
          title: 'Settings Saved',
          body: 'OpenCode settings saved successfully',
          type: 'success',
          timestamp: Date.now(),
          read: false
        });
      } else {
        throw new Error('Failed to save config');
      }
    } catch (error: any) {
      notifyStore.addNotification({
        id: Date.now().toString(),
        sessionId: 'settings',
        sessionName: 'Settings',
        title: 'Save Failed',
        body: error.message || 'Failed to save OpenCode settings',
        type: 'error',
        timestamp: Date.now(),
        read: false
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleStartServer = async () => {
    try {
      const result = await window.opencode.startServer();
      if (!result.success) {
        notifyStore.addNotification({
          id: Date.now().toString(),
          sessionId: 'opencode',
          sessionName: 'OpenCode',
          title: 'Server Start Failed',
          body: result.error || 'Failed to start OpenCode server',
          type: 'error',
          timestamp: Date.now(),
          read: false
        });
      }
    } catch (error: any) {
      notifyStore.addNotification({
        id: Date.now().toString(),
        sessionId: 'opencode',
        sessionName: 'OpenCode',
        title: 'Server Start Error',
        body: error.message || 'Error starting server',
        type: 'error',
        timestamp: Date.now(),
        read: false
      });
    }
  };
  
  const handleStartWeb = async () => {
    try {
      const result = await window.opencode.startWeb();
      if (!result.success) {
        notifyStore.addNotification({
          id: Date.now().toString(),
          sessionId: 'opencode',
          sessionName: 'OpenCode',
          title: 'Web Start Failed',
          body: result.error || 'Failed to start OpenCode web',
          type: 'error',
          timestamp: Date.now(),
          read: false
        });
      }
    } catch (error: any) {
      notifyStore.addNotification({
        id: Date.now().toString(),
        sessionId: 'opencode',
        sessionName: 'OpenCode',
        title: 'Web Start Error',
        body: error.message || 'Error starting web',
        type: 'error',
        timestamp: Date.now(),
        read: false
      });
    }
  };
  
  const handleStopServer = async () => {
    try {
      await window.opencode.stopServer();
    } catch (error: any) {
      notifyStore.addNotification({
        id: Date.now().toString(),
        sessionId: 'opencode',
        sessionName: 'OpenCode',
        title: 'Server Stop Error',
        body: error.message || 'Error stopping server',
        type: 'error',
        timestamp: Date.now(),
        read: false
      });
    }
  };
  
  const handleStopWeb = async () => {
    try {
      await window.opencode.stopWeb();
    } catch (error: any) {
      notifyStore.addNotification({
        id: Date.now().toString(),
        sessionId: 'opencode',
        sessionName: 'OpenCode',
        title: 'Web Stop Error',
        body: error.message || 'Error stopping web',
        type: 'error',
        timestamp: Date.now(),
        read: false
      });
    }
  };
  
  const handleStopAll = async () => {
    try {
      await window.opencode.stopAll();
    } catch (error: any) {
      notifyStore.addNotification({
        id: Date.now().toString(),
        sessionId: 'opencode',
        sessionName: 'OpenCode',
        title: 'Stop All Error',
        body: error.message || 'Error stopping processes',
        type: 'error',
        timestamp: Date.now(),
        read: false
      });
    }
  };
  
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return '#ff6b6b';
      case 'debug': return '#4ecdc4';
      default: return '#aaa';
    }
  };
  
  return (
    <div className="opencode-settings">
      <div className="opencode-section">
        <h3>Configuration</h3>
        
        <div className="opencode-config-form">
          <div className="opencode-form-row">
            <div className="opencode-form-label">
              <label>Enable Auto-Start</label>
              <span className="opencode-form-description">
                Automatically start OpenCode when application launches
              </span>
            </div>
            <div className="opencode-form-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
          
          {enabled && (
            <>
              <div className="opencode-form-row">
                <div className="opencode-form-label">
                  <label>Start Server</label>
                  <span className="opencode-form-description">
                    Start OpenCode headless server on launch
                  </span>
                </div>
                <div className="opencode-form-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={startServer}
                      onChange={(e) => setStartServer(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
              
              <div className="opencode-form-row">
                <div className="opencode-form-label">
                  <label>Start Web</label>
                  <span className="opencode-form-description">
                    Start OpenCode web interface on launch
                  </span>
                </div>
                <div className="opencode-form-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={startWeb}
                      onChange={(e) => setStartWeb(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
              
              <div className="opencode-form-row">
                <div className="opencode-form-label">
                  <label>Startup Delay</label>
                  <span className="opencode-form-description">
                    Delay before starting OpenCode (seconds)
                  </span>
                </div>
                <div className="opencode-form-control">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={startupDelay}
                    onChange={(e) => setStartupDelay(parseFloat(e.target.value))}
                    className="opencode-input-number"
                  />
                </div>
              </div>
              
              <div className="opencode-form-row">
                <div className="opencode-form-label">
                  <label>Auto-Restart</label>
                  <span className="opencode-form-description">
                    Automatically restart if process crashes
                  </span>
                </div>
                <div className="opencode-form-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={autoRestart}
                      onChange={(e) => setAutoRestart(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
              
              <div className="opencode-form-row">
                <div className="opencode-form-label">
                  <label>Log Level</label>
                  <span className="opencode-form-description">
                    OpenCode logging verbosity
                  </span>
                </div>
                <div className="opencode-form-control">
                  <select
                    value={logLevel}
                    onChange={(e) => setLogLevel(e.target.value as any)}
                    className="opencode-select"
                  >
                    <option value="DEBUG">Debug</option>
                    <option value="INFO">Info</option>
                    <option value="WARN">Warning</option>
                    <option value="ERROR">Error</option>
                  </select>
                </div>
              </div>
            </>
          )}
          
          <div className="opencode-form-actions">
            <button
              className="opencode-btn-save"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="opencode-section">
        <h3>Status</h3>
        
        <div className="opencode-status-grid">
          <div className="opencode-status-card">
            <div className="opencode-status-header">
              <span className="opencode-status-title">Server</span>
              <span className={`opencode-status-indicator ${status?.serverRunning ? 'running' : 'stopped'}`}>
                {status?.serverRunning ? '●' : '○'}
              </span>
            </div>
            <div className="opencode-status-details">
              {status?.serverRunning ? (
                <>
                  <div className="opencode-status-detail">
                    <span className="opencode-status-label">PID:</span>
                    <span className="opencode-status-value">{status.serverPid}</span>
                  </div>
                  <div className="opencode-status-detail">
                    <span className="opencode-status-label">Port:</span>
                    <span className="opencode-status-value">
                      {status.serverPort || 'Detecting...'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="opencode-status-detail">
                  <span className="opencode-status-value">Not running</span>
                </div>
              )}
            </div>
            <div className="opencode-status-actions">
              {status?.serverRunning ? (
                <button
                  className="opencode-btn-stop"
                  onClick={handleStopServer}
                >
                  Stop Server
                </button>
              ) : (
                <button
                  className="opencode-btn-start"
                  onClick={handleStartServer}
                >
                  Start Server
                </button>
              )}
            </div>
          </div>
          
          <div className="opencode-status-card">
            <div className="opencode-status-header">
              <span className="opencode-status-title">Web</span>
              <span className={`opencode-status-indicator ${status?.webRunning ? 'running' : 'stopped'}`}>
                {status?.webRunning ? '●' : '○'}
              </span>
            </div>
            <div className="opencode-status-details">
              {status?.webRunning ? (
                <>
                  <div className="opencode-status-detail">
                    <span className="opencode-status-label">PID:</span>
                    <span className="opencode-status-value">{status.webPid}</span>
                  </div>
                  <div className="opencode-status-detail">
                    <span className="opencode-status-label">Port:</span>
                    <span className="opencode-status-value">
                      {status.webPort ? (
                        <a 
                          href={`http://localhost:${status.webPort}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {status.webPort}
                        </a>
                      ) : (
                        'Detecting...'
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <div className="opencode-status-detail">
                  <span className="opencode-status-value">Not running</span>
                </div>
              )}
            </div>
            <div className="opencode-status-actions">
              {status?.webRunning ? (
                <button
                  className="opencode-btn-stop"
                  onClick={handleStopWeb}
                >
                  Stop Web
                </button>
              ) : (
                <button
                  className="opencode-btn-start"
                  onClick={handleStartWeb}
                >
                  Start Web
                </button>
              )}
            </div>
          </div>
        </div>
        
        {(status?.serverRunning || status?.webRunning) && (
          <div className="opencode-stop-all">
            <button
              className="opencode-btn-stop-all"
              onClick={handleStopAll}
            >
              Stop All Processes
            </button>
          </div>
        )}
        
        {status?.lastError && (
          <div className="opencode-error-message">
            <strong>Last Error:</strong> {status.lastError}
          </div>
        )}
      </div>
      
      <div className="opencode-section">
        <h3>Logs</h3>
        
        <div className="opencode-logs-container">
          {logs.length === 0 ? (
            <div className="opencode-logs-empty">
              No logs yet. Start OpenCode to see logs here.
            </div>
          ) : (
            <div className="opencode-logs-content">
              {logs.map((log, index) => (
                <div key={index} className="opencode-log-entry">
                  <span className="opencode-log-time">{formatTimestamp(log.timestamp)}</span>
                  <span className="opencode-log-service">[{log.service.toUpperCase()}]</span>
                  <span 
                    className="opencode-log-level"
                    style={{ color: getLogLevelColor(log.level) }}
                  >
                    {log.level.toUpperCase()}
                  </span>
                  <span className="opencode-log-message">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
      
      <div className="opencode-info">
        <p>
          <strong>Note:</strong> OpenCode must be installed separately. 
          Visit <a href="https://opencode.ai" target="_blank" rel="noopener noreferrer">opencode.ai</a> for installation instructions.
        </p>
        <p>
          Verify installation: <code>opencode --version</code>
        </p>
      </div>
    </div>
  );
};

export default OpencodeSettings;
