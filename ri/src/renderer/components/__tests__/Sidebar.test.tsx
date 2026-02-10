import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../Sidebar';
import { useNotifyStore } from '../../store/notifyStore';
import { useTerminalStore } from '../../store/terminalStore';

const mockOnViewChange = vi.fn();
const mockOnToggleCollapse = vi.fn();
const mockOpenTab = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  
  useNotifyStore.setState({
    totalUnread: 0,
  });
  
  useTerminalStore.setState({
    openTab: mockOpenTab,
  });
  
  vi.spyOn(useTerminalStore.getState(), 'openTab').mockImplementation(mockOpenTab);
});

describe('Sidebar', () => {
  describe('Rendering', () => {
    it('should render sidebar container', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveClass('sidebar-tabs');
    });

    it('should render all view icons (sessions, flow, remote, notify, settings)', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      expect(screen.getByTestId('view-sessions')).toBeInTheDocument();
      expect(screen.getByTestId('view-flow')).toBeInTheDocument();
      expect(screen.getByTestId('view-remote')).toBeInTheDocument();
      expect(screen.getByTestId('view-notify')).toBeInTheDocument();
      expect(screen.getByTestId('view-settings')).toBeInTheDocument();
    });

    it('should render correct icons for each view', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('🛤️')).toBeInTheDocument();
      expect(screen.getByText('📡')).toBeInTheDocument();
      expect(screen.getByText('🔔')).toBeInTheDocument();
      expect(screen.getByText('⚙')).toBeInTheDocument();
    });

    it('should render correct labels for each view', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      expect(screen.getByText('Sessions')).toBeInTheDocument();
      expect(screen.getByText('Flow')).toBeInTheDocument();
      expect(screen.getByText('Remote')).toBeInTheDocument();
      expect(screen.getByText('Notify')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  describe('Active View Indicator', () => {
    it('should show active class on current view', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      const sessionsBtn = screen.getByTestId('view-sessions');
      expect(sessionsBtn).toHaveClass('active');
    });

    it('should not show active class on inactive views', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      const flowBtn = screen.getByTestId('view-flow');
      const notifyBtn = screen.getByTestId('view-notify');
      
      expect(flowBtn).not.toHaveClass('active');
      expect(notifyBtn).not.toHaveClass('active');
    });

    it('should change active indicator when different view is active', () => {
      const { rerender } = render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      expect(screen.getByTestId('view-sessions')).toHaveClass('active');
      expect(screen.getByTestId('view-flow')).not.toHaveClass('active');
      
      rerender(
        <Sidebar
          activeView="flow"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      expect(screen.getByTestId('view-sessions')).not.toHaveClass('active');
      expect(screen.getByTestId('view-flow')).toHaveClass('active');
    });
  });

  describe('View Change Handling', () => {
    it('should call onViewChange when clicking a different view', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      fireEvent.click(screen.getByTestId('view-flow'));
      
      expect(mockOnViewChange).toHaveBeenCalledWith('flow');
    });

    it('should call onViewChange when clicking settings view', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      fireEvent.click(screen.getByTestId('view-settings'));
      
      expect(mockOnViewChange).toHaveBeenCalledWith('settings');
    });

    it('should open settings tab when clicking settings view', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      fireEvent.click(screen.getByTestId('view-settings'));
      
      expect(mockOpenTab).toHaveBeenCalledWith('settings', undefined, '[S]: Settings');
    });

    it('should toggle collapse when clicking active view with nav panel', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      fireEvent.click(screen.getByTestId('view-sessions'));
      
      expect(mockOnToggleCollapse).toHaveBeenCalledWith(true);
    });

    it('should not toggle collapse when clicking active view without nav panel (settings)', () => {
      render(
        <Sidebar
          activeView="settings"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      mockOnToggleCollapse.mockClear();
      fireEvent.click(screen.getByTestId('view-settings'));
      
      expect(mockOnToggleCollapse).not.toHaveBeenCalled();
      expect(mockOnViewChange).toHaveBeenCalledWith('settings');
    });

    it('should expand sidebar when switching to view with nav if collapsed', () => {
      render(
        <Sidebar
          activeView="settings"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={true}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      fireEvent.click(screen.getByTestId('view-sessions'));
      
      expect(mockOnToggleCollapse).toHaveBeenCalledWith(false);
      expect(mockOnViewChange).toHaveBeenCalledWith('sessions');
    });
  });

  describe('Notification Badge', () => {
    it('should not show notification badge when no unread notifications', () => {
      useNotifyStore.setState({ totalUnread: 0 });
      
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      const badges = screen.queryAllByText(/^\d+$/);
      expect(badges.length).toBe(0);
    });

    it('should show notification badge when there are unread notifications', () => {
      useNotifyStore.setState({ totalUnread: 3 });
      
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      const notifyBtn = screen.getByTestId('view-notify');
      expect(notifyBtn).toHaveTextContent('3');
    });

    it('should update badge when unread count changes', () => {
      const { rerender } = render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      useNotifyStore.setState({ totalUnread: 5 });
      
      rerender(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      const notifyBtn = screen.getByTestId('view-notify');
      expect(notifyBtn).toHaveTextContent('5');
    });

    it('should only show badge on notify view', () => {
      useNotifyStore.setState({ totalUnread: 2 });
      
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      const notifyBtn = screen.getByTestId('view-notify');
      expect(notifyBtn).toHaveTextContent('2');
      
      const sessionsBtn = screen.getByTestId('view-sessions');
      expect(sessionsBtn).not.toHaveTextContent('2');
    });
  });

  describe('Sidebar Toggle Button', () => {
    it('should render toggle button when active view has nav panel', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      const toggleBtn = screen.getByTestId('sidebar-toggle');
      expect(toggleBtn).toBeInTheDocument();
    });

    it('should not render toggle button when active view has no nav panel', () => {
      render(
        <Sidebar
          activeView="settings"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      const toggleBtn = screen.queryByTestId('sidebar-toggle');
      expect(toggleBtn).not.toBeInTheDocument();
    });

    it('should show expand icon when sidebar is collapsed', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={true}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      const toggleBtn = screen.getByTestId('sidebar-toggle');
      expect(toggleBtn).toHaveTextContent('⇥');
    });

    it('should show collapse icon when sidebar is expanded', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      const toggleBtn = screen.getByTestId('sidebar-toggle');
      expect(toggleBtn).toHaveTextContent('⇤');
    });

    it('should call onToggleCollapse when clicking toggle button', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      mockOnToggleCollapse.mockClear();
      const toggleBtn = screen.getByTestId('sidebar-toggle');
      fireEvent.click(toggleBtn);
      
      expect(mockOnToggleCollapse).toHaveBeenCalledWith(true);
    });

    it('should toggle between expanded and collapsed states', () => {
      const { rerender } = render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      let toggleBtn = screen.getByTestId('sidebar-toggle');
      expect(toggleBtn).toHaveTextContent('⇤');
      
      rerender(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={true}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      toggleBtn = screen.getByTestId('sidebar-toggle');
      expect(toggleBtn).toHaveTextContent('⇥');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-labels on all view buttons', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      expect(screen.getByLabelText('Sessions')).toBeInTheDocument();
      expect(screen.getByLabelText('Flow')).toBeInTheDocument();
      expect(screen.getByLabelText('Remote')).toBeInTheDocument();
      expect(screen.getByLabelText('Notify')).toBeInTheDocument();
      expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    });

    it('should have aria-label on toggle button', () => {
      render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      const toggleBtn = screen.getByTestId('sidebar-toggle');
      expect(toggleBtn).toHaveAttribute('aria-label');
    });

    it('should update toggle aria-label based on state', () => {
      const { rerender } = render(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={false}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      let toggleBtn = screen.getByTestId('sidebar-toggle');
      expect(toggleBtn).toHaveAttribute('aria-label', 'Collapse sidebar');
      
      rerender(
        <Sidebar
          activeView="sessions"
          onViewChange={mockOnViewChange}
          sidebarCollapsed={true}
          onToggleCollapse={mockOnToggleCollapse}
        />
      );
      
      toggleBtn = screen.getByTestId('sidebar-toggle');
      expect(toggleBtn).toHaveAttribute('aria-label', 'Expand sidebar');
    });
  });
});
