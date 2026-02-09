import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useNotifyStore } from '../notifyStore';
import { useTerminalStore } from '../terminalStore';
import { NotificationItem } from '../../types/global';

// Mock nanoid for consistent IDs in notifications
let notificationIdCounter = 0;
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => `notification-${++notificationIdCounter}`),
}));

// Mock TerminalStore
vi.mock('../terminalStore', () => ({
  useTerminalStore: {
    getState: vi.fn(() => ({
      showSession: vi.fn(),
    })),
  },
}));

// Mock window.notification API
const mockOnReceived = vi.fn();
const mockOnClick = vi.fn();
const mockOnClearSession = vi.fn();
const mockOnClearAll = vi.fn();

describe('NotifyStore', () => {
  beforeEach(() => {
    // Reset counter
    notificationIdCounter = 0;

    // Reset store state
    useNotifyStore.setState({
      groups: {},
      totalUnread: 0,
      clearTimeouts: {},
      maxNotificationsPerSession: 3,
    });

    // Mock window.notification API
    window.notification = {
      onReceived: mockOnReceived.mockReturnValue(() => {}),
      onClick: mockOnClick.mockReturnValue(() => {}),
      onClearSession: mockOnClearSession.mockReturnValue(() => {}),
      onClearAll: mockOnClearAll.mockReturnValue(() => {}),
    } as any;

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear timers
    vi.clearAllTimers();
  });

const createMockNotification = (
  overrides?: Partial<NotificationItem>
): NotificationItem => ({
  id: `notification-${++notificationIdCounter}`,
  sessionId: 'session-1',
  sessionName: 'Test Session',
  title: 'Test Notification',
  body: 'Test message',
  type: 'success',
  timestamp: Date.now(),
  read: false,
  ...overrides,
});

  describe('Initial State', () => {
    it('should have empty groups', () => {
      const state = useNotifyStore.getState();
      expect(state.groups).toEqual({});
    });

    it('should have totalUnread = 0', () => {
      const state = useNotifyStore.getState();
      expect(state.totalUnread).toBe(0);
    });

    it('should have empty clearTimeouts', () => {
      const state = useNotifyStore.getState();
      expect(state.clearTimeouts).toEqual({});
    });

    it('should have maxNotificationsPerSession = 3', () => {
      const state = useNotifyStore.getState();
      expect(state.maxNotificationsPerSession).toBe(3);
    });
  });

  describe('addNotification', () => {
    it('should add notification to correct session', () => {
      const { addNotification } = useNotifyStore.getState();
      const notification = createMockNotification();

      addNotification(notification);

      const state = useNotifyStore.getState();
      expect(state.groups['session-1']).toBeDefined();
      expect(state.groups['session-1'].notifications).toHaveLength(1);
      expect(state.groups['session-1'].notifications[0]).toEqual(notification);
    });

    it('should update unreadCount when adding notification', () => {
      const { addNotification } = useNotifyStore.getState();
      const notification = createMockNotification();

      addNotification(notification);

      const state = useNotifyStore.getState();
      expect(state.groups['session-1'].unreadCount).toBe(1);
    });

    it('should update totalUnread count', () => {
      const { addNotification } = useNotifyStore.getState();
      const notification1 = createMockNotification();
      const notification2 = createMockNotification({ sessionId: 'session-2' });

      addNotification(notification1);
      addNotification(notification2);

      const state = useNotifyStore.getState();
      expect(state.totalUnread).toBe(2);
    });

    it('should prepend new notifications (LIFO order)', () => {
      const { addNotification } = useNotifyStore.getState();
      const notification1 = createMockNotification({ id: 'notif-1' });
      const notification2 = createMockNotification({ id: 'notif-2' });

      addNotification(notification1);
      addNotification(notification2);

      const state = useNotifyStore.getState();
      expect(state.groups['session-1'].notifications[0].id).toBe('notif-2');
      expect(state.groups['session-1'].notifications[1].id).toBe('notif-1');
    });

    it('should limit notifications per session to maxNotificationsPerSession', () => {
      const { addNotification } = useNotifyStore.getState();
      const notifications = [
        createMockNotification({ id: 'notif-1' }),
        createMockNotification({ id: 'notif-2' }),
        createMockNotification({ id: 'notif-3' }),
        createMockNotification({ id: 'notif-4' }),
      ];

      notifications.forEach(n => addNotification(n));

      const state = useNotifyStore.getState();
      expect(state.groups['session-1'].notifications).toHaveLength(3);
      // Should keep the 3 most recent (notif-4, notif-3, notif-2)
      expect(state.groups['session-1'].notifications[0].id).toBe('notif-4');
      expect(state.groups['session-1'].notifications[1].id).toBe('notif-3');
      expect(state.groups['session-1'].notifications[2].id).toBe('notif-2');
    });

    it('should update latestTimestamp in group', () => {
      const { addNotification } = useNotifyStore.getState();
      const now = Date.now();
      const notification = createMockNotification({ timestamp: now });

      addNotification(notification);

      const state = useNotifyStore.getState();
      expect(state.groups['session-1'].latestTimestamp).toBe(now);
    });

    it('should create new group with sessionName', () => {
      const { addNotification } = useNotifyStore.getState();
      const notification = createMockNotification({ sessionName: 'My Session' });

      addNotification(notification);

      const state = useNotifyStore.getState();
      expect(state.groups['session-1'].sessionName).toBe('My Session');
    });

    it('should cancel pending delayed clear when adding notification', () => {
      vi.useFakeTimers();
      const { addNotification, clearSessionDelayed } = useNotifyStore.getState();

      clearSessionDelayed('session-1', 1000);
      expect(useNotifyStore.getState().clearTimeouts['session-1']).toBeDefined();

      const notification = createMockNotification();
      addNotification(notification);

      // The timeout should be cleared
      expect(useNotifyStore.getState().clearTimeouts['session-1']).toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe('removeNotification', () => {
    it('should remove notification by ID', () => {
      const { addNotification, removeNotification } = useNotifyStore.getState();
      const notification = createMockNotification({ id: 'notif-1' });

      addNotification(notification);
      removeNotification('session-1', 'notif-1');

      const state = useNotifyStore.getState();
      expect(state.groups['session-1']).toBeUndefined();
    });

    it('should clean up empty groups', () => {
      const { addNotification, removeNotification } = useNotifyStore.getState();
      const notification = createMockNotification();

      addNotification(notification);
      removeNotification('session-1', notification.id);

      const state = useNotifyStore.getState();
      expect(state.groups['session-1']).toBeUndefined();
    });

    it('should decrease unreadCount if notification was unread', () => {
      const { addNotification, removeNotification } = useNotifyStore.getState();
      const notification = createMockNotification({ read: false });

      addNotification(notification);
      removeNotification('session-1', notification.id);

      const state = useNotifyStore.getState();
      expect(state.totalUnread).toBe(0);
    });

    it('should not decrease unreadCount if notification was read', () => {
      const { addNotification, removeNotification } = useNotifyStore.getState();
      const notification = createMockNotification({ read: true });

      addNotification(notification);
      expect(useNotifyStore.getState().groups['session-1'].unreadCount).toBe(0);

      removeNotification('session-1', notification.id);

      const state = useNotifyStore.getState();
      expect(state.totalUnread).toBe(0);
    });

    it('should update totalUnread when removing notification', () => {
      const { addNotification, removeNotification } = useNotifyStore.getState();
      const notification1 = createMockNotification({ id: 'notif-1' });
      const notification2 = createMockNotification({ id: 'notif-2', sessionId: 'session-2' });

      addNotification(notification1);
      addNotification(notification2);
      expect(useNotifyStore.getState().totalUnread).toBe(2);

      removeNotification('session-1', 'notif-1');

      const state = useNotifyStore.getState();
      expect(state.totalUnread).toBe(1);
    });

    it('should handle removing from non-existent group', () => {
      const { removeNotification } = useNotifyStore.getState();

      expect(() => removeNotification('non-existent-session', 'notif-1')).not.toThrow();
    });
  });

  describe('clearSession', () => {
    it('should remove entire session group', () => {
      const { addNotification, clearSession } = useNotifyStore.getState();
      const notification = createMockNotification();

      addNotification(notification);
      clearSession('session-1');

      const state = useNotifyStore.getState();
      expect(state.groups['session-1']).toBeUndefined();
    });

    it('should update totalUnread', () => {
      const { addNotification, clearSession } = useNotifyStore.getState();
      const notification1 = createMockNotification();
      const notification2 = createMockNotification({ sessionId: 'session-2' });

      addNotification(notification1);
      addNotification(notification2);
      expect(useNotifyStore.getState().totalUnread).toBe(2);

      clearSession('session-1');

      const state = useNotifyStore.getState();
      expect(state.totalUnread).toBe(1);
    });

    it('should cancel pending delayed clear', () => {
      vi.useFakeTimers();
      const { clearSession, clearSessionDelayed } = useNotifyStore.getState();

      clearSessionDelayed('session-1', 1000);
      expect(useNotifyStore.getState().clearTimeouts['session-1']).toBeDefined();

      clearSession('session-1');

      expect(useNotifyStore.getState().clearTimeouts['session-1']).toBeUndefined();
      vi.useRealTimers();
    });

    it('should handle clearing non-existent session', () => {
      const { clearSession } = useNotifyStore.getState();

      expect(() => clearSession('non-existent-session')).not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('should remove all groups', () => {
      const { addNotification, clearAll } = useNotifyStore.getState();
      addNotification(createMockNotification());
      addNotification(createMockNotification({ sessionId: 'session-2' }));

      clearAll();

      const state = useNotifyStore.getState();
      expect(state.groups).toEqual({});
    });

    it('should reset totalUnread to 0', () => {
      const { addNotification, clearAll } = useNotifyStore.getState();
      addNotification(createMockNotification());
      addNotification(createMockNotification({ sessionId: 'session-2' }));

      clearAll();

      const state = useNotifyStore.getState();
      expect(state.totalUnread).toBe(0);
    });

    it('should clear all pending delayed clears', () => {
      vi.useFakeTimers();
      const { clearAll, clearSessionDelayed } = useNotifyStore.getState();

      clearSessionDelayed('session-1', 1000);
      clearSessionDelayed('session-2', 2000);

      clearAll();

      expect(useNotifyStore.getState().clearTimeouts).toEqual({});
      vi.useRealTimers();
    });
  });

  describe('markAsRead', () => {
    it('should set unreadCount to 0 for session', () => {
      const { addNotification, markAsRead } = useNotifyStore.getState();
      const notification = createMockNotification();

      addNotification(notification);
      markAsRead('session-1');

      const state = useNotifyStore.getState();
      expect(state.groups['session-1'].unreadCount).toBe(0);
    });

    it('should mark all notifications as read', () => {
      const { addNotification, markAsRead } = useNotifyStore.getState();
      const notification1 = createMockNotification({ id: 'notif-1', read: false });
      const notification2 = createMockNotification({ id: 'notif-2', read: false });

      addNotification(notification1);
      addNotification(notification2);
      markAsRead('session-1');

      const state = useNotifyStore.getState();
      expect(state.groups['session-1'].notifications[0].read).toBe(true);
      expect(state.groups['session-1'].notifications[1].read).toBe(true);
    });

    it('should update totalUnread', () => {
      const { addNotification, markAsRead } = useNotifyStore.getState();
      addNotification(createMockNotification());
      addNotification(createMockNotification({ sessionId: 'session-2' }));

      markAsRead('session-1');

      const state = useNotifyStore.getState();
      expect(state.totalUnread).toBe(1);
    });

    it('should handle marking non-existent session', () => {
      const { markAsRead } = useNotifyStore.getState();

      expect(() => markAsRead('non-existent-session')).not.toThrow();
    });
  });

  describe('clearSessionDelayed', () => {
    it('should clear session after delay', () => {
      vi.useFakeTimers();
      const { addNotification, clearSessionDelayed } = useNotifyStore.getState();
      const notification = createMockNotification();

      addNotification(notification);
      clearSessionDelayed('session-1', 1000);

      expect(useNotifyStore.getState().groups['session-1']).toBeDefined();

      vi.advanceTimersByTime(1000);

      expect(useNotifyStore.getState().groups['session-1']).toBeUndefined();
      vi.useRealTimers();
    });

    it('should use default delay of 3000ms', () => {
      vi.useFakeTimers();
      const { addNotification, clearSessionDelayed } = useNotifyStore.getState();
      const notification = createMockNotification();

      addNotification(notification);
      clearSessionDelayed('session-1');

      vi.advanceTimersByTime(3000);

      expect(useNotifyStore.getState().groups['session-1']).toBeUndefined();
      vi.useRealTimers();
    });

    it('should record timeout ID', () => {
      vi.useFakeTimers();
      const { clearSessionDelayed } = useNotifyStore.getState();

      clearSessionDelayed('session-1', 1000);

      expect(useNotifyStore.getState().clearTimeouts['session-1']).toBeDefined();
      vi.useRealTimers();
    });

    it('should cancel previous delayed clear', () => {
      vi.useFakeTimers();
      const { addNotification, clearSessionDelayed } = useNotifyStore.getState();
      const notification = createMockNotification();

      addNotification(notification);
      clearSessionDelayed('session-1', 1000);
      const firstTimeout = useNotifyStore.getState().clearTimeouts['session-1'];

      clearSessionDelayed('session-1', 2000);
      const secondTimeout = useNotifyStore.getState().clearTimeouts['session-1'];

      expect(firstTimeout).not.toBe(secondTimeout);

      // Advance by original delay - should not clear
      vi.advanceTimersByTime(1000);
      expect(useNotifyStore.getState().groups['session-1']).toBeDefined();

      // Advance by remaining time
      vi.advanceTimersByTime(1000);
      expect(useNotifyStore.getState().groups['session-1']).toBeUndefined();
      vi.useRealTimers();
    });

    it('should clean up timeout record after clearing', () => {
      vi.useFakeTimers();
      const { addNotification, clearSessionDelayed } = useNotifyStore.getState();
      const notification = createMockNotification();

      addNotification(notification);
      clearSessionDelayed('session-1', 1000);

      vi.advanceTimersByTime(1000);

      expect(useNotifyStore.getState().clearTimeouts['session-1']).toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe('cancelDelayedClear', () => {
    it('should cancel pending delayed clear', () => {
      vi.useFakeTimers();
      const { addNotification, clearSessionDelayed, cancelDelayedClear } =
        useNotifyStore.getState();
      const notification = createMockNotification();

      addNotification(notification);
      clearSessionDelayed('session-1', 1000);
      cancelDelayedClear('session-1');

      vi.advanceTimersByTime(1000);

      expect(useNotifyStore.getState().groups['session-1']).toBeDefined();
      vi.useRealTimers();
    });

    it('should remove timeout from clearTimeouts', () => {
      vi.useFakeTimers();
      const { clearSessionDelayed, cancelDelayedClear } = useNotifyStore.getState();

      clearSessionDelayed('session-1', 1000);
      expect(useNotifyStore.getState().clearTimeouts['session-1']).toBeDefined();

      cancelDelayedClear('session-1');

      expect(useNotifyStore.getState().clearTimeouts['session-1']).toBeUndefined();
      vi.useRealTimers();
    });

    it('should handle canceling non-existent timeout', () => {
      const { cancelDelayedClear } = useNotifyStore.getState();

      expect(() => cancelDelayedClear('non-existent-session')).not.toThrow();
    });
  });

  describe('getAllGroups', () => {
    it('should return empty array when no groups', () => {
      const { getAllGroups } = useNotifyStore.getState();
      expect(getAllGroups()).toEqual([]);
    });

    it('should return all groups', () => {
      const { addNotification, getAllGroups } = useNotifyStore.getState();
      const notification1 = createMockNotification();
      const notification2 = createMockNotification({ sessionId: 'session-2' });

      addNotification(notification1);
      addNotification(notification2);

      const groups = getAllGroups();
      expect(groups).toHaveLength(2);
      expect(groups.some(g => g.sessionId === 'session-1')).toBe(true);
      expect(groups.some(g => g.sessionId === 'session-2')).toBe(true);
    });

    it('should return groups sorted by latestTimestamp (descending)', () => {
      const { addNotification, getAllGroups } = useNotifyStore.getState();
      const now = Date.now();

      const notification1 = createMockNotification({ timestamp: now - 2000 });
      const notification2 = createMockNotification({
        sessionId: 'session-2',
        timestamp: now,
      });
      const notification3 = createMockNotification({
        sessionId: 'session-3',
        timestamp: now - 1000,
      });

      addNotification(notification1);
      addNotification(notification2);
      addNotification(notification3);

      const groups = getAllGroups();
      expect(groups[0].sessionId).toBe('session-2'); // Most recent
      expect(groups[1].sessionId).toBe('session-3');
      expect(groups[2].sessionId).toBe('session-1'); // Least recent
    });
  });

  describe('getSessionNotificationState', () => {
    it('should return null when no notifications for session', () => {
      const { getSessionNotificationState } = useNotifyStore.getState();
      const state = getSessionNotificationState('session-1');
      expect(state).toBeNull();
    });

    it('should return correct state shape', () => {
      const { addNotification, getSessionNotificationState } = useNotifyStore.getState();
      const notification = createMockNotification();

      addNotification(notification);

      const state = getSessionNotificationState('session-1');
      expect(state).toEqual({
        sessionId: 'session-1',
        count: expect.any(Number),
        latestType: expect.any(String),
        hasNotifications: true,
      });
    });

    it('should return correct unread count', () => {
      const { addNotification, getSessionNotificationState } = useNotifyStore.getState();
      const notification1 = createMockNotification({ id: 'notif-1' });
      const notification2 = createMockNotification({ id: 'notif-2' });

      addNotification(notification1);
      addNotification(notification2);

      const state = getSessionNotificationState('session-1');
      expect(state?.count).toBe(2);
    });

    it('should return latest notification type', () => {
      const { addNotification, getSessionNotificationState } = useNotifyStore.getState();
      const notification1 = createMockNotification({ id: 'notif-1', type: 'info' });
      const notification2 = createMockNotification({ id: 'notif-2', type: 'success' });

      addNotification(notification1);
      addNotification(notification2);

      const state = getSessionNotificationState('session-1');
      expect(state?.latestType).toBe('success'); // Most recent one
    });

    it('should return null when unreadCount is 0', () => {
      const { addNotification, markAsRead, getSessionNotificationState } =
        useNotifyStore.getState();
      const notification = createMockNotification();

      addNotification(notification);
      markAsRead('session-1');

      const state = getSessionNotificationState('session-1');
      expect(state).toBeNull();
    });
  });

  describe('setupListeners', () => {
    it('should register notification listeners', () => {
      const { setupListeners } = useNotifyStore.getState();

      setupListeners();

      expect(mockOnReceived).toHaveBeenCalled();
      expect(mockOnClick).toHaveBeenCalled();
      expect(mockOnClearSession).toHaveBeenCalled();
      expect(mockOnClearAll).toHaveBeenCalled();
    });

    it('should return cleanup function', () => {
      const { setupListeners } = useNotifyStore.getState();

      const cleanup = setupListeners();
      expect(typeof cleanup).toBe('function');
    });

    it('should add notification when onReceived callback is invoked', () => {
      const { setupListeners } = useNotifyStore.getState();
      let receivedCallback: any = null;

      mockOnReceived.mockImplementation((cb: any) => {
        receivedCallback = cb;
        return () => {};
      });

      setupListeners();

      const notification = createMockNotification();
      receivedCallback(notification);

      expect(useNotifyStore.getState().groups['session-1']).toBeDefined();
    });

    it('should remove notification when onClick callback is invoked with notificationId', () => {
      const { addNotification, setupListeners } = useNotifyStore.getState();
      let clickCallback: any = null;

      mockOnClick.mockImplementation((cb: any) => {
        clickCallback = cb;
        return () => {};
      });

      const notification = createMockNotification({ id: 'notif-1' });
      addNotification(notification);

      setupListeners();

      clickCallback({ sessionId: 'session-1', notificationId: 'notif-1' });

      expect(useNotifyStore.getState().groups['session-1']).toBeUndefined();
    });

    it('should mark as read when onClick callback is invoked without notificationId', () => {
      const { addNotification, setupListeners } = useNotifyStore.getState();
      let clickCallback: any = null;

      mockOnClick.mockImplementation((cb: any) => {
        clickCallback = cb;
        return () => {};
      });

      const notification = createMockNotification();
      addNotification(notification);

      setupListeners();

      clickCallback({ sessionId: 'session-1' });

      expect(useNotifyStore.getState().groups['session-1'].unreadCount).toBe(0);
    });

    it('should call showSession when onClick callback is invoked', () => {
      const mockShowSession = vi.fn();
      const { setupListeners } = useNotifyStore.getState();
      let clickCallback: any = null;

      mockOnClick.mockImplementation((cb: any) => {
        clickCallback = cb;
        return () => {};
      });

      (useTerminalStore.getState as any).mockReturnValue({
        showSession: mockShowSession,
      });

      setupListeners();

      clickCallback({ sessionId: 'session-1' });

      expect(mockShowSession).toHaveBeenCalledWith('session-1');
    });

    it('should clear session when onClearSession callback is invoked', () => {
      const { addNotification, setupListeners } = useNotifyStore.getState();
      let clearCallback: any = null;

      mockOnClearSession.mockImplementation((cb: any) => {
        clearCallback = cb;
        return () => {};
      });

      const notification = createMockNotification();
      addNotification(notification);

      setupListeners();

      clearCallback({ sessionId: 'session-1' });

      expect(useNotifyStore.getState().groups['session-1']).toBeUndefined();
    });

    it('should clear all when onClearAll callback is invoked', () => {
      const { addNotification, setupListeners } = useNotifyStore.getState();
      let clearAllCallback: any = null;

      mockOnClearAll.mockImplementation((cb: any) => {
        clearAllCallback = cb;
        return () => {};
      });

      addNotification(createMockNotification());
      addNotification(createMockNotification({ sessionId: 'session-2' }));

      setupListeners();

      clearAllCallback();

      expect(useNotifyStore.getState().groups).toEqual({});
    });
  });

  describe('Multiple Sessions', () => {
    it('should manage notifications for multiple sessions independently', () => {
      const { addNotification } = useNotifyStore.getState();

      addNotification(createMockNotification({ sessionId: 'session-1' }));
      addNotification(createMockNotification({ sessionId: 'session-2' }));
      addNotification(createMockNotification({ sessionId: 'session-3' }));

      const state = useNotifyStore.getState();
      expect(Object.keys(state.groups)).toHaveLength(3);
      expect(state.totalUnread).toBe(3);
    });

    it('should correctly update totalUnread across multiple sessions', () => {
      const { addNotification, markAsRead } = useNotifyStore.getState();

      addNotification(createMockNotification({ sessionId: 'session-1' }));
      addNotification(createMockNotification({ sessionId: 'session-2' }));
      addNotification(createMockNotification({ sessionId: 'session-2' }));

      expect(useNotifyStore.getState().totalUnread).toBe(3);

      markAsRead('session-1');

      expect(useNotifyStore.getState().totalUnread).toBe(2);
    });
  });
});
