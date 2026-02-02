import React from 'react';
import { useTerminalStore } from '../store/terminalStore';
import './HistoryTabBar.css';

export const HistoryTabBar: React.FC = () => {
  const {
    sessions,
    historySessionIds,
    activeHistorySessionId,
    closeHistorySession,
    setActiveHistorySession,
  } = useTerminalStore();

  // Get history sessions that are currently open
  const historySessions = historySessionIds
    .map((id) => sessions.find((s) => s.id === id))
    .filter(Boolean);

  if (historySessions.length === 0) {
    return null;
  }

  return (
    <div className="history-tab-bar">
      <div className="history-tab-bar-scroll">
        {historySessions.map((session) => (
          <div
            key={session!.id}
            className={`history-tab-item ${
              activeHistorySessionId === session!.id ? 'active' : ''
            }`}
            onClick={() => setActiveHistorySession(session!.id)}
          >
            <span className="history-tab-prefix">[h]:</span>
            <span className="history-tab-name">{session!.name}</span>
            <button
              className="history-tab-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                closeHistorySession(session!.id);
              }}
              title="Close history view"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
