/**
 * UI Edit Store
 * 独立的编辑状态管理，与业务数据（sessions/tabs）完全分离
 * 用于管理 SessionList 和 TabBar 的编辑行为
 */

import { create } from 'zustand';

interface UIEditState {
  // Session 编辑状态
  editingSessionId: string | null;
  sessionEditName: string;
  
  // Tab 编辑状态
  editingTabId: string | null;
  tabEditName: string;
  
  // 辅助查询 - 是否有任何编辑正在进行
  isEditingAnything: () => boolean;
  
  // Session 编辑操作
  startEditSession: (sessionId: string, currentName: string) => void;
  updateSessionEditName: (name: string) => void;
  finishEditSession: (onSave?: (name: string) => void) => void;
  cancelEditSession: () => void;
  
  // Tab 编辑操作
  startEditTab: (tabId: string, currentName: string) => void;
  updateTabEditName: (name: string) => void;
  finishEditTab: (onSave?: (name: string) => void) => void;
  cancelEditTab: () => void;
  
  // 辅助查询
  isEditingSession: (sessionId: string) => boolean;
  isEditingTab: (tabId: string) => boolean;
}

export const useUIEditStore = create<UIEditState>((set, get) => ({
  // 初始状态
  editingSessionId: null,
  sessionEditName: '',
  editingTabId: null,
  tabEditName: '',
  
  // 辅助查询 - 是否有任何编辑正在进行
  isEditingAnything: () => {
    const state = get();
    return state.editingSessionId !== null || state.editingTabId !== null;
  },
  
  // Session 编辑操作
  startEditSession: (sessionId: string, currentName: string) => {
    set({
      editingSessionId: sessionId,
      sessionEditName: currentName,
    });
  },
  
  updateSessionEditName: (name: string) => {
    set({ sessionEditName: name });
  },
  
  finishEditSession: (onSave?: (name: string) => void) => {
    const { sessionEditName } = get();
    const trimmedName = sessionEditName.trim();
    
    // 如果名称有效（非空），调用保存回调
    if (trimmedName && onSave) {
      onSave(trimmedName);
    }
    
    // 无论是否保存，都退出编辑状态
    set({ 
      editingSessionId: null, 
      sessionEditName: '' 
    });
  },
  
  cancelEditSession: () => {
    set({ 
      editingSessionId: null, 
      sessionEditName: '' 
    });
  },
  
  // Tab 编辑操作
  startEditTab: (tabId: string, currentName: string) => {
    set({
      editingTabId: tabId,
      tabEditName: currentName,
    });
  },
  
  updateTabEditName: (name: string) => {
    set({ tabEditName: name });
  },
  
  finishEditTab: (onSave?: (name: string) => void) => {
    const { tabEditName } = get();
    const trimmedName = tabEditName.trim();
    
    // 如果名称有效（非空），调用保存回调
    if (trimmedName && onSave) {
      onSave(trimmedName);
    }
    
    // 无论是否保存，都退出编辑状态
    set({ 
      editingTabId: null, 
      tabEditName: '' 
    });
  },
  
  cancelEditTab: () => {
    set({ 
      editingTabId: null, 
      tabEditName: '' 
    });
  },
  
  // 辅助查询方法
  isEditingSession: (sessionId: string) => {
    return get().editingSessionId === sessionId;
  },
  
  isEditingTab: (tabId: string) => {
    return get().editingTabId === tabId;
  },
}));
