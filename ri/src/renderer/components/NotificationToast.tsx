import React, { useEffect, useState, useRef } from 'react';
import { NotificationItem, NotificationType } from '../types/global';
import { useTerminalStore } from '../store/terminalStore';
import { useNotifyStore } from '../store/notifyStore';
import { NotificationTheme, getThemeIcon, generateThemeStyles } from '../utils/notificationThemes';
import './NotificationToast.css';

interface NotificationToastProps {
  notification: NotificationItem;
  duration?: number;
  theme?: NotificationTheme;
  onClose: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ 
  notification, 
  duration = 3000,
  theme = 'vscode',
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);

  const terminalStore = useTerminalStore();
  const notifyStore = useNotifyStore();

  const themeStyles = generateThemeStyles(theme);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      handleClose();
    }, remainingTimeRef.current);
  };

  const pauseTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    }
  };

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
    
    startTimer();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isPaused) {
      pauseTimer();
    } else if (isVisible) {
      startTimer();
    }
  }, [isPaused]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300); // Wait for fade-out animation
  };

  const handleClick = () => {
    // showSession() now correctly handles tab activation
    terminalStore.showSession(notification.sessionId);
    notifyStore.removeNotification(notification.sessionId, notification.id);
    handleClose();
  };

  return (
    <div 
      className={`notification-toast notification-toast-${notification.type} notification-toast-theme-${theme} ${isVisible ? 'notification-toast-visible' : 'notification-toast-hidden'}`}
      style={themeStyles as React.CSSProperties}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={handleClick}
    >
      <div className="notification-toast-icon">
        {notification.icon || getThemeIcon(notification.type, theme)}
      </div>
      <div className="notification-toast-content">
        <div className="notification-toast-header">
          <span className="notification-toast-session">{notification.sessionName}</span>
          <span className="notification-toast-title">{notification.title}</span>
        </div>
        <div className="notification-toast-body">{notification.body}</div>
      </div>
      <button 
        className="notification-toast-close"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
      >
        ×
      </button>
      {isPaused && (
        <div className="notification-toast-progress-paused" />
      )}
    </div>
  );
};

interface NotificationToastContainerProps {
  theme?: NotificationTheme;
}

export const NotificationToastContainer: React.FC<NotificationToastContainerProps> = ({ 
  theme = 'vscode' 
}) => {
  const [visibleToasts, setVisibleToasts] = useState<NotificationItem[]>([]);
  const maxVisibleToasts = 3;

  useEffect(() => {
    const cleanup = window.notification.onReceived((notification) => {
      setVisibleToasts((prev) => {
        // Add new notification at the top
        const updated = [notification, ...prev];
        // Keep only the latest N toasts
        return updated.slice(0, maxVisibleToasts);
      });
    });

    return cleanup;
  }, []);

  const handleRemoveToast = (id: string) => {
    setVisibleToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <div className="notification-toast-container">
      {visibleToasts.map((toast) => (
        <NotificationToast
          key={toast.id}
          notification={toast}
          theme={theme}
          onClose={() => handleRemoveToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default NotificationToast;
