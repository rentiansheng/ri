import { create } from 'zustand';
import { NotificationItem, NotificationGroup, NotificationType } from '../types/global';
import { useTerminalStore } from './terminalStore';

interface NotifyState {
  // Use Record instead of Map for proper Zustand reactivity
  groups: Record<string, NotificationGroup>;
  maxNotificationsPerSession: number;
  totalUnread: number;  // Cache total unread count
  clearTimeouts: Record<string, NodeJS.Timeout>;  // Delayed clear timeouts
  
  // Computed
  getAllGroups: () => NotificationGroup[];
  getSessionNotificationState: (sessionId: string) => {
    sessionId: string;
    count: number;
    latestType: NotificationType | null;
    hasNotifications: boolean;
  } | null;
  
  // Actions
  addNotification: (notification: NotificationItem) => void;
  removeNotification: (sessionId: string, notificationId: string) => void;
  clearSession: (sessionId: string) => void;
  clearAll: () => void;
  markAsRead: (sessionId: string) => void;
  setupListeners: () => () => void;
  
  // Delayed clear
  clearSessionDelayed: (sessionId: string, delayMs?: number) => void;
  cancelDelayedClear: (sessionId: string) => void;
  
  // Internal: update total unread count
  _updateTotalUnread: () => void;
}

export const useNotifyStore = create<NotifyState>((set, get) => ({
  groups: {},
  maxNotificationsPerSession: 3,
  totalUnread: 0,
  clearTimeouts: {},
  
  getAllGroups: () => {
    const { groups } = get();
    return Object.values(groups).sort((a, b) => b.latestTimestamp - a.latestTimestamp);
  },
  
  getSessionNotificationState: (sessionId: string) => {
    const { groups } = get();
    const group = groups[sessionId];
    
    if (!group || group.unreadCount === 0) {
      return null;
    }
    
    // Get the latest (first) notification type
    const latestType = group.notifications.length > 0 
      ? group.notifications[0].type 
      : null;
    
    return {
      sessionId,
      count: group.unreadCount,
      latestType,
      hasNotifications: true,
    };
  },
  
  _updateTotalUnread: () => {
    const { groups } = get();
    const total = Object.values(groups).reduce((sum, group) => sum + group.unreadCount, 0);
    set({ totalUnread: total });
  },
  
  cancelDelayedClear: (sessionId: string) => {
    const { clearTimeouts } = get();
    const timeoutId = clearTimeouts[sessionId];
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      
      set((state) => {
        const newTimeouts = { ...state.clearTimeouts };
        delete newTimeouts[sessionId];
        return { clearTimeouts: newTimeouts };
      });
    }
  },
  
  clearSessionDelayed: (sessionId: string, delayMs: number = 3000) => {
    const { cancelDelayedClear } = get();
    
    // Cancel any existing delayed clear for this session
    cancelDelayedClear(sessionId);
    
    // Set new delayed clear
    const timeoutId = setTimeout(() => {
      get().clearSession(sessionId);
      
      // Clean up timeout record
      set((state) => {
        const newTimeouts = { ...state.clearTimeouts };
        delete newTimeouts[sessionId];
        return { clearTimeouts: newTimeouts };
      });
    }, delayMs);
    
    // Record timeout ID
    set((state) => ({
      clearTimeouts: {
        ...state.clearTimeouts,
        [sessionId]: timeoutId,
      },
    }));
  },
  
  addNotification: (notification: NotificationItem) => {
    const { sessionId } = notification;
    
    // Cancel any pending delayed clear for this session
    get().cancelDelayedClear(sessionId);
    
    set((state) => {
      const { sessionName } = notification;
      
      // Get existing group or create new one
      const existingGroup = state.groups[sessionId];
      const group = existingGroup || {
        sessionId,
        sessionName,
        notifications: [],
        unreadCount: 0,
        latestTimestamp: 0,
      };
      
      // Add notification to group (prepend)
      const updatedNotifications = [notification, ...group.notifications];
      
      // Keep only the latest N notifications
      const trimmedNotifications = updatedNotifications.slice(0, state.maxNotificationsPerSession);
      
      // Update group
      const updatedGroup: NotificationGroup = {
        ...group,
        notifications: trimmedNotifications,
        unreadCount: group.unreadCount + 1,
        latestTimestamp: notification.timestamp,
      };
      
      // Create new groups object
      const newGroups = {
        ...state.groups,
        [sessionId]: updatedGroup,
      };
      
      // Calculate new total unread
      const newTotalUnread = Object.values(newGroups).reduce(
        (sum, g) => sum + g.unreadCount, 
        0
      );
      
      return { 
        groups: newGroups,
        totalUnread: newTotalUnread,
      };
    });
  },
  
  removeNotification: (sessionId: string, notificationId: string) => {
    set((state) => {
      const group = state.groups[sessionId];
      if (!group) return state;
      
      // Filter out the notification
      const updatedNotifications = group.notifications.filter(n => n.id !== notificationId);
      
      // If no more notifications, remove the entire group
      if (updatedNotifications.length === 0) {
        const newGroups = { ...state.groups };
        delete newGroups[sessionId];
        
        const newTotalUnread = Object.values(newGroups).reduce(
          (sum, g) => sum + g.unreadCount,
          0
        );
        
        return {
          groups: newGroups,
          totalUnread: newTotalUnread,
        };
      }
      
      // Update the group with remaining notifications
      const removedWasUnread = !group.notifications.find(n => n.id === notificationId)?.read;
      const updatedGroup: NotificationGroup = {
        ...group,
        notifications: updatedNotifications,
        unreadCount: removedWasUnread ? Math.max(0, group.unreadCount - 1) : group.unreadCount,
      };
      
      const newGroups = {
        ...state.groups,
        [sessionId]: updatedGroup,
      };
      
      const newTotalUnread = Object.values(newGroups).reduce(
        (sum, g) => sum + g.unreadCount,
        0
      );
      
      return {
        groups: newGroups,
        totalUnread: newTotalUnread,
      };
    });
  },
  
  clearSession: (sessionId: string) => {
    // Cancel any pending delayed clear
    get().cancelDelayedClear(sessionId);
    
    set((state) => {
      const newGroups = { ...state.groups };
      delete newGroups[sessionId];
      
      const newTotalUnread = Object.values(newGroups).reduce(
        (sum, g) => sum + g.unreadCount, 
        0
      );
      
      return { 
        groups: newGroups,
        totalUnread: newTotalUnread,
      };
    });
  },
  
  clearAll: () => {
    // Cancel all pending delayed clears
    const { clearTimeouts } = get();
    Object.values(clearTimeouts).forEach(timeoutId => clearTimeout(timeoutId));
    
    set({ groups: {}, totalUnread: 0, clearTimeouts: {} });
  },
  
  markAsRead: (sessionId: string) => {
    set((state) => {
      const group = state.groups[sessionId];
      if (!group) return state;
      
      const updatedGroup: NotificationGroup = {
        ...group,
        unreadCount: 0,
        notifications: group.notifications.map(n => ({ ...n, read: true })),
      };
      
      const newGroups = {
        ...state.groups,
        [sessionId]: updatedGroup,
      };
      
      const newTotalUnread = Object.values(newGroups).reduce(
        (sum, g) => sum + g.unreadCount, 
        0
      );
      
      return { 
        groups: newGroups,
        totalUnread: newTotalUnread,
      };
    });
  },
  
  setupListeners: () => {
    // Listen for new notifications
    const cleanupReceived = window.notification.onReceived((notification) => {
      get().addNotification(notification);
    });
    
    // Listen for notification clicks (from system notifications)
    const cleanupClick = window.notification.onClick((payload) => {
      const { sessionId, notificationId } = payload;
      
      // Remove the specific notification if ID is provided
      if (notificationId) {
        get().removeNotification(sessionId, notificationId);
      } else {
        // Fallback: mark all as read
        get().markAsRead(sessionId);
      }
      
      // showSession() now correctly handles tab activation
      const terminalStore = useTerminalStore.getState();
      terminalStore.showSession(sessionId);
    });
    
    // Listen for clear session command
    const cleanupClearSession = window.notification.onClearSession((payload) => {
      get().clearSession(payload.sessionId);
    });
    
    // Listen for clear all command
    const cleanupClearAll = window.notification.onClearAll(() => {
      get().clearAll();
    });
    
    // Return cleanup function
    return () => {
      cleanupReceived();
      cleanupClick();
      cleanupClearSession();
      cleanupClearAll();
    };
  },
}));

// Selectors for performance optimization
export const selectTotalUnread = (state: NotifyState) => state.totalUnread;
export const selectAllGroups = (state: NotifyState) => state.getAllGroups();
export const selectGroup = (sessionId: string) => (state: NotifyState) => 
  state.groups[sessionId];
