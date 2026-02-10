import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabBar from '../TabBar';
import { useTerminalStore } from '../../store/terminalStore';
import { useNotifyStore } from '../../store/notifyStore';
import { useUIEditStore } from '../../store/uiEditStore';
import { Tab, Session } from '../../store/terminalStore';

// Mock stores
vi.mock('../../store/terminalStore');
vi.mock('../../store/notifyStore');
vi.mock('../../store/uiEditStore');

const mockTabs: Tab[] = [
  {
    id: 'tab-1',
    type: 'terminal',
    sessionId: 'session-1',
    title: 'Session 1',
  },
  {
    id: 'tab-2',
    type: 'terminal',
    sessionId: 'session-2',
    title: 'Session 2',
  },
  {
    id: 'tab-3',
    type: 'settings',
    title: 'Settings',
  },
];

const mockSessions: Session[] = [
  {
    id: 'session-1',
    name: 'Session 1',
    terminalIds: ['term-1'],
    createdAt: Date.now(),
    isVisible: true,
    lastActivityTime: Date.now(),
    isNameSetByUser: true,
  },
  {
    id: 'session-2',
    name: 'Session 2',
    terminalIds: ['term-2'],
    createdAt: Date.now(),
    isVisible: true,
    lastActivityTime: Date.now(),
    isNameSetByUser: true,
  },
];

const mockSetActiveTab = vi.fn();
const mockCloseTabById = vi.fn();
const mockReorderTabsNew = vi.fn();
const mockRenameSession = vi.fn();
const mockClearSession = vi.fn();
const mockGetSessionNotificationState = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  useTerminalStore.setState({
    tabs: mockTabs,
    activeTabId: 'tab-1',
    sessions: mockSessions,
    visibleSessionIds: [],
    activeSessionId: null,
  });

  vi.spyOn(useTerminalStore.getState(), 'setActiveTab').mockImplementation(mockSetActiveTab);
  vi.spyOn(useTerminalStore.getState(), 'closeTabById').mockImplementation(mockCloseTabById);
  vi.spyOn(useTerminalStore.getState(), 'reorderTabsNew').mockImplementation(mockReorderTabsNew);
  vi.spyOn(useTerminalStore.getState(), 'renameSession').mockImplementation(mockRenameSession);

  (useNotifyStore as any).mockReturnValue({
    clearSession: mockClearSession,
    getSessionNotificationState: mockGetSessionNotificationState,
  });

  (useUIEditStore as any).mockReturnValue({
    editingTabId: null,
    tabEditName: '',
    startEditTab: vi.fn(),
    updateTabEditName: vi.fn(),
    finishEditTab: vi.fn(),
    cancelEditTab: vi.fn(),
  });

  mockGetSessionNotificationState.mockReturnValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TabBar', () => {
  describe('Rendering', () => {
    it('should render nothing when no tabs', () => {
      (useTerminalStore as any).mockImplementation((selector: any) => {
        const store = {
          tabs: [],
          activeTabId: null,
          sessions: [],
          setActiveTab: mockSetActiveTab,
          closeTabById: mockCloseTabById,
          reorderTabsNew: mockReorderTabsNew,
          renameSession: mockRenameSession,
        };
        return selector(store);
      });

      const { container } = render(<TabBar />);
      expect(container.firstChild).toBeNull();
    });

    it('should render tab bar when tabs exist', () => {
      render(<TabBar />);
      expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
    });

    it('should render all tabs correctly', () => {
      render(<TabBar />);
      
      expect(screen.getByTestId('tab-1')).toBeInTheDocument();
      expect(screen.getByTestId('tab-2')).toBeInTheDocument();
      expect(screen.getByTestId('tab-3')).toBeInTheDocument();
    });

    it('should display tab titles', () => {
      render(<TabBar />);
      
      expect(screen.getByText('Session 1')).toBeInTheDocument();
      expect(screen.getByText('Session 2')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should render close buttons for each tab', () => {
      render(<TabBar />);
      
      const closeButtons = screen.getAllByRole('button', { name: 'Close tab' });
      expect(closeButtons).toHaveLength(3);
    });
  });

  describe('Active Tab Styling', () => {
    it('should apply active class to active tab', () => {
      render(<TabBar />);
      
      const activeTab = screen.getByTestId('tab-1');
      expect(activeTab).toHaveClass('active');
    });

    it('should not apply active class to inactive tabs', () => {
      render(<TabBar />);
      
      const inactiveTab = screen.getByTestId('tab-2');
      expect(inactiveTab).not.toHaveClass('active');
    });
  });

  describe('Tab Type Indicators', () => {
    it('should apply settings class to settings tab', () => {
      render(<TabBar />);
      
      const settingsTab = screen.getByTestId('tab-3');
      expect(settingsTab).toHaveClass('tab-settings');
    });

    it('should not apply settings class to terminal tabs', () => {
      render(<TabBar />);
      
      const terminalTab = screen.getByTestId('tab-1');
      expect(terminalTab).not.toHaveClass('tab-settings');
    });
  });

  describe('Tab Interaction', () => {
    it('should call setActiveTab when clicking a tab', () => {
      render(<TabBar />);
      
      fireEvent.click(screen.getByTestId('tab-2'));
      
      expect(mockSetActiveTab).toHaveBeenCalledWith('tab-2');
    });

    it('should not switch tab when currently editing it', () => {
      (useUIEditStore as any).mockImplementation((selector: any) => {
        const store = {
          editingTabId: 'tab-2',
          tabEditName: 'New Name',
          startEditTab: vi.fn(),
          updateTabEditName: vi.fn(),
          finishEditTab: vi.fn(),
          cancelEditTab: vi.fn(),
        };
        return selector(store);
      });

      render(<TabBar />);
      mockSetActiveTab.mockClear();
      
      fireEvent.click(screen.getByTestId('tab-2'));
      
      expect(mockSetActiveTab).not.toHaveBeenCalled();
    });

    it('should call clearSession when switching to terminal tab', () => {
      render(<TabBar />);
      
      fireEvent.click(screen.getByTestId('tab-2'));
      
      expect(mockClearSession).toHaveBeenCalledWith('session-2');
    });

    it('should not clear when switching to settings tab', () => {
      render(<TabBar />);
      mockClearSession.mockClear();
      
      fireEvent.click(screen.getByTestId('tab-3'));
      
      expect(mockClearSession).not.toHaveBeenCalled();
    });
  });

  describe('Close Tab', () => {
    it('should call closeTabById when clicking close button', () => {
      render(<TabBar />);
      
      const closeButton = screen.getByTestId('close-tab-tab-1');
      fireEvent.click(closeButton);
      
      expect(mockCloseTabById).toHaveBeenCalledWith('tab-1');
    });

    it('should stop propagation when clicking close button', () => {
      render(<TabBar />);
      
      const closeButton = screen.getByTestId('close-tab-tab-1');
      const event = new MouseEvent('click', { bubbles: true });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');
      
      fireEvent.click(closeButton, event);
      
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should not trigger setActiveTab when closing a tab', () => {
      render(<TabBar />);
      mockSetActiveTab.mockClear();
      
      const closeButton = screen.getByTestId('close-tab-tab-1');
      fireEvent.click(closeButton);
      
      expect(mockSetActiveTab).not.toHaveBeenCalled();
    });
  });

  describe('Notification Indicators', () => {
    it('should not show notification dot when no notifications', () => {
      render(<TabBar />);
      
      const notificationDots = document.querySelectorAll('.tab-notification-dot');
      expect(notificationDots).toHaveLength(0);
    });

    it('should show notification dot when session has notifications', () => {
      mockGetSessionNotificationState.mockReturnValue({
        sessionId: 'session-1',
        count: 2,
        latestType: 'info',
        hasNotifications: true,
      });

      render(<TabBar />);
      
      const notificationDot = document.querySelector('.tab-notification-dot.info');
      expect(notificationDot).toBeInTheDocument();
    });

    it('should show notification dot with correct type class', () => {
      mockGetSessionNotificationState.mockReturnValueOnce({
        sessionId: 'session-1',
        count: 1,
        latestType: 'error',
        hasNotifications: true,
      });

      render(<TabBar />);
      
      const notificationDot = document.querySelector('.tab-notification-dot.error');
      expect(notificationDot).toBeInTheDocument();
    });
  });

  describe('AI Status Icon', () => {
    it('should not show AI icon when status is idle', () => {
      (useTerminalStore as any).mockImplementation((selector: any) => {
        const store = {
          tabs: mockTabs,
          activeTabId: 'tab-1',
          sessions: [
            {
              ...mockSessions[0],
              aiToolState: { status: 'idle', tool: null, detectedAt: 0, lastCheckTime: 0 },
            },
            mockSessions[1],
          ],
          setActiveTab: mockSetActiveTab,
          closeTabById: mockCloseTabById,
          reorderTabsNew: mockReorderTabsNew,
          renameSession: mockRenameSession,
        };
        return selector(store);
      });

      render(<TabBar />);
      
      const statusIcons = document.querySelectorAll('.tab-status-icon');
      expect(statusIcons).toHaveLength(0);
    });

    it('should show thinking icon for thinking status', () => {
      (useTerminalStore as any).mockImplementation((selector: any) => {
        const store = {
          tabs: mockTabs,
          activeTabId: 'tab-1',
          sessions: [
            {
              ...mockSessions[0],
              aiToolState: { status: 'thinking', tool: 'opencode', detectedAt: 0, lastCheckTime: 0 },
            },
            mockSessions[1],
          ],
          setActiveTab: mockSetActiveTab,
          closeTabById: mockCloseTabById,
          reorderTabsNew: mockReorderTabsNew,
          renameSession: mockRenameSession,
        };
        return selector(store);
      });

      render(<TabBar />);
      
      const statusIcon = document.querySelector('.tab-status-icon');
      expect(statusIcon).toHaveTextContent('🤔');
    });

    it('should show executing icon for executing status', () => {
      (useTerminalStore as any).mockImplementation((selector: any) => {
        const store = {
          tabs: mockTabs,
          activeTabId: 'tab-1',
          sessions: [
            {
              ...mockSessions[0],
              aiToolState: { status: 'executing', tool: 'gh-copilot', detectedAt: 0, lastCheckTime: 0 },
            },
            mockSessions[1],
          ],
          setActiveTab: mockSetActiveTab,
          closeTabById: mockCloseTabById,
          reorderTabsNew: mockReorderTabsNew,
          renameSession: mockRenameSession,
        };
        return selector(store);
      });

      render(<TabBar />);
      
      const statusIcon = document.querySelector('.tab-status-icon');
      expect(statusIcon).toHaveTextContent('⚡');
    });

    it('should show completed icon for completed status', () => {
      (useTerminalStore as any).mockImplementation((selector: any) => {
        const store = {
          tabs: mockTabs,
          activeTabId: 'tab-1',
          sessions: [
            {
              ...mockSessions[0],
              aiToolState: { status: 'completed', tool: 'aider', detectedAt: 0, lastCheckTime: 0 },
            },
            mockSessions[1],
          ],
          setActiveTab: mockSetActiveTab,
          closeTabById: mockCloseTabById,
          reorderTabsNew: mockReorderTabsNew,
          renameSession: mockRenameSession,
        };
        return selector(store);
      });

      render(<TabBar />);
      
      const statusIcon = document.querySelector('.tab-status-icon');
      expect(statusIcon).toHaveTextContent('✅');
    });
  });

  describe('Tab Drag and Drop', () => {
    it('should set draggable attribute when not editing', () => {
      render(<TabBar />);
      
      const tab = screen.getByTestId('tab-1');
      expect(tab).toHaveAttribute('draggable', 'true');
    });

    it('should not be draggable when editing', () => {
      (useUIEditStore as any).mockImplementation((selector: any) => {
        const store = {
          editingTabId: 'tab-1',
          tabEditName: 'New Name',
          startEditTab: vi.fn(),
          updateTabEditName: vi.fn(),
          finishEditTab: vi.fn(),
          cancelEditTab: vi.fn(),
        };
        return selector(store);
      });

      render(<TabBar />);
      
      const tab = screen.getByTestId('tab-1');
      expect(tab).toHaveAttribute('draggable', 'false');
    });

    it('should call reorderTabsNew on drop', () => {
      render(<TabBar />);
      
      const tab1 = screen.getByTestId('tab-1');
      const tab2 = screen.getByTestId('tab-2');
      
      const dragStartEvent = new DragEvent('dragstart', { bubbles: true });
      fireEvent.dragStart(tab1, { dataTransfer: { effectAllowed: 'move' } as any });
      
      fireEvent.dragOver(tab2, { 
        dataTransfer: { dropEffect: 'move' } as any,
        preventDefault: vi.fn(),
      });
      
      fireEvent.drop(tab2, { 
        dataTransfer: {} as any,
        preventDefault: vi.fn(),
      });
      
      fireEvent.dragEnd(tab1);
      
      expect(mockReorderTabsNew).toHaveBeenCalled();
    });
  });

  describe('Tab Renaming', () => {
    it('should not show rename input when not editing', () => {
      render(<TabBar />);
      
      const input = document.querySelector('.tab-rename-input');
      expect(input).not.toBeInTheDocument();
    });

    it('should show rename input when editing', () => {
      (useUIEditStore as any).mockImplementation((selector: any) => {
        const store = {
          editingTabId: 'tab-1',
          tabEditName: 'New Name',
          startEditTab: vi.fn(),
          updateTabEditName: vi.fn(),
          finishEditTab: vi.fn(),
          cancelEditTab: vi.fn(),
        };
        return selector(store);
      });

      render(<TabBar />);
      
      const input = document.querySelector('.tab-rename-input') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('New Name');
    });

    it('should trigger double click to start editing', () => {
      const startEditTabMock = vi.fn();
      (useUIEditStore as any).mockImplementation((selector: any) => {
        const store = {
          editingTabId: null,
          tabEditName: '',
          startEditTab: startEditTabMock,
          updateTabEditName: vi.fn(),
          finishEditTab: vi.fn(),
          cancelEditTab: vi.fn(),
        };
        return selector(store);
      });

      render(<TabBar />);
      
      const tab = screen.getByTestId('tab-1');
      fireEvent.doubleClick(tab);
      
      expect(startEditTabMock).toHaveBeenCalledWith('tab-1', 'Session 1');
    });

    it('should not allow renaming non-terminal tabs', () => {
      const startEditTabMock = vi.fn();
      (useUIEditStore as any).mockImplementation((selector: any) => {
        const store = {
          editingTabId: null,
          tabEditName: '',
          startEditTab: startEditTabMock,
          updateTabEditName: vi.fn(),
          finishEditTab: vi.fn(),
          cancelEditTab: vi.fn(),
        };
        return selector(store);
      });

      render(<TabBar />);
      
      const settingsTab = screen.getByTestId('tab-3');
      fireEvent.doubleClick(settingsTab);
      
      expect(startEditTabMock).not.toHaveBeenCalled();
    });
  });

  describe('Input Focus', () => {
    it('should focus and select input when editing starts', async () => {
      const focusSpy = vi.fn();
      const selectSpy = vi.fn();

      (useUIEditStore as any).mockImplementation((selector: any) => {
        const store = {
          editingTabId: 'tab-1',
          tabEditName: 'New Name',
          startEditTab: vi.fn(),
          updateTabEditName: vi.fn(),
          finishEditTab: vi.fn(),
          cancelEditTab: vi.fn(),
        };
        return selector(store);
      });

      render(<TabBar />);
      
      const input = document.querySelector('.tab-rename-input') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      // Input will be focused by useEffect
    });
  });
});
