import React, { useState, useEffect } from 'react';
import { useConfigStore } from '../../store/configStore';
import type { RemoteControlStatus } from '../../types/global';
import './RemoteControlSettings.css';

export const RemoteControlSettings: React.FC = () => {
  const { config, updateConfig } = useConfigStore();
  const [status, setStatus] = useState<RemoteControlStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const remoteConfig = config?.remoteControl || {
    enabled: false,
    discord: { enabled: false, botToken: '' },
    slack: { enabled: false, botToken: '', appToken: '' },
    allowedUsers: [],
    allowedChannels: [],
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const result = await window.remoteControl.getStatus();
      if (result.success && result.status) {
        setStatus(result.status);
      }
    } catch (err) {
      console.error('Failed to load remote control status:', err);
    }
  };

  const handleToggleEnabled = async () => {
    const newEnabled = !remoteConfig.enabled;
    await updateConfig({
      remoteControl: { ...remoteConfig, enabled: newEnabled }
    });
    
    if (newEnabled) {
      await handleInitialize();
    } else {
      await handleCleanup();
    }
  };

  const handleInitialize = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.remoteControl.initialize();
      if (!result.success) {
        setError(result.error || 'Failed to initialize');
      }
      await loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    setLoading(true);
    try {
      await window.remoteControl.cleanup();
      await loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscordToggle = async () => {
    const currentDiscord = remoteConfig.discord || { enabled: false, botToken: '' };
    await updateConfig({
      remoteControl: {
        ...remoteConfig,
        discord: { ...currentDiscord, enabled: !currentDiscord.enabled }
      }
    });
  };

  const handleDiscordTokenChange = async (token: string) => {
    const currentDiscord = remoteConfig.discord || { enabled: false, botToken: '' };
    await updateConfig({
      remoteControl: {
        ...remoteConfig,
        discord: { ...currentDiscord, botToken: token }
      }
    });
  };

  const handleSlackToggle = async () => {
    const currentSlack = remoteConfig.slack || { enabled: false, botToken: '', appToken: '' };
    await updateConfig({
      remoteControl: {
        ...remoteConfig,
        slack: { ...currentSlack, enabled: !currentSlack.enabled }
      }
    });
  };

  const handleSlackBotTokenChange = async (token: string) => {
    const currentSlack = remoteConfig.slack || { enabled: false, botToken: '', appToken: '' };
    await updateConfig({
      remoteControl: {
        ...remoteConfig,
        slack: { ...currentSlack, botToken: token }
      }
    });
  };

  const handleSlackAppTokenChange = async (token: string) => {
    const currentSlack = remoteConfig.slack || { enabled: false, botToken: '', appToken: '' };
    await updateConfig({
      remoteControl: {
        ...remoteConfig,
        slack: { ...currentSlack, appToken: token }
      }
    });
  };

  const handleAllowedUsersChange = async (value: string) => {
    const users = value.split(',').map(s => s.trim()).filter(Boolean);
    await updateConfig({
      remoteControl: { ...remoteConfig, allowedUsers: users }
    });
  };

  const handleAllowedChannelsChange = async (value: string) => {
    const channels = value.split(',').map(s => s.trim()).filter(Boolean);
    await updateConfig({
      remoteControl: { ...remoteConfig, allowedChannels: channels }
    });
  };

  return (
    <div className="remote-control-settings">
      <div className="settings-section">
        <h3>Remote Control</h3>
        <p className="section-description">
          Control AI tools remotely via Discord or Slack bots
        </p>

        <div className="setting-row">
          <div className="setting-label">
            <span>Enable Remote Control</span>
            <span className="setting-hint">Allow controlling terminal sessions via chat bots</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={remoteConfig.enabled}
              onChange={handleToggleEnabled}
              disabled={loading}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {status && (
          <div className="status-panel">
            <h4>Status</h4>
            <div className="status-row">
              <span>Discord:</span>
              <span className={status.discordConnected ? 'status-online' : 'status-offline'}>
                {status.discordConnected ? '● Online' : '○ Offline'}
              </span>
            </div>
            <div className="status-row">
              <span>Slack:</span>
              <span className={status.slackConnected ? 'status-online' : 'status-offline'}>
                {status.slackConnected ? '● Online' : '○ Offline'}
              </span>
            </div>
            {status.activeSession && (
              <div className="status-row">
                <span>Active Session:</span>
                <span>{status.activeSession.sessionId.slice(0, 8)}... ({status.activeSession.platform})</span>
              </div>
            )}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="settings-section">
        <h3>Discord Bot</h3>
        
        <div className="setting-row">
          <div className="setting-label">
            <span>Enable Discord</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={remoteConfig.discord?.enabled || false}
              onChange={handleDiscordToggle}
              disabled={!remoteConfig.enabled}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Bot Token</span>
            <span className="setting-hint">
              Get from <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">Discord Developer Portal</a>
            </span>
          </div>
          <input
            type="password"
            className="setting-input"
            placeholder="Enter Discord bot token"
            value={remoteConfig.discord?.botToken || ''}
            onChange={(e) => handleDiscordTokenChange(e.target.value)}
            disabled={!remoteConfig.enabled || !remoteConfig.discord?.enabled}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>Slack Bot</h3>
        
        <div className="setting-row">
          <div className="setting-label">
            <span>Enable Slack</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={remoteConfig.slack?.enabled || false}
              onChange={handleSlackToggle}
              disabled={!remoteConfig.enabled}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Bot Token</span>
            <span className="setting-hint">xoxb-... token from Slack App</span>
          </div>
          <input
            type="password"
            className="setting-input"
            placeholder="xoxb-..."
            value={remoteConfig.slack?.botToken || ''}
            onChange={(e) => handleSlackBotTokenChange(e.target.value)}
            disabled={!remoteConfig.enabled || !remoteConfig.slack?.enabled}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>App-Level Token</span>
            <span className="setting-hint">xapp-... token for Socket Mode</span>
          </div>
          <input
            type="password"
            className="setting-input"
            placeholder="xapp-..."
            value={remoteConfig.slack?.appToken || ''}
            onChange={(e) => handleSlackAppTokenChange(e.target.value)}
            disabled={!remoteConfig.enabled || !remoteConfig.slack?.enabled}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>Security</h3>
        
        <div className="setting-row">
          <div className="setting-label">
            <span>Allowed User IDs</span>
            <span className="setting-hint">Comma-separated list of user IDs (empty = allow all)</span>
          </div>
          <input
            type="text"
            className="setting-input"
            placeholder="user1, user2, ..."
            value={remoteConfig.allowedUsers?.join(', ') || ''}
            onChange={(e) => handleAllowedUsersChange(e.target.value)}
            disabled={!remoteConfig.enabled}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Allowed Channel IDs</span>
            <span className="setting-hint">Comma-separated list of channel IDs (empty = allow all)</span>
          </div>
          <input
            type="text"
            className="setting-input"
            placeholder="channel1, channel2, ..."
            value={remoteConfig.allowedChannels?.join(', ') || ''}
            onChange={(e) => handleAllowedChannelsChange(e.target.value)}
            disabled={!remoteConfig.enabled}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>Commands</h3>
        <div className="commands-list">
          <div className="command-item">
            <code>/ai &lt;prompt&gt;</code>
            <span>Send prompt to AI in active session</span>
          </div>
          <div className="command-item">
            <code>/sessions</code>
            <span>List available terminal sessions</span>
          </div>
          <div className="command-item">
            <code>/select &lt;n&gt;</code>
            <span>Switch to session by number or ID</span>
          </div>
          <div className="command-item">
            <code>/status</code>
            <span>Show connection status</span>
          </div>
          <div className="command-item">
            <code>/stop</code>
            <span>Send Ctrl+C to active session</span>
          </div>
          <div className="command-item">
            <code>/y or /n</code>
            <span>Send confirmation response</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemoteControlSettings;
