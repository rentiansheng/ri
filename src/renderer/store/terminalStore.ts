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
  terminalId: string;
  createdAt: number;
  isVisible: boolean;  // 是否在右侧显示
  lastActivityTime: number;  // 最后活动时间（终端最后一次有数据输出的时间戳）
  aiToolState?: AIToolState | null;  // AI 工具状态
  isNameSetByUser: boolean;  // 名称是否由用户首次输入设置
}

// Tab types for unified tab system
export type TabType = 'terminal' | 'settings';

export interface Tab {
  id: string;  // Unique tab ID
  type: TabType;
  sessionId?: string;  // For terminal tabs
  title: string;  // Display title
}

interface TerminalStore {
  sessions: Session[];
  
  // Unified tab system
  tabs: Tab[];  // All tabs (terminal, settings)
  activeTabId: string | null;  // Currently active tab ID
  
  // Legacy - keeping for compatibility
  visibleSessionIds: string[];  // Tab Bar 中显示的 Session IDs（按打开顺序）
  activeSessionId: string | null;  // 当前激活的 Session ID
  
  createSession: (name?: string) => Promise<void>;
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
  
  // New unified tab actions
  openTab: (type: TabType, sessionId?: string, title?: string) => void;  // Open a new tab
  closeTabById: (tabId: string) => void;  // Close tab by ID
  setActiveTab: (tabId: string | null) => void;  // Set active tab
  reorderTabsNew: (fromIndex: number, toIndex: number) => void;  // Reorder tabs
  
  // Helper methods
  hasOpenTab: (sessionId: string) => boolean;  // Check if session has open tab
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  sessions: [],
  tabs: [],
  activeTabId: null,
  visibleSessionIds: [],
  activeSessionId: null,
  
  createSession: async (name?: string) => {
    try {
      const sessionName = name || `Session ${get().sessions.length + 1}`;
      const sessionId = nanoid();
      const { id: terminalId } = await window.terminal.create({ 
        sessionName,
        sessionId  // Pass sessionId to backend for logging
      });
      const now = Date.now();
      
      // 创建 xterm 实例
      const xtermStore = useXTermStore.getState();
      xtermStore.createInstance(sessionId, terminalId);
      
      set((state) => ({
        sessions: [
          ...state.sessions,
          {
            id: sessionId,
            name: sessionName,
            terminalId,
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
      get().openTab('terminal', sessionId, sessionName);
      
      // Show terminal
      window.terminal.show({ id: terminalId });
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  },
  
  deleteSession: (id: string) => {
    // Actually delete the session and terminal
    const session = get().sessions.find((s) => s.id === id);
    if (session) {
      // 销毁 xterm 实例
      const xtermStore = useXTermStore.getState();
      xtermStore.destroyInstance(id);
      
      // 销毁 PTY
      window.terminal.dispose({ id: session.terminalId });
      
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
      // 创建新tab，使用当前session名字
      get().openTab('terminal', id, session.name);
    }
    
    // 2. 同步更新旧系统（向后兼容）
    const isAlreadyVisible = get().visibleSessionIds.includes(id);
    
    if (!isAlreadyVisible) {
      window.terminal.show({ id: session.terminalId });
      
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
    
    // Hide terminal
    window.terminal.hide({ id: session.terminalId });
    
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
    
    // Hide terminal
    window.terminal.hide({ id: session.terminalId });
    
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
  
  // New unified tab actions
  openTab: (type: TabType, sessionId?: string, title?: string) => {
    const tabId = nanoid();
    const session = sessionId ? get().sessions.find(s => s.id === sessionId) : null;
    
    let tabTitle = title || '';
    if (!tabTitle) {
      if (type === 'terminal' && session) {
        tabTitle = session.name;
      } else if (type === 'settings') {
        tabTitle = '[S]: Settings';
      }
    }
    
    // Check if tab already exists
    const existingTab = get().tabs.find(t => 
      t.type === type && 
      (type === 'settings' || t.sessionId === sessionId)
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
      title: tabTitle,
    };
    
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: tabId,
    }));
    
    // Also update session visibility for terminal tabs
    if (type === 'terminal' && sessionId) {
      get().showSession(sessionId);
    }
  },
  
  closeTabById: (tabId: string) => {
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      const closedTab = state.tabs.find((t) => t.id === tabId);
      
      // If closing active tab, switch to previous or next
      let newActiveTabId = state.activeTabId;
      if (state.activeTabId === tabId) {
        const currentIndex = state.tabs.findIndex((t) => t.id === tabId);
        if (currentIndex > 0) {
          newActiveTabId = state.tabs[currentIndex - 1].id;
        } else if (newTabs.length > 0) {
          newActiveTabId = newTabs[0].id;
        } else {
          newActiveTabId = null;
        }
      }
      
      // Hide session if it's a terminal tab
      if (closedTab?.type === 'terminal' && closedTab.sessionId) {
        get().hideSession(closedTab.sessionId);
      }
      
      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
      };
    });
  },
  
  setActiveTab: (tabId: string | null) => {
    const tab = get().tabs.find(t => t.id === tabId);
    
    // 如果是terminal tab，需要同步更新activeSessionId并显示terminal
    if (tab?.type === 'terminal' && tab.sessionId) {
      const session = get().sessions.find(s => s.id === tab.sessionId);
      if (session) {
        // 显示terminal
        window.terminal.show({ id: session.terminalId });
        
        // 更新activeSessionId和activeTabId
        set({ 
          activeSessionId: tab.sessionId,
          activeTabId: tabId 
        });
        
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
}));
