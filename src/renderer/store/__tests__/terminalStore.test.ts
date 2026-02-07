import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useTerminalStore } from '../terminalStore';
import { useXTermStore } from '../xtermStore';
import { useNotifyStore } from '../notifyStore';

// Create mock functions that persist across tests
const mockCreateInstance = vi.fn();
const mockDestroyInstance = vi.fn();
const mockClearSessionDelayed = vi.fn();

// Mock nanoid with counter for unique IDs
let nanoidCounter = 0;
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => `mock-id-${++nanoidCounter}`),
}));

// Mock XTermStore
vi.mock('../xtermStore', () => ({
  useXTermStore: {
    getState: vi.fn(() => ({
      createInstance: mockCreateInstance,
      destroyInstance: mockDestroyInstance,
    })),
  },
}));

// Mock NotifyStore
vi.mock('../notifyStore', () => ({
  useNotifyStore: {
    getState: vi.fn(() => ({
      clearSessionDelayed: mockClearSessionDelayed,
    })),
  },
}));

describe('TerminalStore', () => {
  let terminalIdCounter = 0;

  beforeEach(() => {
    // Reset nanoid counter
    nanoidCounter = 0;
    terminalIdCounter = 0;

    // Reset store state
    useTerminalStore.setState({
      sessions: [],
      tabs: [],
      activeTabId: null,
      visibleSessionIds: [],
      activeSessionId: null,
    });

    // Reset mocks
    mockCreateInstance.mockClear();
    mockDestroyInstance.mockClear();
    mockClearSessionDelayed.mockClear();
    
    // Mock window.terminal API with dynamic terminal IDs
    window.terminal = {
      create: vi.fn().mockImplementation(async () => ({ 
        id: `terminal-${++terminalIdCounter}` 
      })),
      dispose: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
    } as any;

    // Mock window.sessionLog API
    window.sessionLog = {
      delete: vi.fn(),
      updateName: vi.fn(),
    } as any;
  });

  afterEach(() => {
    // Don't restore mocks, just clear them
  });

  describe('createSession', () => {
    it('should create a new session with default name', async () => {
      const { createSession } = useTerminalStore.getState();

      await createSession();

       const state = useTerminalStore.getState();
       expect(state.sessions).toHaveLength(1);
       expect(state.sessions[0].name).toBe('Session 1');
       expect(state.sessions[0].terminalIds[0]).toBe('terminal-1');
      expect(state.sessions[0].isVisible).toBe(true);
      expect(state.sessions[0].isNameSetByUser).toBe(false);
    });

    it('should create a session with custom name', async () => {
      const { createSession } = useTerminalStore.getState();

      await createSession('My Custom Session');

      const state = useTerminalStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].name).toBe('My Custom Session');
    });

    it('should call window.terminal.create with correct params', async () => {
      const { createSession } = useTerminalStore.getState();

      await createSession('Test Session');

      expect(window.terminal.create).toHaveBeenCalledWith({
        sessionName: 'Test Session',
        sessionId: expect.any(String),
      });
    });

    it('should create xterm instance for the session', async () => {
      const { createSession } = useTerminalStore.getState();

      await createSession();

      const state = useTerminalStore.getState();
      const sessionId = state.sessions[0].id;
      
       expect(mockCreateInstance).toHaveBeenCalledWith(
         'terminal-1',
         sessionId
       );
    });

    it('should set new session as active', async () => {
      const { createSession } = useTerminalStore.getState();

      await createSession();

      const state = useTerminalStore.getState();
      expect(state.activeSessionId).toBe(state.sessions[0].id);
    });

    it('should add session to visibleSessionIds', async () => {
      const { createSession } = useTerminalStore.getState();

      await createSession();

      const state = useTerminalStore.getState();
      expect(state.visibleSessionIds).toContain(state.sessions[0].id);
    });

    it('should create a terminal tab', async () => {
      const { createSession } = useTerminalStore.getState();

      await createSession('Test Session');

      const state = useTerminalStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].type).toBe('terminal');
      expect(state.tabs[0].sessionId).toBe(state.sessions[0].id);
      expect(state.tabs[0].title).toBe('Test Session');
    });

    it('should show terminal window', async () => {
      const { createSession } = useTerminalStore.getState();

      await createSession();

      expect(window.terminal.show).toHaveBeenCalledWith({ id: 'terminal-1' });
    });

    it('should handle creation error gracefully', async () => {
      window.terminal.create = vi.fn().mockRejectedValue(new Error('Creation failed'));
      
      const { createSession } = useTerminalStore.getState();

      await createSession();

      // Should not throw and state should remain empty
      const state = useTerminalStore.getState();
      expect(state.sessions).toHaveLength(0);
    });
  });

  describe('deleteSession', () => {
    it('should remove session from store', async () => {
      const { createSession, deleteSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      deleteSession(sessionId);

      const state = useTerminalStore.getState();
      expect(state.sessions).toHaveLength(0);
    });

    it('should destroy xterm instance', async () => {
      const { createSession, deleteSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

       deleteSession(sessionId);

       expect(mockDestroyInstance).toHaveBeenCalledWith('terminal-1');
    });

    it('should dispose terminal PTY', async () => {
      const { createSession, deleteSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const session = useTerminalStore.getState().sessions[0];

      deleteSession(session.id);

       expect(window.terminal.dispose).toHaveBeenCalledWith({ id: session.terminalIds[0] });
    });

    it('should delete session log file', async () => {
      const { createSession, deleteSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      deleteSession(sessionId);

      expect(window.sessionLog.delete).toHaveBeenCalledWith({ sessionId });
    });

    it('should remove session from visibleSessionIds', async () => {
      const { createSession, deleteSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      deleteSession(sessionId);

      const state = useTerminalStore.getState();
      expect(state.visibleSessionIds).not.toContain(sessionId);
    });

    it('should switch active session when deleting active session', async () => {
      const { createSession, deleteSession } = useTerminalStore.getState();
      
      // Create two sessions
      await createSession('Session 1');
      const session1Id = useTerminalStore.getState().sessions[0].id;
      
      await createSession('Session 2');
      const session2Id = useTerminalStore.getState().sessions[1].id;

      // Verify both are in visibleSessionIds
      expect(useTerminalStore.getState().visibleSessionIds).toEqual([session1Id, session2Id]);
      expect(useTerminalStore.getState().activeSessionId).toBe(session2Id);

      // Delete the active session (session 2)
      deleteSession(session2Id);

      const state = useTerminalStore.getState();
      expect(state.activeSessionId).toBe(session1Id);
    });

    it('should set activeSessionId to null when deleting last session', async () => {
      const { createSession, deleteSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      deleteSession(sessionId);

      const state = useTerminalStore.getState();
      expect(state.activeSessionId).toBeNull();
    });

    it('should not throw when deleting non-existent session', () => {
      const { deleteSession } = useTerminalStore.getState();

      expect(() => deleteSession('non-existent-id')).not.toThrow();
    });
  });

  describe('showSession', () => {
    it('should add session to visibleSessionIds if not already visible', async () => {
      const { createSession, hideSession, showSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;
      
      // Hide first, then show
      hideSession(sessionId);
      showSession(sessionId);

      const state = useTerminalStore.getState();
      expect(state.visibleSessionIds).toContain(sessionId);
    });

    it('should set session as active', async () => {
      const { createSession, showSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      showSession(sessionId);

      const state = useTerminalStore.getState();
      expect(state.activeSessionId).toBe(sessionId);
    });

    it('should update session isVisible property', async () => {
      const { createSession, hideSession, showSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;
      
      hideSession(sessionId);
      showSession(sessionId);

      const state = useTerminalStore.getState();
      const session = state.sessions.find(s => s.id === sessionId);
      expect(session?.isVisible).toBe(true);
    });

    it('should call window.terminal.show when not already visible', async () => {
      const { createSession, hideSession, showSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const session = useTerminalStore.getState().sessions[0];
      
      vi.clearAllMocks(); // Clear previous calls
      
      hideSession(session.id);
      showSession(session.id);

       expect(window.terminal.show).toHaveBeenCalledWith({ id: session.terminalIds[0] });
    });

    it('should create tab if it does not exist', async () => {
      const { createSession, hideSession, showSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;
      
      // Hide and clear tabs manually
      hideSession(sessionId);
      useTerminalStore.setState({ tabs: [] });
      
      showSession(sessionId);

      const state = useTerminalStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].sessionId).toBe(sessionId);
    });

    it('should not throw when showing non-existent session', () => {
      const { showSession } = useTerminalStore.getState();

      expect(() => showSession('non-existent-id')).not.toThrow();
    });
  });

  describe('hideSession', () => {
    it('should remove session from visibleSessionIds', async () => {
      const { createSession, hideSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      hideSession(sessionId);

      const state = useTerminalStore.getState();
      expect(state.visibleSessionIds).not.toContain(sessionId);
    });

    it('should set session isVisible to false', async () => {
      const { createSession, hideSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      hideSession(sessionId);

      const state = useTerminalStore.getState();
      const session = state.sessions.find(s => s.id === sessionId);
      expect(session?.isVisible).toBe(false);
    });

    it('should call window.terminal.hide', async () => {
      const { createSession, hideSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const session = useTerminalStore.getState().sessions[0];

       vi.clearAllMocks(); // Clear previous calls
       
       hideSession(session.id);

       expect(window.terminal.hide).toHaveBeenCalledWith({ id: session.terminalIds[0] });
    });

    it('should not throw when hiding non-existent session', () => {
      const { hideSession } = useTerminalStore.getState();

      expect(() => hideSession('non-existent-id')).not.toThrow();
    });
  });

  describe('toggleSessionVisibility', () => {
    it('should hide visible session', async () => {
      const { createSession, toggleSessionVisibility } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      toggleSessionVisibility(sessionId);

      const state = useTerminalStore.getState();
      expect(state.visibleSessionIds).not.toContain(sessionId);
    });

    it('should show hidden session', async () => {
      const { createSession, hideSession, toggleSessionVisibility } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;
      
      hideSession(sessionId);
      toggleSessionVisibility(sessionId);

      const state = useTerminalStore.getState();
      expect(state.visibleSessionIds).toContain(sessionId);
    });
  });

  describe('setActiveSession', () => {
    it('should set active session when visible', async () => {
      const { createSession, setActiveSession } = useTerminalStore.getState();
      
      await createSession('Session 1');
      await createSession('Session 2');
      const session1Id = useTerminalStore.getState().sessions[0].id;

      setActiveSession(session1Id);

      const state = useTerminalStore.getState();
      expect(state.activeSessionId).toBe(session1Id);
    });

    it('should not set active session when not visible', async () => {
      const { createSession, hideSession, setActiveSession } = useTerminalStore.getState();
      
      await createSession('Session 1');
      await createSession('Session 2');
      const session1Id = useTerminalStore.getState().sessions[0].id;
      const session2Id = useTerminalStore.getState().sessions[1].id;

      hideSession(session1Id);
      setActiveSession(session1Id);

      const state = useTerminalStore.getState();
      expect(state.activeSessionId).toBe(session2Id); // Should remain session 2
    });

    it('should set activeSessionId to null when passed null', async () => {
      const { createSession, setActiveSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      setActiveSession(null);

      const state = useTerminalStore.getState();
      expect(state.activeSessionId).toBeNull();
    });

    it('should clear session notifications after delay', async () => {
      const { createSession, setActiveSession } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      setActiveSession(sessionId);

      expect(mockClearSessionDelayed).toHaveBeenCalledWith(sessionId, 3000);
    });
  });

  describe('closeTab', () => {
    it('should hide session terminal', async () => {
      const { createSession, closeTab } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const session = useTerminalStore.getState().sessions[0];

       vi.clearAllMocks();
       
       closeTab(session.id);

       expect(window.terminal.hide).toHaveBeenCalledWith({ id: session.terminalIds[0] });
    });

    it('should remove session from visibleSessionIds', async () => {
      const { createSession, closeTab } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      closeTab(sessionId);

      const state = useTerminalStore.getState();
      expect(state.visibleSessionIds).not.toContain(sessionId);
    });

    it('should switch to previous session when closing active', async () => {
      const { createSession, closeTab } = useTerminalStore.getState();
      
      await createSession('Session 1');
      const session1Id = useTerminalStore.getState().sessions[0].id;
      
      await createSession('Session 2');
      const session2Id = useTerminalStore.getState().sessions[1].id;

      // Verify both are visible and session2 is active
      expect(useTerminalStore.getState().visibleSessionIds).toEqual([session1Id, session2Id]);
      expect(useTerminalStore.getState().activeSessionId).toBe(session2Id);

      // Session 2 is active, close it
      closeTab(session2Id);

      const state = useTerminalStore.getState();
      expect(state.activeSessionId).toBe(session1Id);
    });

    it('should switch to next session when closing first active', async () => {
      const { createSession, closeTab, setActiveSession } = useTerminalStore.getState();
      
      await createSession('Session 1');
      const session1Id = useTerminalStore.getState().sessions[0].id;
      
      await createSession('Session 2');
      const session2Id = useTerminalStore.getState().sessions[1].id;

      // Verify both are visible
      expect(useTerminalStore.getState().visibleSessionIds).toEqual([session1Id, session2Id]);

      // Set session 1 as active, then close it
      setActiveSession(session1Id);
      closeTab(session1Id);

      const state = useTerminalStore.getState();
      expect(state.activeSessionId).toBe(session2Id);
    });

    it('should set activeSessionId to null when closing last tab', async () => {
      const { createSession, closeTab } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      closeTab(sessionId);

      const state = useTerminalStore.getState();
      expect(state.activeSessionId).toBeNull();
    });

    it('should not throw when closing non-existent session', () => {
      const { closeTab } = useTerminalStore.getState();

      expect(() => closeTab('non-existent-id')).not.toThrow();
    });
  });

  describe('renameSession', () => {
    it('should update session name', async () => {
      const { createSession, renameSession } = useTerminalStore.getState();
      
      await createSession('Old Name');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      renameSession(sessionId, 'New Name');

      const state = useTerminalStore.getState();
      expect(state.sessions[0].name).toBe('New Name');
    });

    it('should update corresponding terminal tab title', async () => {
      const { createSession, renameSession } = useTerminalStore.getState();
      
      await createSession('Old Name');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      renameSession(sessionId, 'New Name');

      const state = useTerminalStore.getState();
      const terminalTab = state.tabs.find(t => t.sessionId === sessionId);
      expect(terminalTab?.title).toBe('New Name');
    });

    it('should call window.sessionLog.updateName', async () => {
      const { createSession, renameSession } = useTerminalStore.getState();
      
      await createSession('Old Name');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      renameSession(sessionId, 'New Name');

      expect(window.sessionLog.updateName).toHaveBeenCalledWith({
        sessionId,
        sessionName: 'New Name',
      });
    });
  });

  describe('setSessionNameFromFirstInput', () => {
    it('should set session name from first input', async () => {
      const { createSession, setSessionNameFromFirstInput } = useTerminalStore.getState();
      
      await createSession('Session 1');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      setSessionNameFromFirstInput(sessionId, 'git status');

      const state = useTerminalStore.getState();
      expect(state.sessions[0].name).toBe('git status');
    });

    it('should trim whitespace from input', async () => {
      const { createSession, setSessionNameFromFirstInput } = useTerminalStore.getState();
      
      await createSession('Session 1');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      setSessionNameFromFirstInput(sessionId, '  npm install  ');

      const state = useTerminalStore.getState();
      expect(state.sessions[0].name).toBe('npm install');
    });

    it('should truncate input to 25 characters', async () => {
      const { createSession, setSessionNameFromFirstInput } = useTerminalStore.getState();
      
      await createSession('Session 1');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      const longInput = 'a'.repeat(50);
      setSessionNameFromFirstInput(sessionId, longInput);

      const state = useTerminalStore.getState();
      expect(state.sessions[0].name).toHaveLength(25);
    });

    it('should set isNameSetByUser to true', async () => {
      const { createSession, setSessionNameFromFirstInput } = useTerminalStore.getState();
      
      await createSession('Session 1');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      setSessionNameFromFirstInput(sessionId, 'git status');

      const state = useTerminalStore.getState();
      expect(state.sessions[0].isNameSetByUser).toBe(true);
    });

    it('should not update name if already set by user', async () => {
      const { createSession, setSessionNameFromFirstInput } = useTerminalStore.getState();
      
      await createSession('Session 1');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      setSessionNameFromFirstInput(sessionId, 'first command');
      setSessionNameFromFirstInput(sessionId, 'second command');

      const state = useTerminalStore.getState();
      expect(state.sessions[0].name).toBe('first command'); // Should not change
    });

    it('should not update name for empty input', async () => {
      const { createSession, setSessionNameFromFirstInput } = useTerminalStore.getState();
      
      await createSession('Session 1');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      setSessionNameFromFirstInput(sessionId, '   ');

      const state = useTerminalStore.getState();
      expect(state.sessions[0].name).toBe('Session 1'); // Should not change
      expect(state.sessions[0].isNameSetByUser).toBe(false);
    });

    it('should not throw for non-existent session', () => {
      const { setSessionNameFromFirstInput } = useTerminalStore.getState();

      expect(() => 
        setSessionNameFromFirstInput('non-existent-id', 'test')
      ).not.toThrow();
    });
  });

  describe('reorderTabs', () => {
    it('should reorder visibleSessionIds', async () => {
      const { createSession, reorderTabs } = useTerminalStore.getState();
      
      await createSession('Session 1');
      await createSession('Session 2');
      await createSession('Session 3');
      
      const sessionIds = useTerminalStore.getState().visibleSessionIds;
      const [id1, id2, id3] = sessionIds;

      // Move first to last
      reorderTabs(0, 2);

      const state = useTerminalStore.getState();
      expect(state.visibleSessionIds).toEqual([id2, id3, id1]);
    });
  });

  describe('updateLastActivityTime', () => {
    it('should update session lastActivityTime', async () => {
      const { createSession, updateLastActivityTime } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;
      const originalTime = useTerminalStore.getState().sessions[0].lastActivityTime;

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      updateLastActivityTime(sessionId);

      const state = useTerminalStore.getState();
      expect(state.sessions[0].lastActivityTime).toBeGreaterThan(originalTime);
    });
  });

  describe('AI Tool State', () => {
    it('should set AI tool state', async () => {
      const { createSession, setAIToolState } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      const aiState = {
        status: 'thinking' as const,
        tool: 'opencode',
        detectedAt: Date.now(),
        lastCheckTime: Date.now(),
      };

      setAIToolState(sessionId, aiState);

      const state = useTerminalStore.getState();
      expect(state.sessions[0].aiToolState).toEqual(aiState);
    });

    it('should get AI tool state', async () => {
      const { createSession, setAIToolState, getAIToolState } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      const aiState = {
        status: 'executing' as const,
        tool: 'gh-copilot',
        detectedAt: Date.now(),
        lastCheckTime: Date.now(),
      };

      setAIToolState(sessionId, aiState);
      const retrievedState = getAIToolState(sessionId);

      expect(retrievedState).toEqual(aiState);
    });

    it('should return null for non-existent session AI state', () => {
      const { getAIToolState } = useTerminalStore.getState();

      const state = getAIToolState('non-existent-id');
      expect(state).toBeNull();
    });

    it('should allow clearing AI tool state', async () => {
      const { createSession, setAIToolState, getAIToolState } = useTerminalStore.getState();
      
      await createSession('Test Session');
      const sessionId = useTerminalStore.getState().sessions[0].id;

      const aiState = {
        status: 'completed' as const,
        tool: 'aider',
        detectedAt: Date.now(),
        lastCheckTime: Date.now(),
      };

      setAIToolState(sessionId, aiState);
      setAIToolState(sessionId, null);

      const state = getAIToolState(sessionId);
      expect(state).toBeNull();
    });
  });

  describe('Unified Tab System', () => {
    describe('openTab', () => {
      it('should create terminal tab', async () => {
        const { createSession, openTab } = useTerminalStore.getState();
        
        await createSession('Test Session');
        const sessionId = useTerminalStore.getState().sessions[0].id;
        
        // Clear tabs to test openTab independently
        useTerminalStore.setState({ tabs: [], activeTabId: null });

         openTab('terminal', sessionId, undefined, 'My Terminal');

        const state = useTerminalStore.getState();
        expect(state.tabs).toHaveLength(1);
        expect(state.tabs[0].type).toBe('terminal');
        expect(state.tabs[0].sessionId).toBe(sessionId);
        expect(state.tabs[0].title).toBe('My Terminal');
      });

      it('should create settings tab', () => {
        const { openTab } = useTerminalStore.getState();

        openTab('settings');

        const state = useTerminalStore.getState();
        expect(state.tabs).toHaveLength(1);
        expect(state.tabs[0].type).toBe('settings');
        expect(state.tabs[0].title).toBe('[S]: Settings');
      });

      it('should use session name as default title', async () => {
        const { createSession, openTab } = useTerminalStore.getState();
        
        await createSession('My Session');
        const sessionId = useTerminalStore.getState().sessions[0].id;
        
        useTerminalStore.setState({ tabs: [], activeTabId: null });

        openTab('terminal', sessionId);

        const state = useTerminalStore.getState();
        expect(state.tabs[0].title).toBe('My Session');
      });

      it('should not create duplicate terminal tab', async () => {
        const { createSession, openTab } = useTerminalStore.getState();
        
        await createSession('Test Session');
        const session = useTerminalStore.getState().sessions[0];

        openTab('terminal', session.id, session.terminalIds[0]);
        openTab('terminal', session.id, session.terminalIds[0]); // Try to open again

        const state = useTerminalStore.getState();
        expect(state.tabs.filter(t => t.sessionId === session.id)).toHaveLength(1);
      });

      it('should not create duplicate settings tab', () => {
        const { openTab } = useTerminalStore.getState();

        openTab('settings');
        openTab('settings'); // Try to open again

        const state = useTerminalStore.getState();
        expect(state.tabs.filter(t => t.type === 'settings')).toHaveLength(1);
      });

      it('should activate existing tab if already open', async () => {
        const { createSession, openTab } = useTerminalStore.getState();
        
        await createSession('Test Session');
        const session = useTerminalStore.getState().sessions[0];

        openTab('terminal', session.id, session.terminalIds[0]);
        const firstTabId = useTerminalStore.getState().tabs[0].id;
        
        // Change active tab
        useTerminalStore.setState({ activeTabId: null });
        
        openTab('terminal', session.id, session.terminalIds[0]); // Try to open again

        const state = useTerminalStore.getState();
        expect(state.activeTabId).toBe(firstTabId);
      });
    });

    describe('closeTabById', () => {
      it('should remove tab from tabs array', async () => {
        const { createSession } = useTerminalStore.getState();
        
        await createSession('Test Session');
        const tabId = useTerminalStore.getState().tabs[0].id;

        useTerminalStore.getState().closeTabById(tabId);

        const state = useTerminalStore.getState();
        expect(state.tabs).toHaveLength(0);
      });

      it('should switch to previous tab when closing active', async () => {
        const { createSession, closeTabById } = useTerminalStore.getState();
        
        await createSession('Session 1');
        const state1 = useTerminalStore.getState();
        const tab1Id = state1.tabs[0]?.id;
        
        await createSession('Session 2');
        const state2 = useTerminalStore.getState();
        const tab2Id = state2.tabs[1]?.id;

        expect(tab1Id).toBeDefined();
        expect(tab2Id).toBeDefined();

        // Close second tab (active)
        closeTabById(tab2Id!);

        const state = useTerminalStore.getState();
        expect(state.activeTabId).toBe(tab1Id);
      });

      it('should hide session for terminal tab', async () => {
        const { createSession } = useTerminalStore.getState();
        
        await createSession('Test Session');
        const tabId = useTerminalStore.getState().tabs[0].id;

        vi.clearAllMocks();
        
        useTerminalStore.getState().closeTabById(tabId);

        expect(window.terminal.hide).toHaveBeenCalled();
      });
    });

    describe('setActiveTab', () => {
      it('should set active tab for terminal', async () => {
        const { createSession, setActiveTab } = useTerminalStore.getState();
        
        await createSession('Test Session');
        const tabId = useTerminalStore.getState().tabs[0].id;

        setActiveTab(tabId);

        const state = useTerminalStore.getState();
        expect(state.activeTabId).toBe(tabId);
      });

      it('should update activeSessionId for terminal tab', async () => {
        const { createSession, setActiveTab } = useTerminalStore.getState();
        
        await createSession('Session 1');
        await createSession('Session 2');
        
        const session1Id = useTerminalStore.getState().sessions[0].id;
        const tab1Id = useTerminalStore.getState().tabs[0].id;

        setActiveTab(tab1Id);

        const state = useTerminalStore.getState();
        expect(state.activeSessionId).toBe(session1Id);
      });

      it('should show terminal window', async () => {
        const { createSession, setActiveTab } = useTerminalStore.getState();
        
        await createSession('Test Session');
        const tabId = useTerminalStore.getState().tabs[0].id;

        vi.clearAllMocks();
        
        setActiveTab(tabId);

        expect(window.terminal.show).toHaveBeenCalled();
      });

      it('should clear notifications after delay', async () => {
        const { createSession, setActiveTab } = useTerminalStore.getState();
        
        await createSession('Test Session');
        const state = useTerminalStore.getState();
        const tabId = state.tabs[0].id;
        const sessionId = state.sessions[0].id;

        mockClearSessionDelayed.mockClear(); // Clear previous calls

        setActiveTab(tabId);

        expect(mockClearSessionDelayed).toHaveBeenCalledWith(sessionId, 3000);
      });

      it('should not update activeSessionId for non-terminal tab', () => {
        const { openTab, setActiveTab } = useTerminalStore.getState();
        
        openTab('settings');
        const tabId = useTerminalStore.getState().tabs[0].id;

        setActiveTab(tabId);

        const state = useTerminalStore.getState();
        expect(state.activeTabId).toBe(tabId);
        expect(state.activeSessionId).toBeNull();
      });
    });

    describe('reorderTabsNew', () => {
      it('should reorder tabs array', async () => {
        const { createSession, reorderTabsNew } = useTerminalStore.getState();
        
        await createSession('Session 1');
        const state1 = useTerminalStore.getState();
        const tab1 = state1.tabs[0];
        
        await createSession('Session 2');
        const state2 = useTerminalStore.getState();
        const tab2 = state2.tabs[1];
        
        await createSession('Session 3');
        const state3 = useTerminalStore.getState();
        const tab3 = state3.tabs[2];

        expect(tab1).toBeDefined();
        expect(tab2).toBeDefined();
        expect(tab3).toBeDefined();

        // Move first to last
        reorderTabsNew(0, 2);

        const state = useTerminalStore.getState();
        expect(state.tabs.map(t => t.id)).toEqual([tab2.id, tab3.id, tab1.id]);
      });
    });

    describe('hasOpenTab', () => {
      it('should return true if session has open tab', async () => {
        const { createSession, hasOpenTab } = useTerminalStore.getState();
        
        await createSession('Test Session');
        const sessionId = useTerminalStore.getState().sessions[0].id;

        const result = hasOpenTab(sessionId);
        expect(result).toBe(true);
      });

      it('should return false if session has no open tab', async () => {
        const { createSession, hasOpenTab, closeTabById } = useTerminalStore.getState();
        
        await createSession('Test Session');
        const sessionId = useTerminalStore.getState().sessions[0].id;
        const tabId = useTerminalStore.getState().tabs[0].id;
        
        closeTabById(tabId);

        const result = hasOpenTab(sessionId);
        expect(result).toBe(false);
      });
    });
  });

  describe('openFlowTab', () => {
    it('should create a new flow tab', () => {
      const { openFlowTab } = useTerminalStore.getState();

      openFlowTab('flow-1', 'Build Project');

      const state = useTerminalStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].type).toBe('flow');
      expect(state.tabs[0].flowId).toBe('flow-1');
      expect(state.tabs[0].title).toBe('⚡ Build Project');
    });

    it('should set new flow tab as active', () => {
      const { openFlowTab } = useTerminalStore.getState();

      openFlowTab('flow-1', 'Build Project');

      const state = useTerminalStore.getState();
      expect(state.activeTabId).toBe(state.tabs[0].id);
    });

    it('should not create duplicate flow tab', () => {
      const { openFlowTab } = useTerminalStore.getState();

      openFlowTab('flow-1', 'Build Project');
      openFlowTab('flow-1', 'Build Project'); // Try to open again

      const state = useTerminalStore.getState();
      expect(state.tabs.filter(t => t.flowId === 'flow-1')).toHaveLength(1);
    });

    it('should activate existing flow tab if already open', () => {
      const { openFlowTab, openTab } = useTerminalStore.getState();

      openFlowTab('flow-1', 'Build Project');
      const flowTabId = useTerminalStore.getState().tabs[0].id;

      // Open a different tab
      openTab('settings');
      expect(useTerminalStore.getState().activeTabId).not.toBe(flowTabId);

      // Try to open the same flow again
      openFlowTab('flow-1', 'Build Project');

      const state = useTerminalStore.getState();
      expect(state.activeTabId).toBe(flowTabId);
    });

    it('should create multiple flow tabs for different flows', () => {
      const { openFlowTab } = useTerminalStore.getState();

      openFlowTab('flow-1', 'Build');
      openFlowTab('flow-2', 'Deploy');

      const state = useTerminalStore.getState();
      expect(state.tabs).toHaveLength(2);
      expect(state.tabs[0].flowId).toBe('flow-1');
      expect(state.tabs[1].flowId).toBe('flow-2');
    });
  });

  describe('Multiple Sessions', () => {
    it('should manage multiple sessions independently', async () => {
      const { createSession } = useTerminalStore.getState();

      await createSession('Session 1');
      await createSession('Session 2');
      await createSession('Session 3');

      const state = useTerminalStore.getState();
      expect(state.sessions).toHaveLength(3);
      expect(state.sessions.map(s => s.name)).toEqual(['Session 1', 'Session 2', 'Session 3']);
    });

    it('should track visible sessions correctly', async () => {
      const { createSession, hideSession } = useTerminalStore.getState();

      await createSession('Session 1');
      const session1Id = useTerminalStore.getState().sessions[0].id;
      
      await createSession('Session 2');
      const session2Id = useTerminalStore.getState().sessions[1].id;
      
      await createSession('Session 3');
      const session3Id = useTerminalStore.getState().sessions[2].id;

      // Verify all are visible
      expect(useTerminalStore.getState().visibleSessionIds).toEqual([
        session1Id,
        session2Id,
        session3Id
      ]);

      hideSession(session2Id);

      const state = useTerminalStore.getState();
      expect(state.visibleSessionIds).toHaveLength(2);
      expect(state.visibleSessionIds).toContain(session1Id);
      expect(state.visibleSessionIds).toContain(session3Id);
      expect(state.visibleSessionIds).not.toContain(session2Id);
    });
  });
});
