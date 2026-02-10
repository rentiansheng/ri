import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { useNotifyStore } from './notifyStore';
import { useXTermStore } from './xtermStore';

export interface AIToolState {
  status: 'thinking' | 'waiting' | 'executing' | 'idle' | 'completed';
  tool: 'opencode' | 'gh-copilot' | 'aider' | 'cursor' | 'cline' | string | null;
  prompt?: string;        // 提示内容（如 "? Select an option"）
  detectedAt: number;     // 检测时间戳
  lastCheckTime: number;  // 上次检查时间
}

export interface Session {
  id: string;
  name: string;
  terminalIds: string[];  // Support multiple terminals per session
  createdAt: number;
  isVisible: boolean;  // 是否在右侧显示
  lastActivityTime: number;  // 最后活动时间（终端最后一次有数据输出的时间戳）
  aiToolState?: AIToolState | null;  // AI 工具状态
  isNameSetByUser: boolean;  // 名称是否由用户首次输入设置
}

export type TabType = 'terminal' | 'settings' | 'file' | 'flow';

export interface Tab {
  id: string;
  type: TabType;
  sessionId?: string;
  terminalId?: string;
  filePath?: string;
  flowId?: string;
  title: string;
}

// Split pane layout for multi-terminal sessions
export interface SplitPane {
  id: string;
  terminalId?: string;  // Leaf node: terminal ID
  direction?: 'horizontal' | 'vertical';  // Branch node: split direction
  children?: SplitPane[];  // Branch node: child panes
  size?: number;  // Fraction of parent (0-1)
}

// Session layouts keyed by sessionId
export type SessionLayouts = Record<string, SplitPane>;
export type SessionActiveTerminals = Record<string, string>;

// File buffer entry for unsaved content
export interface FileBuffer {
  content: string;
  updatedAt: number;
}

interface TerminalStore {
  sessions: Session[];
  
  // Unified tab system
  tabs: Tab[];  // All tabs (terminal, settings)
  activeTabId: string | null;  // Currently active tab ID
  
  // Session split layouts (persists layout per session)
  sessionLayouts: SessionLayouts;
  sessionActiveTerminals: SessionActiveTerminals;
  
  // Legacy - keeping for compatibility
  visibleSessionIds: string[];  // Tab Bar 中显示的 Session IDs（按打开顺序）
  activeSessionId: string | null;  // 当前激活的 Session ID
  
  // File buffers for unsaved content (keyed by filePath)
  fileBuffers: Record<string, FileBuffer>;
  setFileBuffer: (filePath: string, content: string) => void;
  getFileBuffer: (filePath: string) => FileBuffer | null;
  clearFileBuffer: (filePath: string) => void;
  
  createSession: (name?: string, options?: { cwd?: string; commands?: string[] }) => Promise<void>;
  deleteSession: (id: string) => void;
  showSession: (id: string) => void;
  hideSession: (id: string) => void;
  toggleSessionVisibility: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  closeTab: (id: string) => void;  // 从 Tab Bar 关闭（不删除 Session）
  renameSession: (id: string, name: string) => void;
  setSessionNameFromFirstInput: (id: string, input: string) => void;  // 从首次输入设置名称
  reorderTabs: (fromIndex: number, toIndex: number) => void;  // 重新排序 Tab
  updateLastActivityTime: (sessionId: string) => void;  // 更新最后活动时间
  setAIToolState: (sessionId: string, state: AIToolState | null) => void;  // 设置 AI 工具状态
  getAIToolState: (sessionId: string) => AIToolState | null;  // 获取 AI 工具状态
  
  // Multi-terminal support
  createTerminalInSession: (sessionId: string, name?: string) => Promise<string | null>;  // Create new terminal in existing session
  closeTerminal: (sessionId: string, terminalId: string, force?: boolean) => void;  // Close specific terminal
  
  // New unified tab actions
  openTab: (type: TabType, sessionId?: string, terminalId?: string, title?: string) => void;
  openFileTab: (filePath: string) => void;
  openFlowTab: (flowId: string, flowName: string) => void;
  closeTabById: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  reorderTabsNew: (fromIndex: number, toIndex: number) => void;
  
  hasOpenTab: (sessionId: string) => boolean;
  
  // Session layout management
  setSessionLayout: (sessionId: string, layout: SplitPane) => void;
  getSessionLayout: (sessionId: string) => SplitPane | undefined;
  setSessionActiveTerminal: (sessionId: string, terminalId: string) => void;
  getSessionActiveTerminal: (sessionId: string) => string | undefined;
  ensureSessionHasTerminal: (sessionId: string) => Promise<void>;
}

const FILE_BUFFERS_STORAGE_KEY = 'ri-file-buffers';

const loadFileBuffersFromStorage = (): Record<string, FileBuffer> => {
  try {
    const stored = localStorage.getItem(FILE_BUFFERS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load file buffers from localStorage:', e);
  }
  return {};
};

const saveFileBuffersToStorage = (buffers: Record<string, FileBuffer>) => {
  try {
    localStorage.setItem(FILE_BUFFERS_STORAGE_KEY, JSON.stringify(buffers));
  } catch (e) {
    console.error('Failed to save file buffers to localStorage:', e);
  }
};

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  sessions: [],
  tabs: [],
  activeTabId: null,
  sessionLayouts: {},
  sessionActiveTerminals: {},
  visibleSessionIds: [],
  activeSessionId: null,

  fileBuffers: loadFileBuffersFromStorage(),
  setFileBuffer: (filePath: string, content: string) => {
    set((state) => {
      const newBuffers = {
        ...state.fileBuffers,
        [filePath]: { content, updatedAt: Date.now() }
      };
      saveFileBuffersToStorage(newBuffers);
      return { fileBuffers: newBuffers };
    });
  },
  getFileBuffer: (filePath: string) => {
    const fb = get().fileBuffers[filePath];
    return fb || null;
  },
  clearFileBuffer: (filePath: string) => {
    set((state) => {
      const next = { ...state.fileBuffers };
      delete next[filePath];
      saveFileBuffersToStorage(next);
      return { fileBuffers: next };
    });
  },
  
  createSession: async (name?: string, options?: { cwd?: string; commands?: string[] }) => {
    try {
      const sessionName = name || `Session ${get().sessions.length + 1}`;
      const sessionId = nanoid();
      const { id: terminalId } = await window.terminal.create({ 
        sessionName,
        sessionId,
        cwd: options?.cwd,
      });
      const now = Date.now();
      
      // 创建 xterm 实例
      const xtermStore = useXTermStore.getState();
      xtermStore.createInstance(terminalId, sessionId);
      
      set((state) => ({
        sessions: [
          ...state.sessions,
          {
            id: sessionId,
            name: sessionName,
            terminalIds: [terminalId],  // Array of terminal IDs
            createdAt: now,
            isVisible: true,
            lastActivityTime: now,  // 初始化为创建时间
            isNameSetByUser: false,  // 初始未被用户设置
          },
        ],
        visibleSessionIds: [...state.visibleSessionIds, sessionId],
        activeSessionId: sessionId,  // 新创建的自动激活
      }));
      
      // Create and open a terminal tab
      get().openTab('terminal', sessionId, terminalId, sessionName);
      
      // Show terminal
      window.terminal.show({ id: terminalId });
      
      // Execute initial commands if provided
      if (options?.commands && options.commands.length > 0) {
        setTimeout(() => {
          const cmds = options.commands!.filter(c => c.trim());
          if (cmds.length > 0) {
            window.terminal.write({ id: terminalId, data: cmds.join(' && ') + '\n' });
          }
        }, 500);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  },
  
  deleteSession: (id: string) => {
    // Actually delete the session and terminal
    const session = get().sessions.find((s) => s.id === id);
    if (session) {
      // 销毁所有 xterm 实例
      const xtermStore = useXTermStore.getState();
      session.terminalIds.forEach(terminalId => {
        xtermStore.destroyInstance(terminalId);
      });
      
      // 销毁所有 PTY
      session.terminalIds.forEach(terminalId => {
        window.terminal.dispose({ id: terminalId });
      });
      
      // Delete session log file
      window.sessionLog.delete({ sessionId: id });
    }
    
    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== id);
      const newVisibleIds = state.visibleSessionIds.filter((sid) => sid !== id);
      
      // 如果删除的是激活的，切换到下一个
      let newActiveId = state.activeSessionId;
      if (state.activeSessionId === id) {
        newActiveId = newVisibleIds[0] || null;
      }
      
      return {
        sessions: newSessions,
        visibleSessionIds: newVisibleIds,
        activeSessionId: newActiveId,
      };
    });
  },
  
  showSession: (id: string) => {
    const session = get().sessions.find((s) => s.id === id);
    if (!session) return;
    
    // 1. 使用统一tab系统
    const existingTab = get().tabs.find(
      t => t.type === 'terminal' && t.sessionId === id
    );
    
    if (existingTab) {
      // Tab已存在，直接激活
      get().setActiveTab(existingTab.id);
    } else {
      // 创建新tab，使用当前session名字和第一个terminal
      const firstTerminalId = session.terminalIds[0];
      get().openTab('terminal', id, firstTerminalId, session.name);
    }
    
    // 2. 同步更新旧系统（向后兼容）
    const isAlreadyVisible = get().visibleSessionIds.includes(id);
    
    if (!isAlreadyVisible) {
      // Show all terminals in the session
      session.terminalIds.forEach(terminalId => {
        window.terminal.show({ id: terminalId });
      });
      
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, isVisible: true } : s
        ),
        visibleSessionIds: [...state.visibleSessionIds, id],
        activeSessionId: id,
      }));
    } else {
      set({ activeSessionId: id });
    }
  },
  
  hideSession: (id: string) => {
    const session = get().sessions.find((s) => s.id === id);
    if (!session) return;
    
    // Hide all terminals in the session
    session.terminalIds.forEach(terminalId => {
      window.terminal.hide({ id: terminalId });
    });
    
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, isVisible: false } : s
      ),
      visibleSessionIds: state.visibleSessionIds.filter((sid) => sid !== id),
    }));
  },
  
  toggleSessionVisibility: (id: string) => {
    const isVisible = get().visibleSessionIds.includes(id);
    if (isVisible) {
      get().hideSession(id);
    } else {
      get().showSession(id);
    }
  },
  
  setActiveSession: (id: string | null) => {
    if (id === null) {
      set({ activeSessionId: null });
      return;
    }
    
    const { visibleSessionIds } = get();
    
    // 必须是 visible 的才能激活
    if (!visibleSessionIds.includes(id)) return;
    
    // 同步更新统一tab系统
    const correspondingTab = get().tabs.find(
      t => t.type === 'terminal' && t.sessionId === id
    );
    
    if (correspondingTab) {
      get().setActiveTab(correspondingTab.id);
    }
    
    set({ activeSessionId: id });
    
    // 延迟清除该session的通知（3秒后）
    const notifyStore = useNotifyStore.getState();
    notifyStore.clearSessionDelayed(id, 3000);
  },
  
  closeTab: (id: string) => {
    // 从 Tab Bar 关闭，但不删除 Session
    const session = get().sessions.find((s) => s.id === id);
    if (!session) return;
    
    // Hide all terminals in the session
    session.terminalIds.forEach(terminalId => {
      window.terminal.hide({ id: terminalId });
    });
    
    set((state) => {
      const newVisibleIds = state.visibleSessionIds.filter((sid) => sid !== id);
      
      // 如果关闭的是激活的，切换到前一个或下一个
      let newActiveId = state.activeSessionId;
      if (state.activeSessionId === id) {
        const currentIndex = state.visibleSessionIds.indexOf(id);
        if (currentIndex > 0) {
          // 切换到前一个
          newActiveId = state.visibleSessionIds[currentIndex - 1];
        } else if (newVisibleIds.length > 0) {
          // 切换到下一个
          newActiveId = newVisibleIds[0];
        } else {
          newActiveId = null;
        }
      }
      
      return {
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, isVisible: false } : s
        ),
        visibleSessionIds: newVisibleIds,
        activeSessionId: newActiveId,
      };
    });
  },
  
  renameSession: (id: string, name: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, name } : s
      ),
      // 同步更新对应的terminal tab标题
      tabs: state.tabs.map((t) =>
        t.type === 'terminal' && t.sessionId === id 
          ? { ...t, title: name } 
          : t
      ),
    }));
    
    // 通知后端更新session名字，这样通知会使用最新的session名字
    window.sessionLog.updateName({ sessionId: id, sessionName: name });
  },
  
  setSessionNameFromFirstInput: (id: string, input: string) => {
    const session = get().sessions.find((s) => s.id === id);
    
    // 只有当名称未被用户设置过时才更新
    if (!session || session.isNameSetByUser) {
      return;
    }
    
    // 清理输入：去除首尾空白，最多25字符
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return;
    }
    
    const newName = trimmedInput.slice(0, 25);
    
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, name: newName, isNameSetByUser: true } : s
      ),
      // 同步更新对应的terminal tab标题
      tabs: state.tabs.map((t) =>
        t.type === 'terminal' && t.sessionId === id 
          ? { ...t, title: newName } 
          : t
      ),
    }));
    
    // 通知后端更新session名字，这样通知会使用最新的session名字
    window.sessionLog.updateName({ sessionId: id, sessionName: newName });
  },
  
  reorderTabs: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const newVisibleIds = [...state.visibleSessionIds];
      const [movedId] = newVisibleIds.splice(fromIndex, 1);
      newVisibleIds.splice(toIndex, 0, movedId);
      
      return {
        visibleSessionIds: newVisibleIds,
      };
    });
  },
  
  updateLastActivityTime: (sessionId: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, lastActivityTime: Date.now() } : s
      ),
    }));
  },
  
  setAIToolState: (sessionId: string, aiToolState: AIToolState | null) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, aiToolState } : s
      ),
    }));
  },
  
  getAIToolState: (sessionId: string) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    return session?.aiToolState || null;
  },
  
  createTerminalInSession: async (sessionId: string, name?: string) => {
    try {
      const session = get().sessions.find(s => s.id === sessionId);
      if (!session) return null;
      
      const terminalName = name || `Terminal ${session.terminalIds.length + 1}`;
      const { id: terminalId } = await window.terminal.create({ 
        sessionName: terminalName,
        sessionId
      });
      
      const xtermStore = useXTermStore.getState();
      xtermStore.createInstance(terminalId, sessionId);
      
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId 
            ? { ...s, terminalIds: [...s.terminalIds, terminalId] }
            : s
        ),
      }));
      
      window.terminal.show({ id: terminalId });
      
      return terminalId;
    } catch (error) {
      console.error('Failed to create terminal in session:', error);
      return null;
    }
  },
  
  closeTerminal: (sessionId: string, terminalId: string, force = false) => {
    const session = get().sessions.find(s => s.id === sessionId);
    if (!session) return;

    if (!force && session.terminalIds.length <= 1) {
      console.warn('Cannot close the last terminal in a session');
      return;
    }

    const remainingTerminals = session.terminalIds.filter(id => id !== terminalId);

    const xtermStore = useXTermStore.getState();
    xtermStore.destroyInstance(terminalId);

    window.terminal.dispose({ id: terminalId });

    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, terminalIds: s.terminalIds.filter(id => id !== terminalId) }
          : s
      ),
    }));

    if (remainingTerminals.length === 0) {
      const tabsToClose = get().tabs.filter(
        tab => tab.type === 'terminal' && tab.sessionId === sessionId
      );
      tabsToClose.forEach(tab => get().closeTabById(tab.id));
      return;
    }
  },
  
  // New unified tab actions
  openTab: (type: TabType, sessionId?: string, terminalId?: string, title?: string) => {
    const tabId = nanoid();
    const session = sessionId ? get().sessions.find(s => s.id === sessionId) : null;
    
    let tabTitle = title || '';
    if (!tabTitle) {
      if (type === 'terminal' && session) {
        tabTitle = terminalId ? `${session.name} - Terminal ${session.terminalIds.indexOf(terminalId) + 1}` : session.name;
      } else if (type === 'settings') {
        tabTitle = '[S]: Settings';
      }
    }
    
    // Check if tab already exists
    const existingTab = get().tabs.find(t => 
      t.type === type && 
      (type === 'settings' || (t.sessionId === sessionId && t.terminalId === terminalId))
    );
    
    if (existingTab) {
      // Tab already exists, just activate it
      set({ activeTabId: existingTab.id });
      return;
    }
    
    // Create new tab
    const newTab: Tab = {
      id: tabId,
      type,
      sessionId,
      terminalId,
      title: tabTitle,
    };
    
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: tabId,
    }));
    
    if (type === 'terminal' && sessionId) {
      get().showSession(sessionId);
    }
  },
  
  openFileTab: (filePath: string) => {
    const existingTab = get().tabs.find(t => t.type === 'file' && t.filePath === filePath);
    
    if (existingTab) {
      set({ activeTabId: existingTab.id });
      return;
    }
    
    const fileName = filePath.split('/').pop() || filePath;
    const newTab: Tab = {
      id: nanoid(),
      type: 'file',
      filePath,
      title: `📄 ${fileName}`,
    };
    
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
    }));
  },
  
  openFlowTab: (flowId: string, flowName: string) => {
    const existingTab = get().tabs.find(t => t.type === 'flow' && t.flowId === flowId);
    
    if (existingTab) {
      set({ activeTabId: existingTab.id });
      return;
    }
    
    const newTab: Tab = {
      id: nanoid(),
      type: 'flow',
      flowId,
      title: `⚡ ${flowName}`,
    };
    
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
    }));
  },
  
  closeTabById: (tabId: string) => {
    const state = get();
    const closedTab = state.tabs.find((t) => t.id === tabId);
    const currentIndex = state.tabs.findIndex((t) => t.id === tabId);
    const newTabs = state.tabs.filter((t) => t.id !== tabId);
    
    let newActiveTabId: string | null = state.activeTabId;
    if (state.activeTabId === tabId) {
      if (currentIndex > 0) {
        newActiveTabId = state.tabs[currentIndex - 1].id;
      } else if (newTabs.length > 0) {
        newActiveTabId = newTabs[0].id;
      } else {
        newActiveTabId = null;
      }
    }
    
    if (closedTab?.type === 'terminal' && closedTab.sessionId) {
      get().hideSession(closedTab.sessionId);
    }
    
    set({ tabs: newTabs });
    
    if (newActiveTabId !== state.activeTabId) {
      get().setActiveTab(newActiveTabId);
    }
  },
  
  setActiveTab: (tabId: string | null) => {
    const tab = get().tabs.find(t => t.id === tabId);
    
    // 如果是terminal tab，需要同步更新activeSessionId并显示terminal
    if (tab?.type === 'terminal' && tab.sessionId) {
      const session = get().sessions.find(s => s.id === tab.sessionId);
      if (session) {
        // 显示所有terminals
        session.terminalIds.forEach(terminalId => {
          window.terminal.show({ id: terminalId });
        });
        
        const { visibleSessionIds } = get();
        const isAlreadyVisible = visibleSessionIds.includes(tab.sessionId);
        
        if (!isAlreadyVisible) {
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === tab.sessionId ? { ...s, isVisible: true } : s
            ),
            visibleSessionIds: [...state.visibleSessionIds, tab.sessionId!],
            activeSessionId: tab.sessionId,
            activeTabId: tabId 
          }));
        } else {
          set({ 
            activeSessionId: tab.sessionId,
            activeTabId: tabId 
          });
        }
        
        // 延迟清除通知
        const notifyStore = useNotifyStore.getState();
        notifyStore.clearSessionDelayed(tab.sessionId, 3000);
      }
    } else {
      // 非terminal tab（如history, settings），只更新activeTabId
      set({ activeTabId: tabId });
    }
  },
  
  reorderTabsNew: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const newTabs = [...state.tabs];
      const [movedTab] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, movedTab);
      return { tabs: newTabs };
    });
  },
  
  // Helper method to check if session has open tab
  hasOpenTab: (sessionId: string) => {
    const { tabs } = get();
    return tabs.some(tab => tab.sessionId === sessionId);
  },
  
  setSessionLayout: (sessionId: string, layout: SplitPane) => {
    set((state) => ({
      sessionLayouts: {
        ...state.sessionLayouts,
        [sessionId]: layout,
      },
    }));
  },
  
  getSessionLayout: (sessionId: string) => {
    return get().sessionLayouts[sessionId];
  },
  
  setSessionActiveTerminal: (sessionId: string, terminalId: string) => {
    set((state) => ({
      sessionActiveTerminals: {
        ...state.sessionActiveTerminals,
        [sessionId]: terminalId,
      },
    }));
  },
  
  getSessionActiveTerminal: (sessionId: string) => {
    return get().sessionActiveTerminals[sessionId];
  },
  
  ensureSessionHasTerminal: async (sessionId: string) => {
    const session = get().sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    if (session.terminalIds.length === 0) {
      await get().createTerminalInSession(sessionId);
    }
  },
}));
