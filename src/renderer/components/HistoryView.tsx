import React, { useState, useEffect } from 'react';
import { useTerminalStore } from '../store/terminalStore';
import { SessionLogStats } from '../types/global';
import { formatRelativeTime } from '../utils/timeFormat';
import './HistoryView.css';

interface SessionHistoryItem {
  sessionId: string;
  sessionName: string;
  stats: SessionLogStats | null;
}

const HistoryView: React.FC = () => {
  const sessions = useTerminalStore((state) => state.sessions);
  const historySessionIds = useTerminalStore((state) => state.historySessionIds);
  const openHistorySession = useTerminalStore((state) => state.openHistorySession);
  const setActiveView = useTerminalStore((state) => state.setActiveSession);
  const [historyItems, setHistoryItems] = useState<SessionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load stats for all sessions
  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const items = await Promise.all(
          sessions.map(async (session) => {
            const stats = await window.sessionLog.getStats({ sessionId: session.id });
            return {
              sessionId: session.id,
              sessionName: session.name,
              stats,
            };
          })
        );
        // Filter to only show sessions with existing history
        const itemsWithHistory = items.filter((item) => item.stats && item.stats.exists);
        setHistoryItems(itemsWithHistory);
      } catch (error) {
        console.error('Failed to load session history:', error);
        setHistoryItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [sessions]);

  const handleSessionClick = (sessionId: string) => {
    openHistorySession(sessionId);
  };

  const handleClearHistory = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to clear this session history?')) {
      await window.sessionLog.delete({ sessionId });
      setHistoryItems((prev) => prev.filter((item) => item.sessionId !== sessionId));
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="history-view">
      <div className="history-header">
        <h3>HISTORY</h3>
        <span className="history-count">
          {historyItems.length === 0 ? 'No Records' : `${historyItems.length} Sessions`}
        </span>
      </div>
      
      <div className="history-body">
        {isLoading ? (
          <div className="history-loading">
            <div className="loading-spinner"></div>
            <p>Loading history...</p>
          </div>
        ) : historyItems.length === 0 ? (
          <div className="history-empty">
            <p>No history available</p>
            <p className="history-hint">Session logs will appear here after you run commands</p>
          </div>
        ) : (
          <div className="history-list">
            {historyItems.map((item) => (
              <div
                key={item.sessionId}
                className={`history-item ${
                  historySessionIds.includes(item.sessionId) ? 'active' : ''
                }`}
                onClick={() => handleSessionClick(item.sessionId)}
              >
                <div className="history-item-header">
                  <span className="history-item-name">
                    <span className="history-item-prefix">[h]</span>
                    {item.sessionName}
                  </span>
                  <button
                    className="history-item-delete"
                    onClick={(e) => handleClearHistory(e, item.sessionId)}
                    title="Clear history"
                  >
                    ×
                  </button>
                </div>
                {item.stats && (
                  <div className="history-item-stats">
                    <span className="history-stat">
                      {item.stats.recordCount} records
                    </span>
                    <span className="history-stat">
                      {formatBytes(item.stats.fileSize)}
                    </span>
                    {item.stats.newestRecord && (
                      <span className="history-stat">
                        {formatRelativeTime(item.stats.newestRecord)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;
