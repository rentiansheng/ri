import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotifyList from '../NotifyList';
import { useTerminalStore } from '../../store/terminalStore';
import { useNotifyStore } from '../../store/notifyStore';
import { NotificationItem, NotificationGroup } from '../../types/global';

vi.mock('../../store/terminalStore');
vi.mock('../../store/notifyStore');
vi.mock('../../utils/timeFormat', () => ({
  formatRelativeTime: (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  },
}));

const mockNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    sessionId: 'session-1',
    sessionName: 'Session 1',
    title: 'Build completed',
    body: 'Build process finished',
    type: 'success',
    timestamp: Date.now() - 60000,
    read: false,
  },
  {
    id: 'notif-2',
    sessionId: 'session-1',
    sessionName: 'Session 1',
    title: 'Test failed',
    body: 'Test suite execution failed',
    type: 'error',
    timestamp: Date.now() - 120000,
    read: false,
  },
  {
    id: 'notif-3',
    sessionId: 'session-2',
    sessionName: 'Session 2',
    title: 'Info message',
    body: 'Information message',
    type: 'info',
    timestamp: Date.now() - 180000,
    read: true,
  },
];

const mockGroups: NotificationGroup[] = [
  {
    sessionId: 'session-1',
    sessionName: 'Session 1',
    notifications: mockNotifications.slice(0, 2),
    unreadCount: 2,
    latestTimestamp: Date.now() - 60000,
  },
  {
    sessionId: 'session-2',
    sessionName: 'Session 2',
    notifications: mockNotifications.slice(2),
    unreadCount: 0,
    latestTimestamp: Date.now() - 180000,
  },
];

const mockOnSessionSelect = vi.fn();
const mockMarkAsRead = vi.fn();
const mockClearAll = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  (useNotifyStore as any).mockReturnValue({
    groups: {
      'session-1': mockGroups[0],
      'session-2': mockGroups[1],
    },
    getAllGroups: vi.fn(() => mockGroups),
    totalUnread: 2,
    markAsRead: mockMarkAsRead,
  });

  (useTerminalStore as any).mockImplementation((selector: any) => {
    const store = {
      showSession: vi.fn(),
    };
    return selector(store);
  });

  window.notification = {
    clearAll: vi.fn(mockClearAll),
    clear: vi.fn(),
  } as any;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('NotifyList', () => {
  describe('Rendering', () => {
    it('should render header with NOTIFICATIONS title', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      expect(screen.getByText('NOTIFICATIONS')).toBeInTheDocument();
    });

    it('should render empty state when no notifications', () => {
      (useNotifyStore as any).mockReturnValue({
        groups: {},
        getAllGroups: vi.fn(() => []),
        totalUnread: 0,
        markAsRead: mockMarkAsRead,
      });

      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      expect(screen.getByText('No notifications')).toBeInTheDocument();
      expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
    });

    it('should render notification groups', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      expect(screen.getByText('📜 Session 1')).toBeInTheDocument();
      expect(screen.getByText('📜 Session 2')).toBeInTheDocument();
    });

    it('should render notification items within groups', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      expect(screen.getByText('Build completed')).toBeInTheDocument();
      expect(screen.getByText('Test failed')).toBeInTheDocument();
      expect(screen.getByText('Info message')).toBeInTheDocument();
    });
  });

  describe('Notification Type Icons', () => {
    it('should display success icon for success notification', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const icons = document.querySelectorAll('.notify-list-preview-icon');
      const successIcon = Array.from(icons).find(icon => icon.textContent === '✅');
      expect(successIcon).toBeInTheDocument();
    });

    it('should display error icon for error notification', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const icons = document.querySelectorAll('.notify-list-preview-icon');
      const errorIcon = Array.from(icons).find(icon => icon.textContent === '❌');
      expect(errorIcon).toBeInTheDocument();
    });

    it('should display info icon for info notification', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const icons = document.querySelectorAll('.notify-list-preview-icon');
      const infoIcon = Array.from(icons).find(icon => icon.textContent === 'ℹ️');
      expect(infoIcon).toBeInTheDocument();
    });

    it('should display custom icon when provided', () => {
      const customNotifications: NotificationItem[] = [
        {
          ...mockNotifications[0],
          icon: '🎉',
        },
      ];

      const customGroup: NotificationGroup = {
        sessionId: 'session-custom',
        sessionName: 'Custom Session',
        notifications: customNotifications,
        unreadCount: 1,
        latestTimestamp: Date.now(),
      };

      (useNotifyStore as any).mockReturnValue({
        groups: { 'session-custom': customGroup },
        getAllGroups: vi.fn(() => [customGroup]),
        totalUnread: 1,
        markAsRead: mockMarkAsRead,
      });

      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const customIcon = document.querySelector('.notify-list-preview-icon');
      expect(customIcon).toHaveTextContent('🎉');
    });
  });

  describe('Unread Count Badge', () => {
    it('should display total unread count in header', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const badge = document.querySelector('.notify-list-badge');
      expect(badge).toHaveTextContent('2');
    });

    it('should not display badge when no unread notifications', () => {
      (useNotifyStore as any).mockReturnValue({
        groups: {
          'session-1': { ...mockGroups[0], unreadCount: 0 },
          'session-2': mockGroups[1],
        },
        getAllGroups: vi.fn(() => [
          { ...mockGroups[0], unreadCount: 0 },
          mockGroups[1],
        ]),
        totalUnread: 0,
        markAsRead: mockMarkAsRead,
      });

      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const badge = document.querySelector('.notify-list-badge');
      expect(badge).not.toBeInTheDocument();
    });

    it('should display group unread count', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const groupBadges = document.querySelectorAll('.notify-list-group-badge');
      expect(groupBadges[0]).toHaveTextContent('2');
    });

    it('should not display group badge when unread count is zero', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const groupBadges = document.querySelectorAll('.notify-list-group-badge');
      expect(groupBadges).toHaveLength(1);
      expect(groupBadges[0]).toHaveTextContent('2');
    });
  });

  describe('Time Formatting', () => {
    it('should display formatted relative time', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const timeElements = document.querySelectorAll('.notify-list-preview-time');
      expect(timeElements.length).toBeGreaterThan(0);

      expect(timeElements[0].textContent).toMatch(/\d+m ago|just now|recently/);
    });

    it('should show relative time for old notifications', () => {
      const oldNotifications: NotificationItem[] = [
        {
          ...mockNotifications[0],
          timestamp: Date.now() - 86400000,
        },
      ];

      const oldGroup: NotificationGroup = {
        sessionId: 'session-old',
        sessionName: 'Old Session',
        notifications: oldNotifications,
        unreadCount: 1,
        latestTimestamp: Date.now() - 86400000,
      };

      (useNotifyStore as any).mockReturnValue({
        groups: { 'session-old': oldGroup },
        getAllGroups: vi.fn(() => [oldGroup]),
        totalUnread: 1,
        markAsRead: mockMarkAsRead,
      });

      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const timeElement = document.querySelector('.notify-list-preview-time');
      expect(timeElement).toHaveTextContent(/\d+d ago/);
    });
  });

  describe('Session Selection', () => {
    it('should call onSessionSelect when clicking a group', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const group = screen.getByText('📜 Session 1').closest('.notify-list-group');
      fireEvent.click(group!);

      expect(mockOnSessionSelect).toHaveBeenCalledWith('session-1');
    });

    it('should highlight selected session group', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId="session-1" />
      );

      const activeGroup = document.querySelector('.notify-list-group.active');
      expect(activeGroup).toBeInTheDocument();
      expect(activeGroup).toHaveTextContent('Session 1');
    });

    it('should not highlight non-selected groups', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId="session-1" />
      );

      const groups = document.querySelectorAll('.notify-list-group');
      expect(groups[0]).toHaveClass('active');
      expect(groups[1]).not.toHaveClass('active');
    });
  });

  describe('Mark as Read', () => {
    it('should mark all notifications as read when clicking header button', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const markAllButton = screen.getByTitle('Mark all as read');
      fireEvent.click(markAllButton);

      expect(mockMarkAsRead).toHaveBeenCalledWith('session-1');
      expect(mockMarkAsRead).toHaveBeenCalledWith('session-2');
    });

    it('should disable mark all button when no unread notifications', () => {
      (useNotifyStore as any).mockReturnValue({
        groups: {
          'session-1': { ...mockGroups[0], unreadCount: 0 },
          'session-2': mockGroups[1],
        },
        getAllGroups: vi.fn(() => [
          { ...mockGroups[0], unreadCount: 0 },
          mockGroups[1],
        ]),
        totalUnread: 0,
        markAsRead: mockMarkAsRead,
      });

      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const markAllButton = screen.getByTitle('Mark all as read');
      expect(markAllButton).toBeDisabled();
    });

    it('should mark session as read when clicking session button', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const sessionMarkButtons = document.querySelectorAll('.notify-list-group-action');
      fireEvent.click(sessionMarkButtons[0]);

      expect(mockMarkAsRead).toHaveBeenCalledWith('session-1');
    });

    it('should stop propagation when marking session as read', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const sessionMarkButtons = document.querySelectorAll('.notify-list-group-action');
      const event = new MouseEvent('click', { bubbles: true });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      fireEvent.click(sessionMarkButtons[0], event);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('Clear Notifications', () => {
    it('should call clearAll when clicking clear all button', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const clearAllButton = screen.getByTitle('Clear all');
      fireEvent.click(clearAllButton);

      expect(mockClearAll).toHaveBeenCalled();
    });

    it('should call clear session when clicking session clear button', () => {
      const mockClearSession = vi.fn();
      window.notification.clear = mockClearSession;

      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const sessionClearButtons = document.querySelectorAll('.notify-list-group-clear');
      fireEvent.click(sessionClearButtons[0]);

      expect(mockClearSession).toHaveBeenCalledWith('session-1');
    });

    it('should stop propagation when clearing session', () => {
      const mockClearSession = vi.fn();
      window.notification.clear = mockClearSession;

      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const sessionClearButtons = document.querySelectorAll('.notify-list-group-clear');
      const event = new MouseEvent('click', { bubbles: true });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      fireEvent.click(sessionClearButtons[0], event);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('Read/Unread State', () => {
    it('should apply unread class to unread notifications', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const unreadNotifications = document.querySelectorAll('.notify-list-preview.unread');
      expect(unreadNotifications.length).toBeGreaterThan(0);
    });

    it('should apply read class to read notifications', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const readNotifications = document.querySelectorAll('.notify-list-preview.read');
      expect(readNotifications.length).toBeGreaterThan(0);
    });
  });

  describe('Notification Grouping', () => {
    it('should limit visible notifications to 3 per group', () => {
      const manyNotifications: NotificationItem[] = Array.from({ length: 5 }, (_, i) => ({
        ...mockNotifications[0],
        id: `notif-${i}`,
        timestamp: Date.now() - i * 1000,
      }));

      const manyGroup: NotificationGroup = {
        sessionId: 'session-many',
        sessionName: 'Many Notifications',
        notifications: manyNotifications,
        unreadCount: 5,
        latestTimestamp: Date.now(),
      };

      (useNotifyStore as any).mockReturnValue({
        groups: { 'session-many': manyGroup },
        getAllGroups: vi.fn(() => [manyGroup]),
        totalUnread: 5,
        markAsRead: mockMarkAsRead,
      });

      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const notifications = document.querySelectorAll('.notify-list-preview');
      expect(notifications).toHaveLength(3);
    });

    it('should show "more" indicator when notifications exceed limit', () => {
      const manyNotifications: NotificationItem[] = Array.from({ length: 5 }, (_, i) => ({
        ...mockNotifications[0],
        id: `notif-${i}`,
        timestamp: Date.now() - i * 1000,
      }));

      const manyGroup: NotificationGroup = {
        sessionId: 'session-many',
        sessionName: 'Many Notifications',
        notifications: manyNotifications,
        unreadCount: 5,
        latestTimestamp: Date.now(),
      };

      (useNotifyStore as any).mockReturnValue({
        groups: { 'session-many': manyGroup },
        getAllGroups: vi.fn(() => [manyGroup]),
        totalUnread: 5,
        markAsRead: mockMarkAsRead,
      });

      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const moreIndicator = document.querySelector('.notify-list-more');
      expect(moreIndicator).toBeInTheDocument();
      expect(moreIndicator).toHaveTextContent('+2 more');
    });

    it('should not show more indicator when notifications are 3 or fewer', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const moreIndicator = document.querySelector('.notify-list-more');
      expect(moreIndicator).not.toBeInTheDocument();
    });
  });

  describe('Session Names', () => {
    it('should display session name in group header', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      expect(screen.getByText('📜 Session 1')).toBeInTheDocument();
      expect(screen.getByText('📜 Session 2')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should render empty state message', () => {
      (useNotifyStore as any).mockReturnValue({
        groups: {},
        getAllGroups: vi.fn(() => []),
        totalUnread: 0,
        markAsRead: mockMarkAsRead,
      });

      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });

    it('should render helpful hint in empty state', () => {
      (useNotifyStore as any).mockReturnValue({
        groups: {},
        getAllGroups: vi.fn(() => []),
        totalUnread: 0,
        markAsRead: mockMarkAsRead,
      });

      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('should accept selectedSessionId prop', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId="session-1" />
      );

      const activeGroup = document.querySelector('.notify-list-group.active');
      expect(activeGroup).toHaveTextContent('Session 1');
    });

    it('should accept onSessionSelect callback', () => {
      render(
        <NotifyList onSessionSelect={mockOnSessionSelect} selectedSessionId={null} />
      );

      const group = screen.getByText('📜 Session 1').closest('.notify-list-group');
      fireEvent.click(group!);

      expect(mockOnSessionSelect).toHaveBeenCalled();
    });
  });
});
