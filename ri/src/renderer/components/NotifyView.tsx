import React, { useState } from 'react';
import { useTerminalStore } from '../store/terminalStore';
import { useNotifyStore } from '../store/notifyStore';
import { formatRelativeTime } from '../utils/timeFormat';
import { NotificationType } from '../types/global';
import './NotifyView.css';

const NotifyView: React.FC = () => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const terminalStore = useTerminalStore();
  const notifyStore = useNotifyStore();
  
  const groups = notifyStore.getAllGroups();
  const totalUnread = notifyStore.totalUnread;

  const handleClearAll = async () => {
    await window.notification.clearAll();
  };

  const handleClearSession = async (sessionId: string) => {
    await window.notification.clear(sessionId);
  };

  const handleNotificationClick = (sessionId: string) => {
    // Mark as read
    notifyStore.markAsRead(sessionId);
    
    // Navigate to session
    terminalStore.showSession(sessionId);
    terminalStore.setActiveSession(sessionId);
  };

  const toggleGroup = (sessionId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
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
    <div className="notify-view">
      <div className="notify-header">
        <div className="notify-header-left">
          <h3>NOTIFICATIONS</h3>
          {totalUnread > 0 && (
            <span className="notify-badge">{totalUnread}</span>
          )}
        </div>
        <div className="notify-header-actions">
          <button
            className="notify-action-btn"
            onClick={() => {
              // Mark all as read
              Object.keys(notifyStore.groups).forEach(sessionId => {
                notifyStore.markAsRead(sessionId);
              });
            }}
            title="Mark all as read"
            disabled={totalUnread === 0}
          >
            Mark All Read
          </button>
          <button
            className="notify-action-btn notify-action-btn-danger"
            onClick={handleClearAll}
            title="Clear all"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="notify-body">
        {groups.length === 0 ? (
          <div className="notify-empty">
            <p>No notifications</p>
            <p className="notify-hint">You're all caught up!</p>
          </div>
        ) : (
          <div className="notify-list">
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.sessionId);
              return (
                <div key={group.sessionId} className="notify-group">
                  <div 
                    className="notify-group-header"
                    onClick={() => toggleGroup(group.sessionId)}
                  >
                    <span className="notify-group-toggle">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <span className="notify-group-session">📜 {group.sessionName}</span>
                    {group.unreadCount > 0 && (
                      <span className="notify-group-badge">{group.unreadCount}</span>
                    )}
                    <button
                      className="notify-group-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        notifyStore.markAsRead(group.sessionId);
                      }}
                      title="Mark session as read"
                    >
                      ✓
                    </button>
                    <button
                      className="notify-group-clear"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearSession(group.sessionId);
                      }}
                      title="Clear session notifications"
                    >
                      ×
                    </button>
                  </div>
                  
                  {isExpanded && (
                    <div className="notify-group-items">
                      {group.notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`notify-item ${notification.read ? 'read' : 'unread'} notify-item-${notification.type}`}
                          onClick={() => handleNotificationClick(group.sessionId)}
                        >
                          <div className="notify-item-icon">
                            {notification.icon || getNotificationIcon(notification.type)}
                          </div>
                          <div className="notify-item-content">
                            <div className="notify-item-header">
                              <span className="notify-item-title">{notification.title}</span>
                              <span className="notify-item-time">
                                {formatRelativeTime(notification.timestamp)}
                              </span>
                            </div>
                            <p className="notify-item-message">{notification.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotifyView;
