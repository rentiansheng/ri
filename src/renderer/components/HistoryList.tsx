import React, { useState, useEffect } from 'react';
import { useTerminalStore } from '../store/terminalStore';
import { SessionLogStats } from '../types/global';
import { formatRelativeTime } from '../utils/timeFormat';
import './HistoryList.css';

interface SessionHistoryItem {
  sessionId: string;
  sessionName: string;
  stats: SessionLogStats | null;
}

interface HistoryListProps {
  onSessionSelect: (sessionId: string) => void;
  selectedSessionId: string | null;
}

const HistoryList: React.FC<HistoryListProps> = ({ onSessionSelect, selectedSessionId }) => {
  const sessions = useTerminalStore((state) => state.sessions);
  const openTab = useTerminalStore((state) => state.openTab);
  const [historyItems, setHistoryItems] = useState<SessionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  console.log('[HistoryList] Rendering with', { 
    sessionsCount: sessions.length, 
    historyItemsCount: historyItems.length,
    isLoading,
    selectedSessionId 
  });
  
  const handleSessionClick = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      openTab('history', sessionId, `[H]: ${session.name}`);
    }
  };

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

  const handleClearHistory = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to clear this session history?')) {
      await window.sessionLog.delete({ sessionId });
      setHistoryItems((prev) => prev.filter((item) => item.sessionId !== sessionId));
      if (selectedSessionId === sessionId) {
        onSessionSelect('');
      }
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
    <div className="history-list-view">
      <div className="history-list-header">
        <h3>HISTORY</h3>
        <span className="history-list-count">
          {historyItems.length === 0 ? 'No Records' : `${historyItems.length}`}
        </span>
      </div>
      
      <div className="history-list-body">
        {isLoading ? (
          <div className="history-list-loading">
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        ) : historyItems.length === 0 ? (
          <div className="history-list-empty">
            <p>No history</p>
            <p className="history-hint">Logs appear after running commands</p>
          </div>
        ) : (
          <div className="history-list-items">
            {historyItems.map((item) => (
              <div
                key={item.sessionId}
                className={`history-list-item ${
                  selectedSessionId === item.sessionId ? 'active' : ''
                }`}
                onClick={() => handleSessionClick(item.sessionId)}
              >
                <div className="history-list-item-header">
                  <span className="history-list-item-name">
                    <span className="history-list-item-prefix">[h]</span>
                    {item.sessionName}
                  </span>
                  <button
                    className="history-list-item-delete"
                    onClick={(e) => handleClearHistory(e, item.sessionId)}
                    title="Clear history"
                  >
                    ×
                  </button>
                </div>
                {item.stats && (
                  <div className="history-list-item-stats">
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

export default HistoryList;
