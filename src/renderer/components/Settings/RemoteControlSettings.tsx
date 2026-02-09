import React, { useState, useEffect } from 'react';
import { useConfigStore } from '../../store/configStore';
import type { RemoteControlStatus, RemoteControlTestResult, RemoteControlConnectionResult, RemoteControlNotificationResult, RemoteControlValidationResult } from '../../types/global';
import './RemoteControlSettings.css';

export const RemoteControlSettings: React.FC = () => {
  const { config, updateConfig } = useConfigStore();
  const [status, setStatus] = useState<RemoteControlStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<RemoteControlTestResult | null>(null);
  const [simulateCommand, setSimulateCommand] = useState('');
  const [simulateResponse, setSimulateResponse] = useState<string | null>(null);
  const [connectionResult, setConnectionResult] = useState<RemoteControlConnectionResult | null>(null);
  const [notificationResult, setNotificationResult] = useState<RemoteControlNotificationResult | null>(null);
  const [testChannelId, setTestChannelId] = useState('');
  const [validationResult, setValidationResult] = useState<RemoteControlValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  
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

  const handleRequireApprovalToggle = async () => {
    await updateConfig({
      remoteControl: { ...remoteConfig, requireApproval: !remoteConfig.requireApproval }
    });
  };

  const handleRunTest = async (testType?: string) => {
    setLoading(true);
    setError(null);
    setTestResult(null);
    try {
      const result = await window.remoteControl.test(testType);
      if (result.success && result.results) {
        setTestResult(result.results);
      } else {
        setError(result.error || 'Test failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    if (!simulateCommand.trim()) return;
    setSimulateResponse(null);
    try {
      const result = await window.remoteControl.simulate(simulateCommand);
      setSimulateResponse(result.response);
    } catch (err: unknown) {
      setSimulateResponse(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleTestConnection = async (platform: string) => {
    setLoading(true);
    setConnectionResult(null);
    setError(null);
    try {
      const result = await window.remoteControl.testConnection(platform);
      setConnectionResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestNotification = async (platform: string) => {
    setLoading(true);
    setNotificationResult(null);
    setError(null);
    try {
      const result = await window.remoteControl.sendTestNotification(platform, testChannelId || undefined);
      setNotificationResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateConfig = async () => {
    setValidating(true);
    setValidationResult(null);
    setError(null);
    try {
      const response = await window.remoteControl.validateConfig();
      if (response.success && response.result) {
        setValidationResult(response.result);
      } else {
        setError(response.error || 'Validation failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setValidating(false);
    }
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

        <div className="validate-section">
          <button
            className="validate-button"
            onClick={handleValidateConfig}
            disabled={validating || !remoteConfig.enabled}
          >
            {validating ? '🔄 Validating...' : '🔍 Validate Configuration'}
          </button>
        </div>

        {validationResult && (
          <div className="validation-results">
            <h4>Validation Results</h4>
            
            {validationResult.warnings.length > 0 && (
              <div className="validation-warnings">
                {validationResult.warnings.map((w, i) => (
                  <div key={i} className="validation-warning">
                    ⚠️ <strong>{w.field}:</strong> {w.message}
                  </div>
                ))}
              </div>
            )}

            <div className="validation-platform">
              <div className="validation-header">
                <span className={validationResult.discord.skipped ? 'status-skipped' : validationResult.discord.valid ? 'status-online' : 'status-offline'}>
                  {validationResult.discord.skipped ? '⏭️' : validationResult.discord.valid ? '✅' : '❌'} Discord
                  {validationResult.discord.skipped && <span className="skipped-hint"> (Not enabled)</span>}
                </span>
              </div>
              {validationResult.discord.errors.length > 0 && (
                <div className="validation-errors">
                  {validationResult.discord.errors.map((e, i) => (
                    <div key={i} className="validation-error">
                      <strong>{e.field}:</strong> {e.message}
                    </div>
                  ))}
                </div>
              )}
              {validationResult.discord.details && (
                <div className="validation-details">
                  <div>Bot: {validationResult.discord.details.tag}</div>
                  <div>Servers: {validationResult.discord.details.guilds} ({validationResult.discord.details.guildNames?.join(', ')})</div>
                </div>
              )}
            </div>

            <div className="validation-platform">
              <div className="validation-header">
                <span className={validationResult.slack.skipped ? 'status-skipped' : validationResult.slack.valid ? 'status-online' : 'status-offline'}>
                  {validationResult.slack.skipped ? '⏭️' : validationResult.slack.valid ? '✅' : '❌'} Slack
                  {validationResult.slack.skipped && <span className="skipped-hint"> (Not enabled)</span>}
                </span>
              </div>
              {validationResult.slack.errors.length > 0 && (
                <div className="validation-errors">
                  {validationResult.slack.errors.map((e, i) => (
                    <div key={i} className="validation-error">
                      <strong>{e.field}:</strong> {e.message}
                    </div>
                  ))}
                </div>
              )}
              {validationResult.slack.details && (
                <div className="validation-details">
                  <div>Bot: {validationResult.slack.details.user}</div>
                  <div>Team: {validationResult.slack.details.team}</div>
                </div>
              )}
            </div>
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

        <div className="test-connection-row">
          <button
            className="test-button"
            onClick={() => handleTestConnection('discord')}
            disabled={loading || !status?.discordConnected}
          >
            🔗 Test Connection
          </button>
          <button
            className="test-button"
            onClick={() => handleSendTestNotification('discord')}
            disabled={loading || !status?.discordConnected}
          >
            📤 Send Test Message
          </button>
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

        <div className="test-connection-row">
          <button
            className="test-button"
            onClick={() => handleTestConnection('slack')}
            disabled={loading || !status?.slackConnected}
          >
            🔗 Test Connection
          </button>
          <button
            className="test-button"
            onClick={() => handleSendTestNotification('slack')}
            disabled={loading || !status?.slackConnected}
          >
            📤 Send Test Message
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Security</h3>
        
        <div className="setting-row">
          <div className="setting-label">
            <span>Require Approval</span>
            <span className="setting-hint">Commands must be approved in the Remote Control panel before execution</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={remoteConfig.requireApproval || false}
              onChange={handleRequireApprovalToggle}
              disabled={!remoteConfig.enabled}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

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

      <div className="settings-section">
        <h3>🧪 Test Panel</h3>
        <p className="section-description">
          Test Remote Control locally without Discord/Slack
        </p>

        <div className="test-buttons">
          <button
            className="test-button"
            onClick={() => handleRunTest('all')}
            disabled={loading}
          >
            Run All Tests
          </button>
          <button
            className="test-button"
            onClick={() => handleRunTest('sessions')}
            disabled={loading}
          >
            Test Sessions
          </button>
          <button
            className="test-button"
            onClick={() => handleRunTest('send')}
            disabled={loading}
          >
            Test Send Command
          </button>
          <button
            className="test-button"
            onClick={() => handleRunTest('connections')}
            disabled={loading}
          >
            Test Connections
          </button>
        </div>

        {testResult && (
          <div className="test-results">
            <h4>Test Results ({testResult.timestamp})</h4>
            {testResult.tests.map((test, i) => (
              <div key={i} className={`test-result-item ${test.success ? 'success' : 'failure'}`}>
                <span className="test-name">{test.success ? '✅' : '❌'} {test.name}</span>
                {test.data && <pre className="test-data">{JSON.stringify(test.data, null, 2)}</pre>}
                {test.error && <span className="test-error">{test.error}</span>}
              </div>
            ))}
          </div>
        )}

        <div className="simulate-section">
          <h4>Simulate Command</h4>
          <div className="simulate-input-row">
            <input
              type="text"
              className="setting-input"
              placeholder="/sessions, /status, /ai hello, /select 1..."
              value={simulateCommand}
              onChange={(e) => setSimulateCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSimulate()}
            />
            <button className="test-button" onClick={handleSimulate}>
              Send
            </button>
          </div>
          {simulateResponse && (
            <pre className="simulate-response">{simulateResponse}</pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default RemoteControlSettings;
