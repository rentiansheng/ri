import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTerminalStore, Tab, AIToolState } from '../store/terminalStore';
import { useNotifyStore } from '../store/notifyStore';
import { useUIEditStore } from '../store/uiEditStore';
import { NotificationType } from '../types/global';
import './TabBar.css';

const getAIStatusIcon = (status: AIToolState['status'] | undefined) => {
  if (!status || status === 'idle') return null;
  
  switch (status) {
    case 'thinking':
      return '🤔';
    case 'waiting':
      return '⏸';
    case 'executing':
      return '⚡';
    case 'completed':
      return '✅';
    default:
      return null;
  }
};

export const TabBar: React.FC = () => {
  const { 
    tabs,
    activeTabId,
    setActiveTab,
    closeTabById,
    reorderTabsNew,
    sessions,
    renameSession,
    getFileBuffer,
    clearFileBuffer,
  } = useTerminalStore();
  
  const notifyStore = useNotifyStore();
  
  // 使用独立的 uiEditStore 管理编辑状态 - 只订阅需要的状态
  const editingTabId = useUIEditStore((state) => state.editingTabId);
  const tabEditName = useUIEditStore((state) => state.tabEditName);
  const startEditTab = useUIEditStore((state) => state.startEditTab);
  const updateTabEditName = useUIEditStore((state) => state.updateTabEditName);
  const finishEditTab = useUIEditStore((state) => state.finishEditTab);
  const cancelEditTab = useUIEditStore((state) => state.cancelEditTab);
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const checkUnsavedAndPrompt = useCallback(async (tab: Tab | undefined): Promise<'save' | 'discard' | 'cancel'> => {
    if (!tab || tab.type !== 'file' || !tab.filePath) {
      return 'discard';
    }
    
    const buffer = getFileBuffer(tab.filePath);
    if (!buffer) {
      return 'discard';
    }

    const result = window.confirm(
      `"${tab.title}" has unsaved changes.\n\nClick OK to discard changes, or Cancel to go back.`
    );
    
    if (result) {
      clearFileBuffer(tab.filePath);
      return 'discard';
    }
    return 'cancel';
  }, [getFileBuffer, clearFileBuffer]);

  const handleTabClick = async (tabId: string, isEditingThis: boolean) => {
    if (isEditingThis) {
      return;
    }
    
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab && currentTab.id !== tabId && currentTab.type === 'file' && currentTab.filePath) {
      const decision = await checkUnsavedAndPrompt(currentTab);
      if (decision === 'cancel') {
        return;
      }
    }
    
    setActiveTab(tabId);
    
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.type === 'terminal' && tab.sessionId) {
      notifyStore.clearSession(tab.sessionId);
    }
  };

  const handleCloseTab = async (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.type === 'file' && tab.filePath) {
      const decision = await checkUnsavedAndPrompt(tab);
      if (decision === 'cancel') {
        return;
      }
    }
    
    closeTabById(tabId);
  };

  const handleDoubleClick = (e: React.MouseEvent, tab: Tab) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Only allow renaming terminal tabs
    if (tab.type === 'terminal' && tab.sessionId) {
      // 如果正在编辑其他 tab，先保存
      if (editingTabId && editingTabId !== tab.id) {
        finishEditTab((name) => {
          const editingTab = tabs.find(t => t.id === editingTabId);
          if (editingTab && editingTab.type === 'terminal' && editingTab.sessionId) {
            renameSession(editingTab.sessionId, name);
          }
        });
      }
      
      startEditTab(tab.id, tab.title);
    }
  };

  const handleSaveTab = (tab: Tab) => {
    finishEditTab((newName) => {
      if (tab.type === 'terminal' && tab.sessionId) {
        renameSession(tab.sessionId, newName);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, tab: Tab) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTab(tab);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditTab();
    }
  };

  // 全局点击外部检测
  useEffect(() => {
    const currentEditingTabId = editingTabId;
    if (!currentEditingTabId) return;
    
    const currentTab = tabs.find(t => t.id === currentEditingTabId);
    if (!currentTab) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // 检查是否点击了 input 自身
      if (inputRef.current && inputRef.current.contains(target)) {
        return;
      }
      
      // 检查是否点击了关闭按钮 - 如果是，先保存再关闭
      if (target.closest('.tab-close')) {
        handleSaveTab(currentTab);
        return;
      }
      
      // 点击了其他地方，自动保存
      handleSaveTab(currentTab);
    };
    
    // 使用 mousedown 而不是 click，这样可以在 click 事件前捕获
    document.addEventListener('mousedown', handleClickOutside, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [editingTabId, tabs]);

  const handleMouseDownOnClose = () => {
    // 不再需要，全局点击处理器会处理
  };

  // 自动选中所有文本
  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const createDragPreview = (element: HTMLElement, tabTitle: string, isActive: boolean) => {
    const preview = document.createElement('div');
    preview.className = `tab-drag-preview ${isActive ? 'active' : ''}`;
    preview.style.position = 'fixed';
    preview.style.top = '-9999px';
    preview.style.left = '-9999px';
    preview.style.width = '120px';
    preview.style.height = '35px';
    preview.style.display = 'flex';
    preview.style.alignItems = 'center';
    preview.style.padding = '0 12px';
    preview.style.backgroundColor = isActive ? '#1e1e1e' : '#2d2d2d';
    preview.style.color = isActive ? '#ffffff' : '#969696';
    preview.style.borderRadius = '4px';
    preview.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
    preview.style.fontSize = '13px';
    preview.style.fontFamily = 'inherit';
    preview.style.whiteSpace = 'nowrap';
    preview.style.overflow = 'hidden';
    preview.style.textOverflow = 'ellipsis';
    preview.style.pointerEvents = 'none';
    preview.style.zIndex = '10000';
    preview.textContent = tabTitle;
    
    if (isActive) {
      preview.style.borderBottom = '2px solid #007acc';
    }
    
    document.body.appendChild(preview);
    return preview;
  };

  const handleDragStart = (e: React.DragEvent, index: number, tab: Tab) => {
    setDraggedIndex(index);
    
    const target = e.currentTarget as HTMLElement;
    const preview = createDragPreview(target, tab.title, tab.id === activeTabId);
    dragPreviewRef.current = preview;
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(preview, preview.offsetWidth / 2, preview.offsetHeight / 2);
    
    setTimeout(() => {
      target.classList.add('dragging');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('dragging');
    
    if (dragPreviewRef.current) {
      document.body.removeChild(dragPreviewRef.current);
      dragPreviewRef.current = null;
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      reorderTabsNew(draggedIndex, dropIndex);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Get AI status for terminal tabs
  const getTabAIStatus = (tab: Tab): AIToolState['status'] | undefined => {
    if (tab.type === 'terminal' && tab.sessionId) {
      const session = sessions.find(s => s.id === tab.sessionId);
      return session?.aiToolState?.status;
    }
    return undefined;
  };

  // Get tab style class based on type
  const getTabClassName = (tab: Tab): string => {
    const baseClass = 'tab';
    const activeClass = tab.id === activeTabId ? 'active' : '';
    const typeClass = tab.type === 'settings' ? 'tab-settings' : '';
    const dragClass = dragOverIndex !== null ? 'drag-over' : '';
    
    return `${baseClass} ${activeClass} ${typeClass} ${dragClass}`.trim();
  };

  // Get tab notification dot state
  const getTabNotificationDot = (tab: Tab): {
    show: boolean;
    type: NotificationType;
  } | null => {
    if (tab.type !== 'terminal' || !tab.sessionId) return null;
    
    const state = notifyStore.getSessionNotificationState(tab.sessionId);
    if (!state || !state.hasNotifications || !state.latestType) return null;
    
    return {
      show: true,
      type: state.latestType,
    };
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="tab-bar" data-testid="tab-bar">
      <div className="tab-container">
        {tabs.map((tab, index) => {
          const aiStatus = getTabAIStatus(tab);
          const aiIcon = getAIStatusIcon(aiStatus);
          const notifDot = getTabNotificationDot(tab);
          const isEditingThis = editingTabId === tab.id;
          
          return (
            <div
              key={tab.id}
              className={getTabClassName(tab)}
              onClick={() => handleTabClick(tab.id, isEditingThis)}
              onDoubleClick={(e) => handleDoubleClick(e, tab)}
              draggable={!isEditingThis}
              onDragStart={(e) => handleDragStart(e, index, tab)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              data-testid={`tab-${tab.id}`}
            >
              {notifDot?.show && (
                <span 
                  className={`tab-notification-dot ${notifDot.type}`}
                  title={`Unread notifications`}
                />
              )}
              {aiIcon && <span className="tab-status-icon">{aiIcon}</span>}
              {isEditingThis ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={tabEditName}
                  onChange={(e) => updateTabEditName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, tab)}
                  className="tab-rename-input"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`tab-rename-input-${tab.id}`}
                />
              ) : (
                <span className="tab-title">{tab.title}</span>
              )}
              <button
                className="tab-close"
                onClick={(e) => handleCloseTab(e, tab.id)}
                aria-label="Close tab"
                data-testid={`close-tab-${tab.id}`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TabBar;
