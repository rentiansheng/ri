import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SessionList from '../SessionList';
import { useTerminalStore } from '../../store/terminalStore';
import { useNotifyStore } from '../../store/notifyStore';
import { useUIEditStore } from '../../store/uiEditStore';

const mockCreateSession = vi.fn();
const mockShowSession = vi.fn();
const mockRenameSession = vi.fn();
const mockDeleteSession = vi.fn();
const mockCloseTabById = vi.fn();

const mockSession1 = {
  id: 'session-1',
  name: 'Build Project',
  terminalIds: ['term-1'],
  createdAt: Date.now(),
  isVisible: true,
  lastActivityTime: Date.now(),
  aiToolState: null,
  isNameSetByUser: true,
};

const mockSession2 = {
  id: 'session-2',
  name: 'Deploy',
  terminalIds: ['term-2'],
  createdAt: Date.now(),
  isVisible: false,
  lastActivityTime: Date.now() - 3600000,
  aiToolState: null,
  isNameSetByUser: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  
  useTerminalStore.setState({
    sessions: [mockSession1, mockSession2],
    visibleSessionIds: ['session-1'],
    activeSessionId: 'session-1',
    tabs: [
      {
        id: 'tab-1',
        type: 'terminal',
        sessionId: 'session-1',
        title: 'Build Project',
      },
    ],
  });
  
  useNotifyStore.setState({
    groups: {},
    totalUnread: 0,
  });
  
  useUIEditStore.setState({
    editingSessionId: null,
    sessionEditName: '',
  });
  
  vi.spyOn(useTerminalStore.getState(), 'createSession').mockImplementation(mockCreateSession);
  vi.spyOn(useTerminalStore.getState(), 'showSession').mockImplementation(mockShowSession);
  vi.spyOn(useTerminalStore.getState(), 'renameSession').mockImplementation(mockRenameSession);
  vi.spyOn(useTerminalStore.getState(), 'deleteSession').mockImplementation(mockDeleteSession);
  vi.spyOn(useTerminalStore.getState(), 'closeTabById').mockImplementation(mockCloseTabById);
});

describe('SessionList', () => {
  describe('Rendering', () => {
    it('should render session list container', () => {
      render(<SessionList />);
      
      expect(screen.getByTestId('session-list')).toBeInTheDocument();
    });

    it('should render header with title', () => {
      render(<SessionList />);
      
      expect(screen.getByText('SESSIONS')).toBeInTheDocument();
    });

    it('should render create session button', () => {
      render(<SessionList />);
      
      const createBtn = screen.getByTestId('create-session-btn');
      expect(createBtn).toBeInTheDocument();
      expect(createBtn).toHaveTextContent('+');
    });

    it('should render empty state when no sessions', () => {
      useTerminalStore.setState({
        sessions: [],
        visibleSessionIds: [],
        activeSessionId: null,
      });
      
      render(<SessionList />);
      
      expect(screen.getByText('No sessions')).toBeInTheDocument();
      expect(screen.getByText('Click + to create')).toBeInTheDocument();
    });

    it('should render list of sessions', () => {
      render(<SessionList />);
      
      expect(screen.getByText('Build Project')).toBeInTheDocument();
      expect(screen.getByText('Deploy')).toBeInTheDocument();
    });

    it('should render all session items', () => {
      render(<SessionList />);
      
      expect(screen.getByTestId('session-item-session-1')).toBeInTheDocument();
      expect(screen.getByTestId('session-item-session-2')).toBeInTheDocument();
    });
  });

  describe('Session Visibility Indicator', () => {
    it('should show filled circle for visible sessions', () => {
      render(<SessionList />);
      
      const visibleSession = screen.getByTestId('session-item-session-1');
      expect(visibleSession).toHaveTextContent('●');
    });

    it('should show hollow circle for hidden sessions', () => {
      render(<SessionList />);
      
      const hiddenSession = screen.getByTestId('session-item-session-2');
      expect(hiddenSession).toHaveTextContent('○');
    });

    it('should update indicator when session visibility changes', () => {
      const { rerender } = render(<SessionList />);
      
      let session1 = screen.getByTestId('session-item-session-1');
      expect(session1).toHaveTextContent('●');
      
      useTerminalStore.setState({
        visibleSessionIds: [],
      });
      
      rerender(<SessionList />);
      
      session1 = screen.getByTestId('session-item-session-1');
      expect(session1).toHaveTextContent('○');
    });
  });

  describe('Active Session', () => {
    it('should highlight active session', () => {
      render(<SessionList />);
      
      const activeSession = screen.getByTestId('session-item-session-1');
      expect(activeSession).toHaveClass('active');
    });

    it('should not highlight inactive sessions', () => {
      render(<SessionList />);
      
      const inactiveSession = screen.getByTestId('session-item-session-2');
      expect(inactiveSession).not.toHaveClass('active');
    });

    it('should update active session highlight when selection changes', () => {
      const { rerender } = render(<SessionList />);
      
      expect(screen.getByTestId('session-item-session-1')).toHaveClass('active');
      expect(screen.getByTestId('session-item-session-2')).not.toHaveClass('active');
      
      useTerminalStore.setState({
        activeSessionId: 'session-2',
      });
      
      rerender(<SessionList />);
      
      expect(screen.getByTestId('session-item-session-1')).not.toHaveClass('active');
      expect(screen.getByTestId('session-item-session-2')).toHaveClass('active');
    });
  });

  describe('Session Selection', () => {
    it('should call showSession when clicking a session', () => {
      render(<SessionList />);
      
      fireEvent.click(screen.getByTestId('session-item-session-2'));
      
      expect(mockShowSession).toHaveBeenCalledWith('session-2');
    });

    it('should clear notifications when clicking a session', async () => {
      useNotifyStore.setState({
        groups: {
          'session-2': {
            sessionId: 'session-2',
            sessionName: 'Deploy',
            notifications: [],
            unreadCount: 2,
            latestTimestamp: Date.now(),
          },
        },
      });
      
      const clearSessionSpy = vi.spyOn(useNotifyStore.getState(), 'clearSession');
      
      render(<SessionList />);
      fireEvent.click(screen.getByTestId('session-item-session-2'));
      
      expect(clearSessionSpy).toHaveBeenCalledWith('session-2');
    });

    it('should not switch session when in edit mode', () => {
      useUIEditStore.setState({
        editingSessionId: 'session-1',
        sessionEditName: 'New Name',
      });
      
      render(<SessionList />);
      
      mockShowSession.mockClear();
      fireEvent.click(screen.getByTestId('session-item-session-1'));
      
      expect(mockShowSession).not.toHaveBeenCalled();
    });
  });

  describe('Session Rename', () => {
    it('should enter edit mode on double-click', async () => {
      render(<SessionList />);
      
      fireEvent.doubleClick(screen.getByTestId('session-item-session-1'));
      
      await waitFor(() => {
        const input = screen.getByTestId('rename-input-session-1');
        expect(input).toBeInTheDocument();
      });
    });

    it('should display current name in input', async () => {
      render(<SessionList />);
      
      fireEvent.doubleClick(screen.getByTestId('session-item-session-1'));
      
      await waitFor(() => {
        const input = screen.getByTestId('rename-input-session-1') as HTMLInputElement;
        expect(input.value).toBe('Build Project');
      });
    });

    it('should save rename on Enter key', async () => {
      render(<SessionList />);
      
      fireEvent.doubleClick(screen.getByTestId('session-item-session-1'));
      
      await waitFor(() => {
        const input = screen.getByTestId('rename-input-session-1') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'New Name' } });
        fireEvent.keyDown(input, { key: 'Enter' });
      });
      
      expect(mockRenameSession).toHaveBeenCalledWith('session-1', 'New Name');
    });

    it('should cancel rename on Escape key', async () => {
      render(<SessionList />);
      
      fireEvent.doubleClick(screen.getByTestId('session-item-session-1'));
      
      await waitFor(() => {
        const input = screen.getByTestId('rename-input-session-1') as HTMLInputElement;
        fireEvent.keyDown(input, { key: 'Escape' });
      });
      
      expect(mockRenameSession).not.toHaveBeenCalled();
    });

    it('should auto-select text when entering edit mode', async () => {
      render(<SessionList />);
      
      fireEvent.doubleClick(screen.getByTestId('session-item-session-1'));
      
      await waitFor(() => {
        const input = screen.getByTestId('rename-input-session-1') as HTMLInputElement;
        expect(input).toHaveFocus();
      });
    });

    it('should save rename when clicking outside edit input', async () => {
      render(<SessionList />);
      
      fireEvent.doubleClick(screen.getByTestId('session-item-session-1'));
      
      await waitFor(() => {
        const input = screen.getByTestId('rename-input-session-1') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'Updated Name' } });
      });
      
      fireEvent.mouseDown(document.body);
      
      expect(mockRenameSession).toHaveBeenCalledWith('session-1', 'Updated Name');
    });
  });

  describe('Create Session', () => {
    it('should create session when clicking + button', () => {
      render(<SessionList />);
      
      const createBtn = screen.getByTestId('create-session-btn');
      fireEvent.click(createBtn);
      
      expect(mockCreateSession).toHaveBeenCalled();
    });

    it('should show header with proper styling', () => {
      render(<SessionList />);
      
      const header = screen.getByText('SESSIONS').closest('.session-list-header');
      expect(header).toBeInTheDocument();
    });
  });

  describe('Delete Session', () => {
    it('should show delete button for each session', () => {
      render(<SessionList />);
      
      expect(screen.getByTestId('delete-session-session-1')).toBeInTheDocument();
      expect(screen.getByTestId('delete-session-session-2')).toBeInTheDocument();
    });

    it('should show delete button with trash icon', () => {
      render(<SessionList />);
      
      const deleteBtn = screen.getByTestId('delete-session-session-1');
      expect(deleteBtn).toHaveTextContent('🗑');
    });

    it('should trigger confirmation menu when deleting session with open tab', async () => {
      render(<SessionList />);
      
      fireEvent.click(screen.getByTestId('delete-session-session-1'));
      
      await waitFor(() => {
        expect(screen.getByText(/Delete session "Build Project" and close its tab\?/)).toBeInTheDocument();
      });
    });

    it('should trigger native confirm when deleting session without open tab', () => {
      const windowConfirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(<SessionList />);
      
      fireEvent.click(screen.getByTestId('delete-session-session-2'));
      
      expect(windowConfirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this session?');
    });

    it('should delete session on confirm', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(<SessionList />);
      
      fireEvent.click(screen.getByTestId('delete-session-session-2'));
      
      expect(mockDeleteSession).toHaveBeenCalledWith('session-2');
    });

    it('should close related tabs before deleting session', async () => {
      render(<SessionList />);
      
      fireEvent.click(screen.getByTestId('delete-session-session-1'));
      
      await waitFor(() => {
        expect(screen.getByText(/Delete session "Build Project" and close its tab\?/)).toBeInTheDocument();
      });
      
      const confirmBtn = screen.getByRole('button', { name: /confirm|yes|delete/i });
      if (confirmBtn) {
        fireEvent.click(confirmBtn);
      }
    });

    it('should not delete session when user cancels', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      
      render(<SessionList />);
      
      fireEvent.click(screen.getByTestId('delete-session-session-2'));
      
      expect(mockDeleteSession).not.toHaveBeenCalled();
    });

    it('should stop propagation when clicking delete button', () => {
      render(<SessionList />);
      
      const deleteBtn = screen.getByTestId('delete-session-session-1');
      const mockClick = vi.fn();
      const sessionItem = screen.getByTestId('session-item-session-1');
      sessionItem.addEventListener('click', mockClick);
      
      fireEvent.click(deleteBtn);
      
      expect(mockClick).not.toHaveBeenCalled();
    });
  });

  describe('Session Display', () => {
    it('should display session name correctly', () => {
      render(<SessionList />);
      
      expect(screen.getByText('Build Project')).toBeInTheDocument();
      expect(screen.getByText('Deploy')).toBeInTheDocument();
    });

    it('should render activity time for each session', () => {
      render(<SessionList />);
      
      const session1 = screen.getByTestId('session-item-session-1');
      expect(session1.querySelector('.session-item-activity')).toBeInTheDocument();
      
      const session2 = screen.getByTestId('session-item-session-2');
      expect(session2.querySelector('.session-item-activity')).toBeInTheDocument();
    });

    it('should handle sessions with no activity', () => {
      useTerminalStore.setState({
        sessions: [
          {
            ...mockSession1,
            lastActivityTime: 0,
          },
        ],
        visibleSessionIds: ['session-1'],
        activeSessionId: 'session-1',
      });
      
      render(<SessionList />);
      
      expect(screen.getByTestId('session-item-session-1')).toBeInTheDocument();
    });
  });

  describe('AI Tool Status Badge', () => {
    it('should not show AI status when aiToolState is null', () => {
      render(<SessionList />);
      
      const session1 = screen.getByTestId('session-item-session-1');
      expect(session1.querySelector('.ai-tool-status')).not.toBeInTheDocument();
    });

    it('should show AI status badge when aiToolState is present', () => {
      useTerminalStore.setState({
        sessions: [
          {
            ...mockSession1,
            aiToolState: {
              status: 'thinking',
              tool: 'opencode',
              detectedAt: Date.now(),
              lastCheckTime: Date.now(),
            },
          },
          mockSession2,
        ],
      });
      
      render(<SessionList />);
      
      const session1 = screen.getByTestId('session-item-session-1');
      const badge = session1.querySelector('.ai-tool-status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('🤔');
    });

    it('should add has-waiting-status class when AI status is waiting', () => {
      useTerminalStore.setState({
        sessions: [
          {
            ...mockSession1,
            aiToolState: {
              status: 'waiting',
              tool: 'opencode',
              prompt: 'Select an option',
              detectedAt: Date.now(),
              lastCheckTime: Date.now(),
            },
          },
          mockSession2,
        ],
      });
      
      render(<SessionList />);
      
      const session1 = screen.getByTestId('session-item-session-1');
      expect(session1).toHaveClass('has-waiting-status');
    });
  });

  describe('Notification Badge', () => {
    it('should show notification badge for sessions with notifications', () => {
      useNotifyStore.setState({
        groups: {
          'session-1': {
            sessionId: 'session-1',
            sessionName: 'Build Project',
            notifications: [],
            unreadCount: 2,
            latestTimestamp: Date.now(),
          },
        },
      });
      
      render(<SessionList />);
      
      const session1 = screen.getByTestId('session-item-session-1');
      const badge = session1.querySelector('.notification-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('2');
    });

    it('should not show notification badge when no notifications', () => {
      render(<SessionList />);
      
      const session1 = screen.getByTestId('session-item-session-1');
      const badge = session1.querySelector('.notification-badge');
      expect(badge).not.toBeInTheDocument();
    });

    it('should update badge count when notifications change', () => {
      const { rerender } = render(<SessionList />);
      
      useNotifyStore.setState({
        groups: {
          'session-1': {
            sessionId: 'session-1',
            sessionName: 'Build Project',
            notifications: [],
            unreadCount: 3,
            latestTimestamp: Date.now(),
          },
        },
      });
      
      rerender(<SessionList />);
      
      const session1 = screen.getByTestId('session-item-session-1');
      const badge = session1.querySelector('.notification-badge');
      expect(badge).toHaveTextContent('3');
    });
  });

  describe('Empty State', () => {
    it('should show appropriate message when no sessions exist', () => {
      useTerminalStore.setState({
        sessions: [],
        visibleSessionIds: [],
        activeSessionId: null,
      });
      
      render(<SessionList />);
      
      expect(screen.getByText('No sessions')).toBeInTheDocument();
      expect(screen.getByText('Click + to create')).toBeInTheDocument();
    });

    it('should still show header and create button in empty state', () => {
      useTerminalStore.setState({
        sessions: [],
        visibleSessionIds: [],
        activeSessionId: null,
      });
      
      render(<SessionList />);
      
      expect(screen.getByText('SESSIONS')).toBeInTheDocument();
      expect(screen.getByTestId('create-session-btn')).toBeInTheDocument();
    });
  });

  describe('Multiple Sessions', () => {
    it('should render multiple sessions in correct order', () => {
      const session3 = {
        id: 'session-3',
        name: 'Test Suite',
        terminalIds: ['term-3'],
        createdAt: Date.now(),
        isVisible: true,
        lastActivityTime: Date.now(),
        aiToolState: null,
        isNameSetByUser: true,
      };
      
      useTerminalStore.setState({
        sessions: [mockSession1, mockSession2, session3],
      });
      
      render(<SessionList />);
      
      const items = screen.getAllByTestId(/^session-item-/);
      expect(items).toHaveLength(3);
    });

    it('should handle concurrent rename operations', async () => {
      useTerminalStore.setState({
        sessions: [mockSession1, mockSession2],
      });
      
      render(<SessionList />);
      
      fireEvent.doubleClick(screen.getByTestId('session-item-session-1'));
      
      await waitFor(() => {
        const input = screen.getByTestId('rename-input-session-1') as HTMLInputElement;
        expect(input).toBeInTheDocument();
      });
      
      const session2Item = screen.getByTestId('session-item-session-2');
      fireEvent.click(session2Item);
      
      expect(mockShowSession).toHaveBeenCalledWith('session-2');
    });
  });
});
