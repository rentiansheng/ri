import React, { useState, useEffect, useRef } from 'react';
import { useTerminalStore, Session, AIToolState } from '../store/terminalStore';
import { useNotifyStore } from '../store/notifyStore';
import { formatRelativeTime, getActivityStatus } from '../utils/timeFormat';
import ConfirmContextMenu from './ConfirmContextMenu';
import './SessionList.css';

// Notification Badge Component
const NotificationBadge: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const notifyStore = useNotifyStore();
  const state = notifyStore.getSessionNotificationState(sessionId);
  
  if (!state || !state.hasNotifications) return null;
  
  return (
    <span 
      className={`notification-badge badge-${state.latestType}`}
      title={`${state.count} unread notification${state.count > 1 ? 's' : ''}`}
    >
      {state.count}
    </span>
  );
};

// Helper function to get AI tool status icon and color
const getAIStatusIcon = (status: AIToolState['status'] | undefined) => {
  if (!status || status === 'idle') return null;
  
  switch (status) {
    case 'thinking':
      return { icon: '🤔', color: '#ff9800', label: 'Thinking' };
    case 'waiting':
      return { icon: '⏸', color: '#ffeb3b', label: 'Waiting for input' };
    case 'executing':
      return { icon: '⚡', color: '#2196f3', label: 'Executing' };
    case 'completed':
      return { icon: '✅', color: '#4caf50', label: 'Completed' };
    default:
      return null;
  }
};

const SessionList: React.FC = () => {
  const { sessions, visibleSessionIds, activeSessionId, tabs, createSession, showSession, closeTab, deleteSession, renameSession, hasOpenTab, closeTabById } = useTerminalStore();
  const notifyStore = useNotifyStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [confirmMenu, setConfirmMenu] = useState<{
    isOpen: boolean;
    sessionId: string | null;
    sessionName: string;
    position: { x: number; y: number } | null;
  }>({
    isOpen: false,
    sessionId: null,
    sessionName: '',
    position: null,
  });

  // Update time display every 60 seconds to refresh relative times
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, []);

  const handleCreateSession = () => {
    createSession();
  };

  const handleSessionClick = (id: string) => {
    showSession(id);  // Opens in tab bar AND activates
    notifyStore.clearSession(id);  // Clear all notifications for this session
  };

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Only close tab if session is visible
    if (visibleSessionIds.includes(id)) {
      closeTab(id);
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    
    // Check if session has open tab
    const hasTab = hasOpenTab(id);
    
    if (hasTab) {
      // Get button position for context menu
      const buttonRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const position = {
        x: buttonRect.left,
        y: buttonRect.bottom + 5,
      };
      
      // Show context menu confirmation
      setConfirmMenu({
        isOpen: true,
        sessionId: id,
        sessionName: session.name,
        position,
      });
    } else {
      // Use native confirm for sessions without open tabs
      if (confirm('Are you sure you want to delete this session?')) {
        deleteSession(id);
      }
    }
  };
  
  const handleConfirmDelete = () => {
    if (confirmMenu.sessionId) {
      const sessionId = confirmMenu.sessionId;
      
      // First, close all tabs related to this session
      const relatedTabs = tabs.filter(tab => tab.sessionId === sessionId);
      relatedTabs.forEach(tab => {
        closeTabById(tab.id);
      });
      
      // Then delete the session
      deleteSession(sessionId);
    }
    setConfirmMenu({
      isOpen: false,
      sessionId: null,
      sessionName: '',
      position: null,
    });
  };
  
  const handleCancelDelete = () => {
    setConfirmMenu({
      isOpen: false,
      sessionId: null,
      sessionName: '',
      position: null,
    });
  };

  const handleDoubleClick = (session: Session) => {
    setEditingId(session.id);
    setEditingName(session.name);
  };

  const handleRename = (id: string) => {
    if (editingName.trim()) {
      renameSession(id, editingName.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleRename(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <div className="session-list">
      <div className="session-list-header">
        <h3>SESSIONS</h3>
        <button onClick={handleCreateSession} className="btn-new-session" title="New Session">
          +
        </button>
      </div>
      
      <div className="session-list-content">
        {sessions.length === 0 ? (
          <div className="session-list-empty">
            <p>No sessions</p>
            <p className="session-list-hint">Click + to create</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${session.id === activeSessionId ? 'active' : ''} ${session.aiToolState?.status === 'waiting' ? 'has-waiting-status' : ''}`}
              onClick={() => handleSessionClick(session.id)}
              onDoubleClick={() => handleDoubleClick(session)}
            >
              <div className="session-item-icon">
                {visibleSessionIds.includes(session.id) ? '●' : '○'}
              </div>
              <div className="session-item-content">
                {editingId === session.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleRename(session.id)}
                    onKeyDown={(e) => handleKeyDown(e, session.id)}
                    autoFocus
                    className="session-item-input"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <div className="session-item-name-row">
                      <span className="session-item-name">{session.name}</span>
                      {session.aiToolState && getAIStatusIcon(session.aiToolState.status) && (
                        <span 
                          className="ai-tool-status"
                          style={{ color: getAIStatusIcon(session.aiToolState.status)?.color }}
                          title={`${getAIStatusIcon(session.aiToolState.status)?.label}${session.aiToolState.prompt ? `: ${session.aiToolState.prompt}` : ''}`}
                        >
                          {getAIStatusIcon(session.aiToolState.status)?.icon}
                        </span>
                      )}
                      <NotificationBadge sessionId={session.id} />
                    </div>
                    <span className={`session-item-activity ${getActivityStatus(session.lastActivityTime)}`}>
                      {formatRelativeTime(session.lastActivityTime)}
                    </span>
                  </>
                )}
              </div>
              <div className="session-item-actions">
                {visibleSessionIds.includes(session.id) && (
                  <button
                    className="session-item-action"
                    onClick={(e) => handleCloseTab(e, session.id)}
                    title="Close Tab"
                  >
                    ×
                  </button>
                )}
                <button
                  className="session-item-action session-item-delete"
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      <ConfirmContextMenu
        isOpen={confirmMenu.isOpen}
        position={confirmMenu.position}
        message={`Delete session "${confirmMenu.sessionName}" and close its tab?`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default SessionList;
