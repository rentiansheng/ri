import React, { useState, useEffect, useRef } from 'react';
import { useTerminalStore, Session, Tab } from './store/terminalStore';
import { useConfigStore } from './store/configStore';
import { useNotifyStore } from './store/notifyStore';
import { useXTermStore } from './store/xtermStore';
import Sidebar from './components/Sidebar';
import SessionList from './components/SessionList';
import NotifyList from './components/NotifyList';
import NotifyDetail from './components/NotifyDetail';
import FlowList from './components/FlowList';
import Terminal from './components/Terminal';
import SplitTerminalView from './components/SplitTerminalView';
import { TabBar } from './components/TabBar';
import FlowView from './components/FlowView';
import SettingsView from './components/SettingsView';
import FileViewer from './components/FileViewer';
import { NotificationToastContainer } from './components/NotificationToast';
import { useAIToolMonitor } from './hooks/useAIToolMonitor';
import './styles/App.css';

// Load test helper in development
if (import.meta.env.DEV) {
  import('./utils/testNotifications');
}

export type AppView = 'sessions' | 'flow' | 'notify' | 'settings';

function App() {
  // 精准订阅，避免不必要的重渲染
  const sessionCount = useTerminalStore(state => state.sessions.length);
  const visibleSessionIds = useTerminalStore(state => state.visibleSessionIds);
  const activeSessionId = useTerminalStore(state => state.activeSessionId);
  const tabs = useTerminalStore(state => state.tabs);
  const activeTabId = useTerminalStore(state => state.activeTabId);
  const createSession = useTerminalStore(state => state.createSession);
  const loadConfig = useConfigStore(state => state.loadConfig);
  const setTerminalConfig = useXTermStore(state => state.setTerminalConfig);
  const hasVisibleSessions = visibleSessionIds.length > 0;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('sessions');
  const [navigationWidth, setNavigationWidth] = useState(250); // 导航栏宽度
  const [isResizing, setIsResizing] = useState(false); // 是否正在拖动调整
  const navigationWidthRef = useRef(250); // 用于在事件处理器中获取最新值
  
  // 同步 navigationWidth 到 ref
  useEffect(() => {
    navigationWidthRef.current = navigationWidth;
  }, [navigationWidth]);
  
  // State for selected items in notify view
  const [selectedNotifySessionId, setSelectedNotifySessionId] = useState<string | null>(null);
  
  const [selectedFlowPath, setSelectedFlowPath] = useState<string[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);

  const handleFlowSelect = (flow: any) => {
    setSelectedFlowId(flow.id);
    if (flow.path) {
      setSelectedFlowPath(flow.path.split('/'));
    } else {
      setSelectedFlowPath([]);
    }
  };

  const handleFolderSelect = (path: string) => {
    setSelectedFlowPath(path ? path.split('/') : []);
  };
  
  // Load configuration on mount
  useEffect(() => {
    const loadConfigs = async () => {
      await loadConfig();
      
      // 加载终端配置和导航栏宽度
      try {
        const config = await window.config.get();
        if (config.terminal) {
          setTerminalConfig(config.terminal);
        }
        // 加载导航栏宽度
        if (config.window?.navigationWidth) {
          setNavigationWidth(config.window.navigationWidth);
          navigationWidthRef.current = config.window.navigationWidth;
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    };
    
    loadConfigs();
  }, [loadConfig, setTerminalConfig]);
  
  // 监听配置变化
  useEffect(() => {
    const cleanup = window.config.onChange((newConfig) => {
      if (newConfig.terminal) {
        setTerminalConfig(newConfig.terminal);
      }
    });
    
    return cleanup;
  }, [setTerminalConfig]);
  
  // Setup notification listeners
  useEffect(() => {
    const cleanup = useNotifyStore.getState().setupListeners();
    return cleanup;
  }, []);
  
  // Start AI tool monitoring
  useAIToolMonitor();

  // 按需获取 sessions
  const getSessions = useTerminalStore(state => state.sessions);
  
  // Handle creating new session
  const handleCreateSession = () => {
    createSession();
  };

  // 监听导航栏收起状态，触发终端 resize
  useEffect(() => {
    // 延迟触发 resize，等待 CSS 过渡动画完成（通常 200-300ms）
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
    return () => clearTimeout(timer);
  }, [sidebarCollapsed, activeView, navigationWidth]);

  // 处理导航栏拖动调整大小
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX - 48; // 减去左侧图标栏宽度
      if (newWidth < 80) {
        // Snap to collapsed when dragged near the edge
        setSidebarCollapsed(true);
        setNavigationWidth(250);
        setIsResizing(false);
      } else if (newWidth >= 150 && newWidth <= 500) {
        setNavigationWidth(newWidth);
      }
    };

    const handleMouseUp = async () => {
      setIsResizing(false);
      // 拖动结束后触发 resize
      window.dispatchEvent(new Event('resize'));
      
      // 保存导航栏宽度到配置
      try {
        const config = await window.config.get();
        await window.config.update({
          ...config,
          window: { 
            ...config.window, 
            navigationWidth: navigationWidthRef.current 
          }
        });
      } catch (error) {
        console.error('Failed to save navigation width:', error);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  const renderNavigationPanel = React.useMemo(() => {
    switch (activeView) {
      case 'sessions':
        return <SessionList />;
      case 'notify':
        return (
          <NotifyList 
            onSessionSelect={setSelectedNotifySessionId}
            selectedSessionId={selectedNotifySessionId}
          />
        );
      case 'flow':
        return (
          <FlowList 
            onFlowSelect={handleFlowSelect}
            onFolderSelect={handleFolderSelect}
            selectedFlowId={selectedFlowId}
            selectedPath={selectedFlowPath.join('/')}
          />
        );
      case 'settings':
        return null;
      default:
        return null;
    }
  }, [activeView, selectedNotifySessionId, selectedFlowId, selectedFlowPath]);

  // Render main content area based on active tab
  const renderMainContent = React.useMemo(() => {
    
    // If no tabs, show welcome or empty state based on view
    if (tabs.length === 0) {
      if (activeView === 'sessions') {
        return (
          <div className="main-content-area">
            {/* Title bar with New Session button */}
            <div className="welcome-header">
              <h2>Welcome to Second Brain OS</h2>
              <button 
                className="new-session-btn"
                data-testid="create-session-btn-welcome"
                onClick={handleCreateSession}
                title="Create New Session"
              >
                +
              </button>
            </div>
            <div className="welcome">
              <p>Create a session to get started</p>
              <p className="welcome-hint">Click the + button to create your first terminal session</p>
            </div>
          </div>
        );
      }
      
      // For other views without tabs, still render the view
      if (activeView === 'flow') {
        return <FlowView initialPath={selectedFlowPath} />;
      }
      
      return null;
    }
    
    // Get active tab
    const activeTab = tabs.find(t => t.id === activeTabId);
    
    // Render unified tab bar + content area
    return (
      <div className="main-content-area">
        {/* Tab bar */}
        <div className="tab-bar-wrapper">
          <TabBar />
          {/* New Session button - always show when in sessions view */}
          {activeView === 'sessions' && (
            <button 
              className="new-session-btn"
              onClick={handleCreateSession}
              title="Create New Session"
            >
              +
            </button>
          )}
        </div>
        
        {/* Terminals */}
        <div className="terminal-area">
          {/* Only show terminals wrapper when active tab is a terminal session */}
          <div className={`terminals-wrapper ${!hasVisibleSessions || activeTab?.type !== 'terminal' ? 'hidden' : ''}`}>
            {(() => {
              console.log('[App] Rendering terminals:', {
                activeSessionId,
                visibleSessionIds,
                sessions: getSessions.map(s => ({ 
                  id: s.id, 
                  terminalIds: s.terminalIds, 
                  name: s.name,
                  isActive: s.id === activeSessionId,
                  isVisible: visibleSessionIds.includes(s.id)
                }))
              });
              return null;
            })()}
            {getSessions.map((session: Session) => {
              const isActive = session.id === activeSessionId;
              const isVisible = visibleSessionIds.includes(session.id);
              return (
                <SplitTerminalView
                  key={session.id}
                  sessionId={session.id}
                  sessionName={session.name}
                  isActive={isActive}
                  isVisible={isVisible}
                />
              );
            })}
          </div>
          
          {activeTab?.type === 'settings' && (
            <div className="settings-area">
              <SettingsView />
            </div>
          )}
          
          {activeTab?.type === 'file' && activeTab.filePath && (
            <div className="file-viewer-area">
              <FileViewer filePath={activeTab.filePath} />
            </div>
          )}
        </div>
      </div>
    );
  }, [tabs, activeTabId, activeView, hasVisibleSessions, visibleSessionIds, activeSessionId, getSessions, handleCreateSession]);

  return (
    <div className="app">
      {/* Left: Icon tabs (48px) */}
      <aside className="app-sidebar-icons">
        <Sidebar 
          activeView={activeView} 
          onViewChange={setActiveView}
          sidebarCollapsed={sidebarCollapsed}
          onToggleCollapse={setSidebarCollapsed}
        />
      </aside>
      
      {(activeView === 'sessions' || activeView === 'notify' || activeView === 'flow') && (
        <div className="navigation-wrapper">
          <aside 
            className={`app-navigation ${sidebarCollapsed ? 'collapsed' : ''}`}
            data-testid="navigation-panel"
            style={{ 
              width: sidebarCollapsed ? 0 : navigationWidth,
              minWidth: sidebarCollapsed ? 0 : navigationWidth 
            }}
          >
            {renderNavigationPanel}
          </aside>
          
          {!sidebarCollapsed && (
            <div 
              className="navigation-resize-handle"
              data-testid="navigation-resize-handle"
              onMouseDown={handleResizeStart}
              style={{ left: navigationWidth }}
            />
          )}
        </div>
      )}
      
      {/* Right: Main content area */}
      <main className="app-main">
        {renderMainContent}
      </main>
      
      {/* Notification Toast Container */}
      <NotificationToastContainer />
    </div>
  );
}

export default App;
