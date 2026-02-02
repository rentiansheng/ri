import React from 'react';
import { useTerminalStore } from '../store/terminalStore';
import { useNotifyStore } from '../store/notifyStore';
import { formatRelativeTime } from '../utils/timeFormat';
import { NotificationType } from '../types/global';
import './NotifyList.css';

interface NotifyListProps {
  onSessionSelect: (sessionId: string) => void;
  selectedSessionId: string | null;
}

const NotifyList: React.FC<NotifyListProps> = ({ onSessionSelect, selectedSessionId }) => {
  const notifyStore = useNotifyStore();
  const showSession = useTerminalStore((state) => state.showSession);
  const groups = notifyStore.getAllGroups();
  const totalUnread = notifyStore.totalUnread;

  const handleClearAll = async () => {
    await window.notification.clearAll();
  };

  const handleClearSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await window.notification.clear(sessionId);
  };

  const handleSessionClick = (sessionId: string) => {
    // Update selected state for UI feedback
    onSessionSelect(sessionId);
    
    // Actually switch to the session
    showSession(sessionId);
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'info':
        return 'ℹ️';
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '📌';
    }
  };

  return (
    <div className="notify-list-view">
      <div className="notify-list-header">
        <div className="notify-list-header-left">
          <h3>NOTIFICATIONS</h3>
          {totalUnread > 0 && (
            <span className="notify-list-badge">{totalUnread}</span>
          )}
        </div>
        <div className="notify-list-header-actions">
          <button
            className="notify-list-action-btn"
            onClick={() => {
              Object.keys(notifyStore.groups).forEach(sessionId => {
                notifyStore.markAsRead(sessionId);
              });
            }}
            title="Mark all as read"
            disabled={totalUnread === 0}
          >
            ✓
          </button>
          <button
            className="notify-list-action-btn notify-list-action-btn-danger"
            onClick={handleClearAll}
            title="Clear all"
          >
            ×
          </button>
        </div>
      </div>

      <div className="notify-list-body">
        {groups.length === 0 ? (
          <div className="notify-list-empty">
            <p>No notifications</p>
            <p className="notify-hint">You're all caught up!</p>
          </div>
        ) : (
          <div className="notify-list-items">
            {groups.map((group) => {
              // Show max 3 notifications per session
              const visibleNotifications = group.notifications.slice(0, 3);
              const hasMore = group.notifications.length > 3;
              
              return (
                <div 
                  key={group.sessionId} 
                  className={`notify-list-group ${selectedSessionId === group.sessionId ? 'active' : ''}`}
                  onClick={() => handleSessionClick(group.sessionId)}
                >
                  <div className="notify-list-group-header">
                    <span className="notify-list-group-session">
                      📜 {group.sessionName}
                    </span>
                    {group.unreadCount > 0 && (
                      <span className="notify-list-group-badge">{group.unreadCount}</span>
                    )}
                    <button
                      className="notify-list-group-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        notifyStore.markAsRead(group.sessionId);
                      }}
                      title="Mark session as read"
                    >
                      ✓
                    </button>
                    <button
                      className="notify-list-group-clear"
                      onClick={(e) => handleClearSession(e, group.sessionId)}
                      title="Clear session notifications"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="notify-list-group-previews">
                    {visibleNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`notify-list-preview ${notification.read ? 'read' : 'unread'}`}
                      >
                        <span className="notify-list-preview-icon">
                          {notification.icon || getNotificationIcon(notification.type)}
                        </span>
                        <div className="notify-list-preview-content">
                          <span className="notify-list-preview-title">{notification.title}</span>
                          <span className="notify-list-preview-time">
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {hasMore && (
                      <div className="notify-list-more">
                        +{group.notifications.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotifyList;
