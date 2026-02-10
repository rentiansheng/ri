import React, { useState, useEffect } from 'react';
import { useConfigStore } from '../store/configStore';
import { NotificationTheme, themes } from '../utils/notificationThemes';
import OpencodeSettings from './Settings/OpencodeSettings';
import TerminalSettings from './Settings/TerminalSettings';
import RemoteControlSettings from './Settings/RemoteControlSettings';
import './SettingsView.css';

type SettingsSection = 'notification' | 'terminal' | 'appearance' | 'advanced' | 'opencode' | 'remoteControl' | 'editor' | 'filesView';

interface NotificationSettings {
  enabled: boolean;
  theme: NotificationTheme;
  toastDuration: number;
  maxNotificationsPerSession: number;
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
}

// Helper function to get default notification settings
const getDefaultNotificationSettings = (): NotificationSettings => ({
  enabled: true,
  theme: 'vscode',
  toastDuration: 3000,
  maxNotificationsPerSession: 3,
  channels: {
    system: { enabled: true },
    inApp: { enabled: true },
    slack: {
      enabled: false,
      webhookUrl: '',
      channel: '#notifications',
      username: 'Second Brain OS',
    },
    discord: {
      enabled: false,
      webhookUrl: '',
      username: 'Second Brain OS',
    },
    telegram: {
      enabled: false,
      botToken: '',
      chatId: '',
    },
    dingtalk: {
      enabled: false,
      webhookUrl: '',
      secret: '',
    },
    wecom: {
      enabled: false,
      webhookUrl: '',
    },
  },
});

const SettingsView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('notification');
  const [config, setConfig] = useState<any>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<NotificationTheme>('vscode');
  const [editorSettings, setEditorSettings] = useState({
    autoSave: false,
    autoSaveDelay: 2,
  });
  const [filesViewSettings, setFilesViewSettings] = useState({
    showHidden: false,
  });

  const configStore = useConfigStore();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const loadedConfig = await window.config.get();
      setConfig(loadedConfig);
      
      // Load notification settings with defaults
      const defaultSettings = getDefaultNotificationSettings();

      if (loadedConfig.notification) {
        // Merge loaded config with defaults
        setNotificationSettings({
          ...defaultSettings,
          ...loadedConfig.notification,
          channels: {
            ...defaultSettings.channels,
            ...loadedConfig.notification.channels,
          },
          theme: (loadedConfig.notification.theme as NotificationTheme) || 'vscode',
          toastDuration: loadedConfig.notification.toastDuration || 3000,
          maxNotificationsPerSession: loadedConfig.notification.maxNotificationsPerSession || 3,
        } as NotificationSettings);
        setSelectedTheme((loadedConfig.notification.theme as NotificationTheme) || 'vscode');
      } else {
        // Use default settings if notification config doesn't exist
        setNotificationSettings(defaultSettings);
        setSelectedTheme('vscode');
      }

      // Load editor settings
      if (loadedConfig.editor) {
        setEditorSettings({
          autoSave: loadedConfig.editor.autoSave ?? false,
          autoSaveDelay: loadedConfig.editor.autoSaveDelay ?? 2,
        });
      }

      // Load files view settings
      if (loadedConfig.fileManager) {
        setFilesViewSettings({
          showHidden: loadedConfig.fileManager.showHidden ?? false,
        });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      showMessage('error', 'Failed to load configuration');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedConfig = {
        ...config,
        notification: notificationSettings,
        editor: editorSettings,
        fileManager: {
          ...config?.fileManager,
          showHidden: filesViewSettings.showHidden,
        },
      };
      
      const result = await window.config.update(updatedConfig);
      if (result.success) {
        setConfig(result.config);
        useConfigStore.getState().loadConfig();
        showMessage('success', 'Settings saved successfully');
      } else {
        showMessage('error', result.error || 'Failed to save settings');
      }
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all settings to default?')) {
      return;
    }
    
    setIsSaving(true);
    try {
      const result = await window.config.reset();
      if (result.success && result.config) {
        setConfig(result.config);
        
        // Use defaults if notification config doesn't exist after reset
        const defaultSettings = getDefaultNotificationSettings();

        if (result.config.notification) {
          setNotificationSettings({
            ...defaultSettings,
            ...result.config.notification,
            channels: {
              ...defaultSettings.channels,
              ...result.config.notification.channels,
            },
            theme: (result.config.notification.theme as NotificationTheme) || 'vscode',
            toastDuration: result.config.notification.toastDuration || 3000,
            maxNotificationsPerSession: result.config.notification.maxNotificationsPerSession || 3,
          } as NotificationSettings);
          setSelectedTheme((result.config.notification.theme as NotificationTheme) || 'vscode');
        } else {
          setNotificationSettings(defaultSettings);
          setSelectedTheme('vscode');
        }
        
        showMessage('success', 'Settings reset to default');
      } else {
        showMessage('error', result.error || 'Failed to reset settings');
      }
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to reset settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestChannel = async (channelType: string) => {
    console.log('[SettingsView] Test channel clicked:', channelType);
    try {
      console.log('[SettingsView] Calling window.notification.testChannel...');
      const result = await window.notification.testChannel(channelType);
      console.log('[SettingsView] Test result:', result);
      if (result.success) {
        showMessage('success', `${channelType} test successful!`);
      } else {
        showMessage('error', result.error || `${channelType} test failed`);
      }
    } catch (error: any) {
      console.error('[SettingsView] Test error:', error);
      showMessage('error', error.message || 'Test failed');
    }
  };

  const updateNotificationSetting = (path: string, value: any) => {
    if (!notificationSettings) return;
    
    const keys = path.split('.');
    const updated = { ...notificationSettings };
    let current: any = updated;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...current[keys[i]] };
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setNotificationSettings(updated);
  };

  const renderNotificationSettings = () => {
    if (!notificationSettings) {
      return (
        <div className="settings-section-content">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '200px',
            color: '#888',
            fontSize: '0.9rem'
          }}>
            Loading notification settings...
          </div>
        </div>
      );
    }

    return (
      <div className="settings-section-content">
        <div className="settings-group">
          <h3>General</h3>
          
          <div className="settings-item">
            <div className="settings-item-label">
              <label>Enable Notifications</label>
              <span className="settings-item-description">
                Master switch for all notifications
              </span>
            </div>
            <div className="settings-item-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notificationSettings.enabled}
                  onChange={(e) => updateNotificationSetting('enabled', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-label">
              <label>Toast Duration</label>
              <span className="settings-item-description">
                How long toast notifications stay visible (milliseconds)
              </span>
            </div>
            <div className="settings-item-control">
              <input
                type="number"
                min="1000"
                max="10000"
                step="500"
                value={notificationSettings.toastDuration || 3000}
                onChange={(e) => updateNotificationSetting('toastDuration', parseInt(e.target.value))}
                className="settings-input-number"
              />
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-label">
              <label>Max Notifications Per Session</label>
              <span className="settings-item-description">
                Maximum number of notifications to keep per session
              </span>
            </div>
            <div className="settings-item-control">
              <input
                type="number"
                min="1"
                max="10"
                value={notificationSettings.maxNotificationsPerSession || 3}
                onChange={(e) => updateNotificationSetting('maxNotificationsPerSession', parseInt(e.target.value))}
                className="settings-input-number"
              />
            </div>
          </div>
        </div>

        <div className="settings-group">
          <h3>Theme</h3>
          
          <div className="theme-selector">
            {Object.entries(themes).map(([key, theme]) => (
              <div
                key={key}
                className={`theme-card ${selectedTheme === key ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedTheme(key as NotificationTheme);
                  updateNotificationSetting('theme', key);
                }}
              >
                <div className="theme-preview">
                  <div
                    className="theme-preview-bar"
                    style={{
                      background: `linear-gradient(90deg, ${theme.colors.info}, ${theme.colors.success}, ${theme.colors.warning}, ${theme.colors.error})`,
                      borderRadius: theme.borderRadius,
                    }}
                  ></div>
                </div>
                <div className="theme-name">{theme.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-group">
          <h3>Channels</h3>
          
          {/* System Notifications */}
          <div className="settings-item">
            <div className="settings-item-label">
              <label>System Notifications</label>
              <span className="settings-item-description">
                Show notifications in macOS Notification Center
              </span>
            </div>
            <div className="settings-item-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notificationSettings.channels.system.enabled}
                  onChange={(e) => updateNotificationSetting('channels.system.enabled', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* In-App Toast */}
          <div className="settings-item">
            <div className="settings-item-label">
              <label>In-App Toast</label>
              <span className="settings-item-description">
                Show toast notifications in bottom-right corner
              </span>
            </div>
            <div className="settings-item-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notificationSettings.channels.inApp.enabled}
                  onChange={(e) => updateNotificationSetting('channels.inApp.enabled', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* External Channels */}
        <div className="settings-group">
          <h3>External Integrations</h3>

          {/* Slack */}
          <div className="settings-subsection">
            <div className="settings-subsection-header">
              <div className="settings-item-label">
                <label>Slack</label>
                <span className="settings-item-description">Send notifications to Slack workspace</span>
              </div>
              <div className="settings-item-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notificationSettings.channels.slack.enabled}
                    onChange={(e) => updateNotificationSetting('channels.slack.enabled', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {notificationSettings.channels.slack.enabled && (
              <div className="settings-subsection-content">
                <div className="settings-input-group">
                  <label>Webhook URL</label>
                  <input
                    type="text"
                    placeholder="https://hooks.slack.com/services/..."
                    value={notificationSettings.channels.slack.webhookUrl}
                    onChange={(e) => updateNotificationSetting('channels.slack.webhookUrl', e.target.value)}
                    className="settings-input"
                  />
                </div>
                <div className="settings-input-group">
                  <label>Channel</label>
                  <input
                    type="text"
                    placeholder="#notifications"
                    value={notificationSettings.channels.slack.channel}
                    onChange={(e) => updateNotificationSetting('channels.slack.channel', e.target.value)}
                    className="settings-input"
                  />
                </div>
                <div className="settings-input-group">
                  <label>Username</label>
                  <input
                    type="text"
                    placeholder="Second Brain OS"
                    value={notificationSettings.channels.slack.username}
                    onChange={(e) => updateNotificationSetting('channels.slack.username', e.target.value)}
                    className="settings-input"
                  />
                </div>
                <button
                  className="settings-btn-test"
                  onClick={() => handleTestChannel('slack')}
                >
                  Test Slack Integration
                </button>
              </div>
            )}
          </div>

          {/* Discord */}
          <div className="settings-subsection">
            <div className="settings-subsection-header">
              <div className="settings-item-label">
                <label>Discord</label>
                <span className="settings-item-description">Send notifications to Discord server</span>
              </div>
              <div className="settings-item-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notificationSettings.channels.discord.enabled}
                    onChange={(e) => updateNotificationSetting('channels.discord.enabled', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {notificationSettings.channels.discord.enabled && (
              <div className="settings-subsection-content">
                <div className="settings-input-group">
                  <label>Webhook URL</label>
                  <input
                    type="text"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={notificationSettings.channels.discord.webhookUrl}
                    onChange={(e) => updateNotificationSetting('channels.discord.webhookUrl', e.target.value)}
                    className="settings-input"
                  />
                </div>
                <div className="settings-input-group">
                  <label>Username</label>
                  <input
                    type="text"
                    placeholder="Second Brain OS"
                    value={notificationSettings.channels.discord.username}
                    onChange={(e) => updateNotificationSetting('channels.discord.username', e.target.value)}
                    className="settings-input"
                  />
                </div>
                <button
                  className="settings-btn-test"
                  onClick={() => handleTestChannel('discord')}
                >
                  Test Discord Integration
                </button>
              </div>
            )}
          </div>

          {/* Telegram */}
          <div className="settings-subsection">
            <div className="settings-subsection-header">
              <div className="settings-item-label">
                <label>Telegram</label>
                <span className="settings-item-description">Send notifications to Telegram channels or groups</span>
              </div>
              <div className="settings-item-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notificationSettings.channels.telegram.enabled}
                    onChange={(e) => updateNotificationSetting('channels.telegram.enabled', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {notificationSettings.channels.telegram.enabled && (
              <div className="settings-subsection-content">
                <div className="settings-input-group">
                  <label>Bot Token</label>
                  <input
                    type="password"
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    value={notificationSettings.channels.telegram.botToken}
                    onChange={(e) => updateNotificationSetting('channels.telegram.botToken', e.target.value)}
                    className="settings-input"
                  />
                </div>
                <div className="settings-input-group">
                  <label>Chat ID</label>
                  <input
                    type="text"
                    placeholder="-1001234567890"
                    value={notificationSettings.channels.telegram.chatId}
                    onChange={(e) => updateNotificationSetting('channels.telegram.chatId', e.target.value)}
                    className="settings-input"
                  />
                </div>
                <button
                  className="settings-btn-test"
                  onClick={() => handleTestChannel('telegram')}
                >
                  Test Telegram Integration
                </button>
              </div>
            )}
          </div>

          {/* DingTalk */}
          <div className="settings-subsection">
            <div className="settings-subsection-header">
              <div className="settings-item-label">
                <label>DingTalk (钉钉)</label>
                <span className="settings-item-description">Send notifications to DingTalk groups</span>
              </div>
              <div className="settings-item-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notificationSettings.channels.dingtalk.enabled}
                    onChange={(e) => updateNotificationSetting('channels.dingtalk.enabled', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {notificationSettings.channels.dingtalk.enabled && (
              <div className="settings-subsection-content">
                <div className="settings-input-group">
                  <label>Webhook URL</label>
                  <input
                    type="text"
                    placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                    value={notificationSettings.channels.dingtalk.webhookUrl}
                    onChange={(e) => updateNotificationSetting('channels.dingtalk.webhookUrl', e.target.value)}
                    className="settings-input"
                  />
                </div>
                <div className="settings-input-group">
                  <label>Secret (Optional)</label>
                  <input
                    type="password"
                    placeholder="SEC..."
                    value={notificationSettings.channels.dingtalk.secret}
                    onChange={(e) => updateNotificationSetting('channels.dingtalk.secret', e.target.value)}
                    className="settings-input"
                  />
                </div>
                <button
                  className="settings-btn-test"
                  onClick={() => handleTestChannel('dingtalk')}
                >
                  Test DingTalk Integration
                </button>
              </div>
            )}
          </div>

          {/* WeCom (Enterprise WeChat) */}
          <div className="settings-subsection">
            <div className="settings-subsection-header">
              <div className="settings-item-label">
                <label>WeCom (企业微信)</label>
                <span className="settings-item-description">Send notifications to Enterprise WeChat groups</span>
              </div>
              <div className="settings-item-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notificationSettings.channels.wecom.enabled}
                    onChange={(e) => updateNotificationSetting('channels.wecom.enabled', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {notificationSettings.channels.wecom.enabled && (
              <div className="settings-subsection-content">
                <div className="settings-input-group">
                  <label>Webhook URL</label>
                  <input
                    type="text"
                    placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                    value={notificationSettings.channels.wecom.webhookUrl}
                    onChange={(e) => updateNotificationSetting('channels.wecom.webhookUrl', e.target.value)}
                    className="settings-input"
                  />
                </div>
                <button
                  className="settings-btn-test"
                  onClick={() => handleTestChannel('wecom')}
                >
                  Test WeCom Integration
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderEditorSettings = () => {
    return (
      <div className="settings-section-content">
        <div className="settings-group">
          <h3>Auto Save</h3>
          
          <div className="settings-item">
            <div className="settings-item-label">
              <label>Enable Auto Save</label>
              <span className="settings-item-description">
                Automatically save files after changes
              </span>
            </div>
            <div className="settings-item-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={editorSettings.autoSave}
                  onChange={(e) => setEditorSettings(prev => ({ ...prev, autoSave: e.target.checked }))}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-label">
              <label>Auto Save Delay</label>
              <span className="settings-item-description">
                Delay in seconds before auto-saving
              </span>
            </div>
            <div className="settings-item-control">
              <input
                type="number"
                min="1"
                max="30"
                step="1"
                value={editorSettings.autoSaveDelay}
                onChange={(e) => setEditorSettings(prev => ({ ...prev, autoSaveDelay: parseInt(e.target.value) || 2 }))}
                className="settings-input-number"
                disabled={!editorSettings.autoSave}
              />
              <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>s</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFilesViewSettings = () => {
    return (
      <div className="settings-section-content">
        <div className="settings-group">
          <h3>显示设置</h3>
          
          <div className="settings-item">
            <div className="settings-item-label">
              <label>显示隐藏文件</label>
              <span className="settings-item-description">
                默认显示以 . 开头的隐藏文件（右键菜单可临时切换当前目录）
              </span>
            </div>
            <div className="settings-item-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={filesViewSettings.showHidden}
                  onChange={(e) => setFilesViewSettings(prev => ({ ...prev, showHidden: e.target.checked }))}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'notification':
        return renderNotificationSettings();
      case 'opencode':
        return <OpencodeSettings />;
      case 'remoteControl':
        return <RemoteControlSettings />;
      case 'terminal':
        return <TerminalSettings />;
      case 'editor':
        return renderEditorSettings();
      case 'filesView':
        return renderFilesViewSettings();
      case 'appearance':
        return <div className="settings-section-content">Appearance settings coming soon...</div>;
      case 'advanced':
        return <div className="settings-section-content">Advanced settings coming soon...</div>;
      default:
        return null;
    }
  };

  // Helper function to get section display name
  const getSectionName = (section: SettingsSection): string => {
    switch (section) {
      case 'notification':
        return 'Notifications';
      case 'opencode':
        return 'OpenCode';
      case 'remoteControl':
        return 'Remote Control';
      case 'terminal':
        return 'Terminal';
      case 'editor':
        return 'Editor';
      case 'filesView':
        return 'Files View';
      case 'appearance':
        return 'Appearance';
      case 'advanced':
        return 'Advanced';
      default:
        return section;
    }
  };

  return (
    <div className="settings-view" data-testid="settings-view">
      {/* Header */}
      <div className="settings-header">
        <h3>SETTINGS</h3>
        <div className="settings-header-actions">
          {saveMessage && (
            <div className={`settings-message settings-message-${saveMessage.type}`}>
              {saveMessage.text}
            </div>
          )}
          <button
            className="settings-btn-secondary"
            onClick={handleReset}
            disabled={isSaving}
          >
            Reset to Default
          </button>
          <button
            className="settings-btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="settings-body">
        <div className="settings-sidebar">
          <button
            className={`settings-nav-item ${activeSection === 'notification' ? 'active' : ''}`}
            onClick={() => setActiveSection('notification')}
            data-testid="settings-tab-notification"
          >
            <span className="settings-nav-icon">🔔</span>
            <span className="settings-nav-label">Notifications</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'opencode' ? 'active' : ''}`}
            onClick={() => setActiveSection('opencode')}
            data-testid="settings-tab-opencode"
          >
            <span className="settings-nav-icon">🤖</span>
            <span className="settings-nav-label">OpenCode</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'remoteControl' ? 'active' : ''}`}
            onClick={() => setActiveSection('remoteControl')}
            data-testid="settings-tab-remote-control"
          >
            <span className="settings-nav-icon">📡</span>
            <span className="settings-nav-label">Remote Control</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveSection('terminal')}
            data-testid="settings-tab-terminal"
          >
            <span className="settings-nav-icon">💻</span>
            <span className="settings-nav-label">Terminal</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveSection('editor')}
            data-testid="settings-tab-editor"
          >
            <span className="settings-nav-icon">📝</span>
            <span className="settings-nav-label">Editor</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'filesView' ? 'active' : ''}`}
            onClick={() => setActiveSection('filesView')}
            data-testid="settings-tab-files-view"
          >
            <span className="settings-nav-icon">📁</span>
            <span className="settings-nav-label">Files View</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveSection('appearance')}
            data-testid="settings-tab-appearance"
          >
            <span className="settings-nav-icon">🎨</span>
            <span className="settings-nav-label">Appearance</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveSection('advanced')}
            data-testid="settings-tab-advanced"
          >
            <span className="settings-nav-icon">⚙️</span>
            <span className="settings-nav-label">Advanced</span>
          </button>
        </div>

        <div className="settings-content">
          {renderSection()}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
