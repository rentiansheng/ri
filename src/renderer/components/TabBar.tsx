import React, { useState, useRef } from 'react';
import { useTerminalStore, Tab, AIToolState } from '../store/terminalStore';
import { useNotifyStore } from '../store/notifyStore';
import { NotificationType } from '../types/global';
import './TabBar.css';

// Helper function to get AI tool status icon
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
  } = useTerminalStore();
  
  const notifyStore = useNotifyStore();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    
    // Clear notifications for this session when switching to terminal tab
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.type === 'terminal' && tab.sessionId) {
      notifyStore.clearSession(tab.sessionId);
    }
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation(); // Prevent tab activation when closing
    closeTabById(tabId);
  };

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
    const typeClass = tab.type === 'history' ? 'tab-history' : '';
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
          
          return (
            <div
              key={tab.id}
              className={getTabClassName(tab)}
              onClick={() => handleTabClick(tab.id)}
              draggable
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
              <span className="tab-title">{tab.title}</span>
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
