import React, { useState, useEffect, useRef } from 'react';
import { useTerminalStore, Session, AIToolState } from '../store/terminalStore';
import { useNotifyStore } from '../store/notifyStore';
import { useUIEditStore } from '../store/uiEditStore';
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

// ActivityTimeLabel Component - Only subscribes to lastActivityTime
const ActivityTimeLabel: React.FC<{ sessionId: string }> = React.memo(({ sessionId }) => {
  const lastActivityTime = useTerminalStore((state) => {
    const session = state.sessions.find(s => s.id === sessionId);
    return session?.lastActivityTime || 0;
  });
  
  return (
    <span className={`session-item-activity ${getActivityStatus(lastActivityTime)}`}>
      {formatRelativeTime(lastActivityTime)}
    </span>
  );
});

// SessionItem Component - Only subscribes to its own session data
const SessionItem: React.FC<{
  sessionId: string;
  isActive: boolean;
  isVisible: boolean;
  onDelete: (e: React.MouseEvent, id: string) => void;
}> = React.memo(
  ({ sessionId, isActive, isVisible, onDelete }) => {
  // Only subscribe to this session's name and aiToolState
  const session = useTerminalStore((state) => {
    const s = state.sessions.find(s => s.id === sessionId);
    return s ? { id: s.id, name: s.name, aiToolState: s.aiToolState } : null;
  });
  
  const showSession = useTerminalStore((state) => state.showSession);
  const renameSession = useTerminalStore((state) => state.renameSession);
  const notifyStore = useNotifyStore();
  
  // 使用独立的 uiEditStore 管理编辑状态 - 只订阅与当前 session 相关的状态
  const editingSessionId = useUIEditStore((state) => state.editingSessionId);
  const sessionEditName = useUIEditStore((state) => state.sessionEditName);
  const startEditSession = useUIEditStore((state) => state.startEditSession);
  const updateSessionEditName = useUIEditStore((state) => state.updateSessionEditName);
  const finishEditSession = useUIEditStore((state) => state.finishEditSession);
  const cancelEditSession = useUIEditStore((state) => state.cancelEditSession);
  
  const isEditing = editingSessionId === sessionId;
  const inputRef = useRef<HTMLInputElement>(null);
  
  if (!session) return null;
  
  const handleSessionClick = (e: React.MouseEvent) => {
    // 如果正在编辑，不要切换 session
    if (isEditing) {
      e.stopPropagation();
      return;
    }
    
    showSession(sessionId);
    notifyStore.clearSession(sessionId);
  };
  
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // 如果正在编辑其他 session，先保存
    if (editingSessionId && editingSessionId !== sessionId) {
      finishEditSession((name) => {
        renameSession(editingSessionId, name);
      });
    }
    
    startEditSession(sessionId, session.name);
  };
  
  const handleSaveSession = () => {
    finishEditSession((newName) => {
      renameSession(sessionId, newName);
    });
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveSession();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditSession();
    }
  };
  
  // 全局点击外部检测
  useEffect(() => {
    if (!isEditing) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // 检查是否点击了 input 自身
      if (inputRef.current && inputRef.current.contains(target)) {
        return;
      }
      
      // 检查是否点击了删除按钮 - 如果是，先保存再删除
      if (target.closest('.session-item-actions')) {
        handleSaveSession();
        return;
      }
      
      // 点击了其他地方，自动保存
      handleSaveSession();
    };
    
    // 使用 mousedown 而不是 click，这样可以在 click 事件前捕获
    document.addEventListener('mousedown', handleClickOutside, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isEditing, sessionId]);
  
  // 自动选中所有文本
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  return (
    <div
      className={`session-item ${isActive ? 'active' : ''} ${session.aiToolState?.status === 'waiting' ? 'has-waiting-status' : ''}`}
      onClick={handleSessionClick}
      onDoubleClick={handleDoubleClick}
      data-testid={`session-item-${sessionId}`}
    >
      <div className="session-item-icon">
        {isVisible ? '●' : '○'}
      </div>
      <div className="session-item-content" onClick={(e) => isEditing ? e.stopPropagation() : undefined}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={sessionEditName}
            onChange={(e) => updateSessionEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="session-item-input"
            onClick={(e) => e.stopPropagation()}
            data-testid={`rename-input-${sessionId}`}
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
              <NotificationBadge sessionId={sessionId} />
            </div>
            <ActivityTimeLabel sessionId={sessionId} />
          </>
        )}
      </div>
      <div className="session-item-actions">
        <button
          className="session-item-action session-item-delete"
          onClick={(e) => onDelete(e, sessionId)}
          title="Delete"
          data-testid={`delete-session-${sessionId}`}
        >
          🗑
        </button>
      </div>
    </div>
  );
},
  // 自定义比较函数：只比较真正影响渲染的 props
  (prevProps, nextProps) => {
    return (
      prevProps.sessionId === nextProps.sessionId &&
      prevProps.isActive === nextProps.isActive &&
      prevProps.isVisible === nextProps.isVisible
      // onDelete 函数引用变化不影响功能，不比较
    );
  }
);

// 添加 displayName 便于调试
SessionItem.displayName = 'SessionItem';

const SessionList: React.FC = () => {
  // Only subscribe to necessary list-level state
  const sessions = useTerminalStore((state) => state.sessions);
  const visibleSessionIds = useTerminalStore((state) => state.visibleSessionIds);
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);
  const tabs = useTerminalStore((state) => state.tabs);
  const createSession = useTerminalStore((state) => state.createSession);
  const deleteSession = useTerminalStore((state) => state.deleteSession);
  const hasOpenTab = useTerminalStore((state) => state.hasOpenTab);
  const closeTabById = useTerminalStore((state) => state.closeTabById);
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

  const handleCreateSession = () => {
    createSession();
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

  return (
    <div className="session-list" data-testid="session-list">
      <div className="session-list-header">
        <h3>SESSIONS</h3>
        <button 
          onClick={handleCreateSession} 
          className="btn-new-session" 
          title="New Session"
          data-testid="create-session-btn"
        >
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
            <SessionItem
              key={session.id}
              sessionId={session.id}
              isActive={session.id === activeSessionId}
              isVisible={visibleSessionIds.includes(session.id)}
              onDelete={handleDeleteSession}
            />
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
