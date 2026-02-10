import React from 'react';
import { useTerminalStore } from '../store/terminalStore';
import { useNotifyStore } from '../store/notifyStore';
import { formatRelativeTime } from '../utils/timeFormat';
import { NotificationType, NotificationAction } from '../types/global';
import './NotifyDetail.css';

interface NotifyDetailProps {
  sessionId: string | null;
}

const NotifyDetail: React.FC<NotifyDetailProps> = ({ sessionId }) => {
  const terminalStore = useTerminalStore();
  const notifyStore = useNotifyStore();

  if (!sessionId) {
    return (
      <div className="notify-detail-empty">
        <div className="notify-detail-placeholder">
          <div className="notify-detail-icon">🔔</div>
          <h3>Select a Session</h3>
          <p>Choose a session from the left to view all its notifications</p>
        </div>
      </div>
    );
  }

  const group = notifyStore.getAllGroups().find(g => g.sessionId === sessionId);

  if (!group || group.notifications.length === 0) {
    return (
      <div className="notify-detail-empty">
        <div className="notify-detail-placeholder">
          <div className="notify-detail-icon">✨</div>
          <h3>No Notifications</h3>
          <p>This session has no notifications</p>
        </div>
      </div>
    );
  }

  const handleNotificationClick = () => {
    notifyStore.markAsRead(sessionId);
    terminalStore.showSession(sessionId);
    terminalStore.setActiveSession(sessionId);
  };

  const handleClearSession = async () => {
    await window.notification.clear(sessionId);
  };

  const handleActionClick = (action: NotificationAction, notificationId: string) => {
    if (action.terminalId) {
      window.terminal.write({ id: action.terminalId, data: action.keystroke });
      notifyStore.removeNotification(sessionId, notificationId);
    }
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
    <div className="notify-detail-view">
      <div className="notify-detail-header">
        <div className="notify-detail-header-left">
          <h3>{group.sessionName}</h3>
          <span className="notify-detail-count">
            {group.notifications.length} notification{group.notifications.length !== 1 ? 's' : ''}
          </span>
          {group.unreadCount > 0 && (
            <span className="notify-detail-unread-badge">{group.unreadCount} unread</span>
          )}
        </div>
        <div className="notify-detail-header-actions">
          <button
            className="notify-detail-btn"
            onClick={() => notifyStore.markAsRead(sessionId)}
            disabled={group.unreadCount === 0}
          >
            Mark All Read
          </button>
          <button
            className="notify-detail-btn notify-detail-btn-danger"
            onClick={handleClearSession}
          >
            Clear All
          </button>
          <button
            className="notify-detail-btn notify-detail-btn-primary"
            onClick={handleNotificationClick}
          >
            Go to Session
          </button>
        </div>
      </div>

      <div className="notify-detail-body">
        <div className="notify-detail-list">
          {group.notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notify-detail-item ${notification.read ? 'read' : 'unread'} notify-detail-item-${notification.type}`}
            >
              <div className="notify-detail-item-icon">
                {notification.icon || getNotificationIcon(notification.type)}
              </div>
              <div className="notify-detail-item-content">
                <div className="notify-detail-item-header">
                  <span className="notify-detail-item-title">{notification.title}</span>
                  <span className="notify-detail-item-time">
                    {formatRelativeTime(notification.timestamp)}
                  </span>
                </div>
                <p className="notify-detail-item-message">{notification.body}</p>
                {notification.actions && notification.actions.length > 0 && (
                  <div className="notify-detail-item-actions">
                    {notification.actions.map((action, idx) => (
                      <button
                        key={idx}
                        className="notify-detail-action-btn"
                        onClick={() => handleActionClick(action, notification.id)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotifyDetail;
