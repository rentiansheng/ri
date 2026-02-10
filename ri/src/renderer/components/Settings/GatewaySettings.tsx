import React, { useState, useEffect } from 'react';
import { useConfigStore } from '../../store/configStore';
import './GatewaySettings.css';

interface GatewayStatus {
  connected: boolean;
  state: string;
  gatewayURL: string;
  riID: string;
  activeSession: { sessionId: string } | null;
}

interface GatewayConfig {
  enabled: boolean;
  url: string;
  riID: string;
  pollTimeout: number;
  heartbeatInterval: number;
  reconnectInterval: number;
  maxReconnectDelay: number;
}

const defaultGatewayConfig: GatewayConfig = {
  enabled: false,
  url: 'http://localhost:8080',
  riID: '',
  pollTimeout: 30000,
  heartbeatInterval: 10000,
  reconnectInterval: 1000,
  maxReconnectDelay: 30000,
};

export const GatewaySettings: React.FC = () => {
  const { config, updateConfig } = useConfigStore();
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const gatewayConfig: GatewayConfig = {
    ...defaultGatewayConfig,
    ...config?.gateway,
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const result = await window.gateway.getStatus();
      if (result.success && result.status) {
        setStatus(result.status);
      }
    } catch (err) {
      console.error('Failed to load gateway status:', err);
    }
  };

  const handleToggleEnabled = async () => {
    const newEnabled = !gatewayConfig.enabled;
    setLoading(true);
    setError(null);

    try {
      await updateConfig({
        gateway: { ...gatewayConfig, enabled: newEnabled },
      });

      if (newEnabled) {
        const result = await window.gateway.connect();
        if (!result.success) {
          setError(result.error || 'Failed to connect');
        }
      } else {
        await window.gateway.disconnect();
      }
      await loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUrlChange = async (url: string) => {
    await updateConfig({
      gateway: { ...gatewayConfig, url },
    });
  };

  const handleRiIdChange = async (riID: string) => {
    await updateConfig({
      gateway: { ...gatewayConfig, riID },
    });
  };

  const handleAdvancedChange = async (field: keyof GatewayConfig, value: number) => {
    await updateConfig({
      gateway: { ...gatewayConfig, [field]: value },
    });
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await window.gateway.testConnection();
      setTestResult({
        success: result.success,
        message: result.success
          ? `Connected to Gateway at ${gatewayConfig.url}`
          : result.error || 'Connection failed',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = async () => {
    setLoading(true);
    setError(null);

    try {
      await window.gateway.disconnect();
      await new Promise((r) => setTimeout(r, 500));
      const result = await window.gateway.connect();
      if (!result.success) {
        setError(result.error || 'Reconnection failed');
      }
      await loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state: string): string => {
    switch (state) {
      case 'CONNECTED':
        return '#4caf50';
      case 'DEGRADED':
        return '#ff9800';
      case 'REGISTERING':
        return '#2196f3';
      default:
        return '#888';
    }
  };

  const getStateLabel = (state: string): string => {
    switch (state) {
      case 'CONNECTED':
        return '● Connected';
      case 'DEGRADED':
        return '◐ Degraded';
      case 'REGISTERING':
        return '○ Connecting...';
      case 'DISCONNECTED':
        return '○ Disconnected';
      default:
        return `○ ${state}`;
    }
  };

  return (
    <div className="gateway-settings">
      <div className="settings-section">
        <h3>Gateway Connection</h3>
        <p className="section-description">
          Connect to a Gateway server for remote control via Slack, Discord, or other platforms
        </p>

        <div className="setting-row">
          <div className="setting-label">
            <span>Enable Gateway</span>
            <span className="setting-hint">Connect to Gateway server on startup</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={gatewayConfig.enabled}
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
              <span>State:</span>
              <span style={{ color: getStateColor(status.state) }}>{getStateLabel(status.state)}</span>
            </div>
            <div className="status-row">
              <span>Gateway URL:</span>
              <span className="status-value">{status.gatewayURL}</span>
            </div>
            <div className="status-row">
              <span>RI ID:</span>
              <span className="status-value">{status.riID}</span>
            </div>
            {status.activeSession && (
              <div className="status-row">
                <span>Active Session:</span>
                <span className="status-value">{status.activeSession.sessionId.slice(0, 12)}...</span>
              </div>
            )}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            {testResult.success ? '✅' : '❌'} {testResult.message}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>Server Configuration</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>Gateway URL</span>
            <span className="setting-hint">HTTP/HTTPS endpoint of the Gateway server</span>
          </div>
          <input
            type="text"
            className="setting-input"
            placeholder="http://localhost:8080"
            value={gatewayConfig.url}
            onChange={(e) => handleUrlChange(e.target.value)}
            disabled={loading || gatewayConfig.enabled}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>RI Instance ID</span>
            <span className="setting-hint">Unique identifier for this RI instance (auto-generated if empty)</span>
          </div>
          <input
            type="text"
            className="setting-input"
            placeholder="my-desktop-001"
            value={gatewayConfig.riID}
            onChange={(e) => handleRiIdChange(e.target.value)}
            disabled={loading || gatewayConfig.enabled}
          />
        </div>

        <div className="button-row">
          <button
            className="test-button"
            onClick={handleTestConnection}
            disabled={loading || !gatewayConfig.url}
          >
            🔗 Test Connection
          </button>
          {gatewayConfig.enabled && (
            <button className="test-button secondary" onClick={handleReconnect} disabled={loading}>
              🔄 Reconnect
            </button>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h3>Advanced Settings</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>Poll Timeout</span>
            <span className="setting-hint">Long polling timeout in milliseconds</span>
          </div>
          <input
            type="number"
            className="setting-input-number"
            min="5000"
            max="60000"
            step="1000"
            value={gatewayConfig.pollTimeout}
            onChange={(e) => handleAdvancedChange('pollTimeout', parseInt(e.target.value) || 30000)}
            disabled={loading || gatewayConfig.enabled}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Heartbeat Interval</span>
            <span className="setting-hint">Heartbeat interval in milliseconds</span>
          </div>
          <input
            type="number"
            className="setting-input-number"
            min="5000"
            max="60000"
            step="1000"
            value={gatewayConfig.heartbeatInterval}
            onChange={(e) => handleAdvancedChange('heartbeatInterval', parseInt(e.target.value) || 10000)}
            disabled={loading || gatewayConfig.enabled}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Reconnect Interval</span>
            <span className="setting-hint">Initial reconnect delay in milliseconds</span>
          </div>
          <input
            type="number"
            className="setting-input-number"
            min="500"
            max="10000"
            step="500"
            value={gatewayConfig.reconnectInterval}
            onChange={(e) => handleAdvancedChange('reconnectInterval', parseInt(e.target.value) || 1000)}
            disabled={loading || gatewayConfig.enabled}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Max Reconnect Delay</span>
            <span className="setting-hint">Maximum delay between reconnect attempts</span>
          </div>
          <input
            type="number"
            className="setting-input-number"
            min="5000"
            max="120000"
            step="5000"
            value={gatewayConfig.maxReconnectDelay}
            onChange={(e) => handleAdvancedChange('maxReconnectDelay', parseInt(e.target.value) || 30000)}
            disabled={loading || gatewayConfig.enabled}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>Commands</h3>
        <p className="section-description">Available commands when connected via Gateway</p>
        <div className="commands-list">
          <div className="command-item">
            <code>/ai &lt;prompt&gt;</code>
            <span>Send prompt to AI in active terminal session</span>
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
            <span>Send yes/no confirmation</span>
          </div>
          <div className="command-item">
            <code>/help</code>
            <span>Show available commands</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GatewaySettings;
