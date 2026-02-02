import React, { useState, useEffect, useRef } from 'react';
import { useConfigStore } from '../../store/configStore';
import { useNotifyStore } from '../../store/notifyStore';
import { OpencodeStatus, OpencodeLogEntry, OpencodePluginInfo, OpencodeInstallation } from '../../types/global';
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
  
  // Plugin state
  const [pluginInfo, setPluginInfo] = useState<{
    plugin?: OpencodePluginInfo;
    opencode?: { installed: boolean; version: string | null };
  } | null>(null);
  const [pluginInstalling, setPluginInstalling] = useState(false);
  
  // Plugin configuration status
  const [configStatus, setConfigStatus] = useState<{
    enabled: boolean;
    configExists: boolean;
    configValid: boolean;
  } | null>(null);
  
  // Installation detection state
  const [installations, setInstallations] = useState<OpencodeInstallation[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showAddCustomPath, setShowAddCustomPath] = useState(false);
  const [customPathInput, setCustomPathInput] = useState('');
  
  // Refs
  const logsEndRef = useRef<HTMLDivElement>(null);
  const statusCleanupRef = useRef<(() => void) | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  
  // Load config and status on mount
  useEffect(() => {
    loadConfig();
    loadStatus();
    loadLogs();
    loadPluginInfo();
    
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
  
  const loadPluginInfo = async () => {
    try {
      const result = await window.opencodePlugin.getInfo();
      if (result.success) {
        setPluginInfo({
          plugin: result.plugin,
          opencode: result.opencode,
        });
        
        // 本地插件会被 OpenCode 自动发现，无需检查配置状态
        
        // Load cached installations if OpenCode is installed
        if (result.opencode?.installed) {
          await loadCachedInstallations();
        }
      }
    } catch (error) {
      console.error('Failed to load plugin info:', error);
    }
  };
  
  // Load cached installations or auto-detect on first time
  const loadCachedInstallations = async () => {
    try {
      const result = await window.opencodePlugin.getCached();
      if (result.success) {
        if (result.installations.length === 0) {
          // First time - no cache, auto-detect
          console.log('[OpencodeSettings] No cache found, triggering auto-detection');
          await handleDetectInstallations();
        } else {
          // Has cache - display directly
          console.log('[OpencodeSettings] Loaded from cache:', result.installations.length);
          setInstallations(result.installations);
        }
      }
    } catch (error) {
      console.error('Failed to load cached installations:', error);
      // Fallback to auto-detect
      await handleDetectInstallations();
    }
  };
  
  // Detect all OpenCode installations
  const handleDetectInstallations = async () => {
    setIsDetecting(true);
    try {
      const result = await window.opencodePlugin.detectAll();
      if (result.success) {
        setInstallations(result.installations);
        
        if (result.installations.length === 0) {
          notifyStore.addNotification({
            id: Date.now().toString(),
            sessionId: 'opencode',
            sessionName: 'OpenCode',
            title: 'No Installations Found',
            body: 'Could not detect any OpenCode installations. Try adding a custom path.',
            type: 'warning',
            timestamp: Date.now(),
            read: false
          });
        } else {
          // Success notification
          notifyStore.addNotification({
            id: Date.now().toString(),
            sessionId: 'opencode',
            sessionName: 'OpenCode',
            title: 'Detection Complete',
            body: `Found ${result.installations.length} OpenCode installation${result.installations.length > 1 ? 's' : ''}`,
            type: 'success',
            timestamp: Date.now(),
            read: false
          });
          console.log(`[OpencodeSettings] Found ${result.installations.length} OpenCode installation(s)`);
        }
      }
    } catch (error: any) {
      notifyStore.addNotification({
        id: Date.now().toString(),
        sessionId: 'opencode',
        sessionName: 'OpenCode',
        title: 'Detection Failed',
        body: error.message,
        type: 'error',
        timestamp: Date.now(),
        read: false
      });
    } finally {
      setIsDetecting(false);
    }
  };

  // Set active installation
  const handleSetActiveInstallation = async (installationId: string) => {
    try {
      const result = await window.opencodePlugin.setActive(installationId);
      if (result.success) {
        // Update local state
        setInstallations(prev => prev.map(inst => ({
          ...inst,
          isActive: inst.id === installationId
        })));
        
        notifyStore.addNotification({
          id: Date.now().toString(),
          sessionId: 'opencode',
          sessionName: 'OpenCode',
          title: 'Active Installation Changed',
          body: 'OpenCode installation selected successfully',
          type: 'success',
          timestamp: Date.now(),
          read: false
        });
        
        // Reload plugin info
        await loadPluginInfo();
      } else {
        throw new Error(result.error || 'Failed to set active');
      }
    } catch (error: any) {
      notifyStore.addNotification({
        id: Date.now().toString(),
        sessionId: 'opencode',
        sessionName: 'OpenCode',
        title: 'Failed to Set Active',
        body: error.message,
        type: 'error',
        timestamp: Date.now(),
        read: false
      });
    }
  };

  // Add custom path
  const handleAddCustomPath = async () => {
    if (!customPathInput.trim()) return;
    
    try {
      const result = await window.opencodePlugin.addCustomPath(customPathInput);
      if (result.success && result.installation) {
        setInstallations(prev => [...prev, result.installation!]);
        setCustomPathInput('');
        setShowAddCustomPath(false);
        
        notifyStore.addNotification({
          id: Date.now().toString(),
          sessionId: 'opencode',
          sessionName: 'OpenCode',
          title: 'Custom Path Added',
          body: `Added: ${customPathInput}`,
          type: 'success',
          timestamp: Date.now(),
          read: false
        });
      } else {
        throw new Error(result.error || 'Invalid path');
      }
    } catch (error: any) {
      notifyStore.addNotification({
        id: Date.now().toString(),
        sessionId: 'opencode',
        sessionName: 'OpenCode',
        title: 'Add Path Failed',
        body: error.message,
        type: 'error',
        timestamp: Date.now(),
        read: false
      });
    }
  };

  // Remove custom path
  const handleRemoveCustomPath = async (customPath: string) => {
    if (!confirm(`Remove custom path: ${customPath}?`)) return;
    
    try {
      const result = await window.opencodePlugin.removeCustomPath(customPath);
      if (result.success) {
        setInstallations(prev => prev.filter(inst => inst.path !== customPath));
        
        notifyStore.addNotification({
          id: Date.now().toString(),
          sessionId: 'opencode',
          sessionName: 'OpenCode',
          title: 'Custom Path Removed',
          body: `Removed: ${customPath}`,
          type: 'success',
          timestamp: Date.now(),
          read: false
        });
        
        // Reload plugin info
        await loadPluginInfo();
      }
    } catch (error: any) {
      notifyStore.addNotification({
        id: Date.now().toString(),
        sessionId: 'opencode',
        sessionName: 'OpenCode',
        title: 'Remove Failed',
        body: error.message,
        type: 'error',
        timestamp: Date.now(),
        read: false
      });
    }
  };
  
  const handleShowAddCustomPath = () => {
    setShowAddCustomPath(true);
    setCustomPathInput('');
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
  
  const handleInstallPlugin = async () => {
    setPluginInstalling(true);
    try {
      const result = await window.opencodePlugin.install();
      if (result.success) {
        // Check if configuration was updated
        if (result.configUpdated) {
          notifyStore.addNotification({
            id: Date.now().toString(),
            sessionId: 'opencode',
            sessionName: 'OpenCode',
            title: 'Plugin Installed & Configured',
            body: 'OpenCode RI notification plugin installed and enabled successfully',
            type: 'success',
            timestamp: Date.now(),
            read: false
          });
        } else if (result.warning) {
          notifyStore.addNotification({
            id: Date.now().toString(),
            sessionId: 'opencode',
            sessionName: 'OpenCode',
            title: 'Plugin Installed',
            body: result.warning,
            type: 'warning',
            timestamp: Date.now(),
            read: false
          });
        } else {
          notifyStore.addNotification({
            id: Date.now().toString(),
            sessionId: 'opencode',
            sessionName: 'OpenCode',
            title: 'Plugin Installed',
            body: 'OpenCode RI notification plugin installed successfully',
            type: 'success',
            timestamp: Date.now(),
            read: false
          });
        }
        
        // Reload plugin info
        await loadPluginInfo();
      } else {
        throw new Error(result.error || 'Installation failed');
      }
    } catch (error: any) {
      notifyStore.addNotification({
        id: Date.now().toString(),
        sessionId: 'opencode',
        sessionName: 'OpenCode',
        title: 'Plugin Install Failed',
        body: error.message || 'Failed to install plugin',
        type: 'error',
        timestamp: Date.now(),
        read: false
      });
    } finally {
      setPluginInstalling(false);
    }
  };

  const handleReinstallPlugin = async () => {
    if (!confirm('Reinstall the plugin? This will replace the existing installation.')) {
      return;
    }
    await handleInstallPlugin();
  };

  const handleOpenPluginDir = async () => {
    try {
      await window.opencodePlugin.openDir();
    } catch (error: any) {
      notifyStore.addNotification({
        id: Date.now().toString(),
        sessionId: 'opencode',
        sessionName: 'OpenCode',
        title: 'Error',
        body: error.message || 'Failed to open plugin directory',
        type: 'error',
        timestamp: Date.now(),
        read: false
      });
    }
  };

  const handleOpenPluginDocs = async () => {
    try {
      await window.opencodePlugin.openDocs();
    } catch (error: any) {
      notifyStore.addNotification({
        id: Date.now().toString(),
        sessionId: 'opencode',
        sessionName: 'OpenCode',
        title: 'Error',
        body: error.message || 'Failed to open plugin documentation',
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
      
      {/* RI Notification Plugin - Hidden */}
      <div className="opencode-section" style={{ display: 'none' }}>
        <h3>RI Notification Plugin</h3>
        
        <div className="opencode-plugin-info">
          <p className="opencode-plugin-description">
            让 OpenCode 完成任务时自动通知到 RI。插件会自动检测 RI 终端环境，
            在其他终端中不会影响 OpenCode 的正常使用。
          </p>
          
          {/* OpenCode Installation Detection & Management */}
          <div className="opencode-installations-section">
            <h4>OpenCode Installation Management</h4>
            
            <div className="opencode-detect-actions">
              <button 
                className="opencode-btn-detect"
                onClick={handleDetectInstallations}
                disabled={isDetecting}
              >
                {isDetecting ? 'Detecting...' : '🔍 Detect OpenCode Installations'}
              </button>
              
              <button 
                className="opencode-btn-add-custom"
                onClick={handleShowAddCustomPath}
              >
                ➕ Add Custom Path
              </button>
            </div>
            
            {/* Installations List */}
            {installations.length > 0 ? (
              <div className="opencode-installations-list">
                <p className="opencode-installations-count">
                  Found {installations.length} OpenCode installation{installations.length > 1 ? 's' : ''}
                </p>
                
                {installations.map((inst) => (
                  <div 
                    key={inst.id} 
                    className={`opencode-installation-item ${inst.isActive ? 'active' : ''}`}
                  >
                    <div className="opencode-installation-header">
                      <label className="opencode-installation-radio">
                        <input
                          type="radio"
                          name="active-opencode"
                          checked={inst.isActive}
                          onChange={() => handleSetActiveInstallation(inst.id)}
                        />
                        <span className="opencode-installation-path">{inst.path}</span>
                      </label>
                      {inst.source === 'manual' && (
                        <button 
                          className="opencode-btn-remove-custom"
                          onClick={() => handleRemoveCustomPath(inst.path)}
                          title="Remove custom path"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    
                    <div className="opencode-installation-details">
                      <span className="opencode-installation-badge opencode-installation-version">
                        Version: {inst.version || 'Unknown'}
                      </span>
                      <span className={`opencode-installation-badge opencode-installation-source opencode-source-${inst.source}`}>
                        Source: {inst.source}
                      </span>
                    </div>
                    
                    <div className="opencode-installation-plugin-dir" title={inst.pluginDir}>
                      Plugin Directory: {inst.pluginDir}
                    </div>
                  </div>
                ))}
              </div>
            ) : isDetecting ? (
              <div className="opencode-installations-empty">
                Detecting OpenCode installations...
              </div>
            ) : (
              <div className="opencode-installations-empty">
                No OpenCode installations detected. Click "🔍 Detect" to search or add a custom path.
              </div>
            )}
            
            {/* Add Custom Path Dialog */}
            {showAddCustomPath && (
              <div className="opencode-custom-path-dialog">
                <input
                  type="text"
                  placeholder="/path/to/opencode (e.g., /usr/local/bin/opencode)"
                  value={customPathInput}
                  onChange={(e) => setCustomPathInput(e.target.value)}
                  className="opencode-custom-path-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCustomPath();
                    } else if (e.key === 'Escape') {
                      setShowAddCustomPath(false);
                    }
                  }}
                  autoFocus
                />
                <div className="opencode-custom-path-actions">
                  <button 
                    className="opencode-btn-primary"
                    onClick={handleAddCustomPath}
                    disabled={!customPathInput.trim()}
                  >
                    Add
                  </button>
                  <button 
                    className="opencode-btn-secondary"
                    onClick={() => setShowAddCustomPath(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {!pluginInfo ? (
            <div className="opencode-plugin-loading">Loading plugin status...</div>
          ) : !pluginInfo.opencode?.installed ? (
            <div className="opencode-plugin-warning">
              <span className="opencode-plugin-warning-icon">⚠️</span>
              <div>
                <strong>OpenCode Not Detected</strong>
                <p>
                  OpenCode is not installed or not in PATH. Install OpenCode first:
                  <br />
                  <code>curl -fsSL https://opencode.ai/install | bash</code>
                </p>
              </div>
            </div>
          ) : (
            <div className="opencode-plugin-status">
              <div className="opencode-plugin-status-row">
                <div className="opencode-plugin-status-label">
                  <span className="opencode-plugin-status-icon">
                    {pluginInfo.plugin?.installed ? '✅' : '○'}
                  </span>
                  <span>Plugin Status</span>
                </div>
                <div className="opencode-plugin-status-value">
                  {pluginInfo.plugin?.installed ? (
                    <>
                      <span className="opencode-plugin-status-installed">Installed</span>
                      {pluginInfo.plugin.version && (
                        <span className="opencode-plugin-version">v{pluginInfo.plugin.version}</span>
                      )}
                    </>
                  ) : (
                    <span className="opencode-plugin-status-not-installed">Not Installed</span>
                  )}
                </div>
              </div>
              
              {pluginInfo.plugin?.installed && (
                <div className="opencode-plugin-status-row">
                  <div className="opencode-plugin-status-label">
                    <span>Plugin Path</span>
                  </div>
                  <div className="opencode-plugin-status-value">
                    <code className="opencode-plugin-path">{pluginInfo.plugin.path}</code>
                  </div>
                </div>
              )}
              
              {/* Configuration Status - Hidden */}
              {false && pluginInfo.plugin?.installed && configStatus && (
                <div className="opencode-plugin-config-status">
                  <h4>Configuration Status</h4>
                  
                  <div className="opencode-config-status-grid">
                    <div className="opencode-config-status-item">
                      <span className="opencode-config-label">Config File:</span>
                      <span className={`opencode-config-value ${configStatus.configExists ? 'ok' : 'missing'}`}>
                        {configStatus.configExists ? '✓ Exists' : '✗ Missing'}
                      </span>
                    </div>
                    
                    <div className="opencode-config-status-item">
                      <span className="opencode-config-label">Format:</span>
                      <span className={`opencode-config-value ${configStatus.configValid ? 'ok' : 'invalid'}`}>
                        {configStatus.configValid ? '✓ Valid' : '✗ Invalid'}
                      </span>
                    </div>
                    
                    <div className="opencode-config-status-item">
                      <span className="opencode-config-label">Plugin Enabled:</span>
                      <span className={`opencode-config-value ${configStatus.enabled ? 'ok' : 'disabled'}`}>
                        {configStatus.enabled ? '✓ Yes' : '✗ No'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Warning if plugin not enabled */}
                  {!configStatus.enabled && (
                    <div className="opencode-config-warning">
                      <span className="warning-icon">⚠️</span>
                      <div className="warning-content">
                        <strong>Plugin Not Enabled</strong>
                        <p>The plugin files are installed but not enabled in OpenCode configuration.</p>
                      </div>
                      <button
                        className="opencode-btn-fix"
                        onClick={async () => {
                          try {
                            const result = await window.opencodePlugin.enableConfig();
                            if (result.success) {
                              notifyStore.addNotification({
                                id: Date.now().toString(),
                                sessionId: 'opencode',
                                sessionName: 'OpenCode',
                                title: 'Configuration Updated',
                                body: 'Plugin enabled in OpenCode configuration',
                                type: 'success',
                                timestamp: Date.now(),
                                read: false
                              });
                              await loadPluginInfo();
                            } else {
                              throw new Error(result.error || 'Failed to enable config');
                            }
                          } catch (error: any) {
                            notifyStore.addNotification({
                              id: Date.now().toString(),
                              sessionId: 'opencode',
                              sessionName: 'OpenCode',
                              title: 'Failed to Update Config',
                              body: error.message,
                              type: 'error',
                              timestamp: Date.now(),
                              read: false
                            });
                          }
                        }}
                      >
                        Enable Now
                      </button>
                    </div>
                  )}
                  
                  {/* Manual configuration actions */}
                  <div className="opencode-config-actions">
                    <button
                      className="opencode-btn-secondary"
                      onClick={() => window.opencodePlugin.openConfig()}
                      title="Open OpenCode configuration file"
                    >
                      📝 Edit Config Manually
                    </button>
                    
                    {configStatus.enabled && (
                      <button
                        className="opencode-btn-secondary"
                        onClick={async () => {
                          if (confirm('Disable plugin in OpenCode configuration?')) {
                            try {
                              const result = await window.opencodePlugin.disableConfig();
                              if (result.success) {
                                notifyStore.addNotification({
                                  id: Date.now().toString(),
                                  sessionId: 'opencode',
                                  sessionName: 'OpenCode',
                                  title: 'Configuration Updated',
                                  body: 'Plugin disabled in OpenCode configuration',
                                  type: 'success',
                                  timestamp: Date.now(),
                                  read: false
                                });
                                await loadPluginInfo();
                              } else {
                                throw new Error(result.error || 'Failed to disable config');
                              }
                            } catch (error: any) {
                              notifyStore.addNotification({
                                id: Date.now().toString(),
                                sessionId: 'opencode',
                                sessionName: 'OpenCode',
                                title: 'Failed to Update Config',
                                body: error.message,
                                type: 'error',
                                timestamp: Date.now(),
                                read: false
                              });
                            }
                          }
                        }}
                        title="Remove plugin from configuration"
                      >
                        Disable Plugin
                      </button>
                    )}
                  </div>
                  
                  {/* Backup info */}
                  <div className="opencode-backup-info">
                    <small>
                      💾 Configuration changes are automatically backed up to{' '}
                      <code>~/.config/opencode/opencode.json.backup.*</code>
                    </small>
                  </div>
                </div>
              )}
              
              <div className="opencode-plugin-actions">
                {pluginInfo.plugin?.installed ? (
                  <>
                    <button
                      className="opencode-btn-secondary"
                      onClick={handleReinstallPlugin}
                      disabled={pluginInstalling}
                    >
                      {pluginInstalling ? 'Installing...' : 'Reinstall Plugin'}
                    </button>
                    <button
                      className="opencode-btn-secondary"
                      onClick={handleOpenPluginDir}
                    >
                      Open Plugin Directory
                    </button>
                    <button
                      className="opencode-btn-secondary"
                      onClick={handleOpenPluginDocs}
                    >
                      View Documentation
                    </button>
                  </>
                ) : (
                  <button
                    className="opencode-btn-primary"
                    onClick={handleInstallPlugin}
                    disabled={pluginInstalling}
                  >
                    {pluginInstalling ? 'Installing...' : 'Install Plugin'}
                  </button>
                )}
              </div>
            </div>
          )}
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
