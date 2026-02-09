import React, { useState, useEffect, useRef } from 'react';
import type { RemoteControlMessage, RemoteControlApproval, RemoteControlStatus } from '../types/global';
import { formatRelativeTime } from '../utils/timeFormat';
import './RemoteControlPanel.css';

interface GatewayStatus {
  connected: boolean;
  state: string;
  gatewayURL: string;
  riID: string;
  activeSession: { sessionId: string } | null;
}

const RemoteControlPanel: React.FC = () => {
  const [messages, setMessages] = useState<RemoteControlMessage[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<RemoteControlApproval[]>([]);
  const [status, setStatus] = useState<RemoteControlStatus | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'messages' | 'approvals'>('messages');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    loadStatus();
    loadGatewayStatus();
    const interval = setInterval(loadGatewayStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubMessage = window.remoteControl.onMessage((msg: RemoteControlMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    const unsubApproval = window.remoteControl.onApprovalRequired((approval: RemoteControlApproval) => {
      setPendingApprovals(prev => [...prev, approval]);
      setActiveTab('approvals');
    });

    return () => {
      unsubMessage();
      unsubApproval();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'messages') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [messagesResult, approvalsResult] = await Promise.all([
        window.remoteControl.getMessages(100),
        window.remoteControl.getPendingApprovals()
      ]);

      if (messagesResult.success && messagesResult.messages) {
        setMessages(messagesResult.messages);
      }

      if (approvalsResult.success && approvalsResult.approvals) {
        setPendingApprovals(approvalsResult.approvals);
      }
    } catch (err) {
      console.error('Failed to load remote control data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    try {
      const result = await window.remoteControl.getStatus();
      if (result.success && result.status) {
        setStatus(result.status);
      }
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  };

  const loadGatewayStatus = async () => {
    try {
      const result = await window.gateway.getStatus();
      if (result.success && result.status) {
        setGatewayStatus(result.status);
      }
    } catch (err) {
      console.error('Failed to load gateway status:', err);
    }
  };

  const handleClearMessages = async () => {
    try {
      await window.remoteControl.clearMessages();
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear messages:', err);
    }
  };

  const handleApprove = async (approvalId: string) => {
    try {
      const result = await window.remoteControl.approveCommand(approvalId);
      if (result.success) {
        setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
      }
    } catch (err) {
      console.error('Failed to approve command:', err);
    }
  };

  const handleReject = async (approvalId: string, reason?: string) => {
    try {
      const result = await window.remoteControl.rejectCommand(approvalId, reason);
      if (result.success) {
        setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
      }
    } catch (err) {
      console.error('Failed to reject command:', err);
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'incoming':
        return '📥';
      case 'outgoing':
        return '📤';
      case 'executed':
        return '▶️';
      case 'approved':
        return '✅';
      case 'rejected':
        return '❌';
      default:
        return '💬';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'discord':
        return '🎮';
      case 'slack':
        return '💼';
      case 'gateway':
        return '🌐';
      default:
        return '🤖';
    }
  };

  const getCommandTypeLabel = (commandType: string) => {
    switch (commandType) {
      case 'ai':
        return 'AI Prompt';
      case 'stop':
        return 'Stop (Ctrl+C)';
      case 'confirm':
        return 'Confirmation';
      default:
        return commandType;
    }
  };

  const isConnected = status?.discordConnected || status?.slackConnected || gatewayStatus?.state === 'CONNECTED';

  return (
    <div className="remote-control-panel">
      <div className="remote-panel-header">
        <div className="remote-panel-header-left">
          <h3>REMOTE CONTROL</h3>
          {pendingApprovals.length > 0 && (
            <span className="remote-panel-badge">{pendingApprovals.length}</span>
          )}
        </div>
        <div className="remote-panel-status">
          {status && (
            <>
              <span className={status.discordConnected ? 'status-online' : 'status-offline'} title="Discord">
                🎮 {status.discordConnected ? '●' : '○'}
              </span>
              <span className={status.slackConnected ? 'status-online' : 'status-offline'} title="Slack">
                💼 {status.slackConnected ? '●' : '○'}
              </span>
            </>
          )}
          {gatewayStatus && (
            <span className={gatewayStatus.state === 'CONNECTED' ? 'status-online' : 'status-offline'} title={`Gateway: ${gatewayStatus.state}`}>
              🌐 {gatewayStatus.state === 'CONNECTED' ? '●' : '○'}
            </span>
          )}
        </div>
      </div>

      <div className="remote-panel-tabs">
        <button
          className={`remote-panel-tab ${activeTab === 'messages' ? 'active' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          📥 Command Log
          <span className="tab-count">{messages.length}</span>
        </button>
        <button
          className={`remote-panel-tab ${activeTab === 'approvals' ? 'active' : ''}`}
          onClick={() => setActiveTab('approvals')}
        >
          ⏳ Pending
          {pendingApprovals.length > 0 && (
            <span className="tab-badge">{pendingApprovals.length}</span>
          )}
        </button>
      </div>

      {activeTab === 'messages' && (
        <div className="remote-panel-content">
          <div className="remote-panel-messages">
            {loading ? (
              <div className="remote-panel-loading">Loading...</div>
            ) : messages.length === 0 ? (
              <div className="remote-panel-empty">
                <p>No commands received</p>
                <p className="remote-hint">
                  {isConnected 
                    ? 'Commands sent via Discord, Slack, or Gateway will appear here' 
                    : 'Connect Discord, Slack, or Gateway in Settings → Remote Control'}
                </p>
              </div>
            ) : (
              <>
                <div className="remote-panel-messages-header">
                  <button
                    className="remote-panel-clear-btn"
                    onClick={handleClearMessages}
                    title="Clear all"
                  >
                    Clear
                  </button>
                </div>
                <div className="remote-panel-messages-list">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`remote-message ${msg.type}`}
                    >
                      <div className="remote-message-header">
                        <span className="remote-message-type">
                          {getMessageTypeIcon(msg.type)}
                        </span>
                        <span className="remote-message-platform">
                          {getPlatformIcon(msg.platform)}
                        </span>
                        <span className="remote-message-user">{msg.user}</span>
                        <span className="remote-message-time">
                          {formatRelativeTime(new Date(msg.timestamp).getTime())}
                        </span>
                      </div>
                      <div className="remote-message-content">
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="remote-panel-content">
          <div className="remote-panel-approvals">
            {pendingApprovals.length === 0 ? (
              <div className="remote-panel-empty">
                <p>No pending approvals</p>
                <p className="remote-hint">
                  Enable "Require Approval" in Settings to review commands before execution
                </p>
              </div>
            ) : (
              <div className="remote-approvals-list">
                {pendingApprovals.map((approval) => (
                  <div key={approval.id} className="remote-approval-item">
                    <div className="remote-approval-header">
                      <span className="remote-approval-type">
                        {getCommandTypeLabel(approval.commandType)}
                      </span>
                      <span className="remote-approval-platform">
                        {getPlatformIcon(approval.platform)}
                      </span>
                      <span className="remote-approval-user">{approval.user}</span>
                      <span className="remote-approval-time">
                        {formatRelativeTime(new Date(approval.timestamp).getTime())}
                      </span>
                    </div>
                    <div className="remote-approval-command">
                      <code>{approval.command}</code>
                    </div>
                    {approval.args && Object.keys(approval.args).length > 0 && (
                      <div className="remote-approval-args">
                        <pre>{JSON.stringify(approval.args, null, 2)}</pre>
                      </div>
                    )}
                    <div className="remote-approval-actions">
                      <button
                        className="remote-approve-btn"
                        onClick={() => handleApprove(approval.id)}
                        title="Approve and execute"
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="remote-reject-btn"
                        onClick={() => handleReject(approval.id)}
                        title="Reject command"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RemoteControlPanel;
