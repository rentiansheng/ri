import React, { useState, useEffect } from 'react';
import { useTerminalStore, Session, Tab } from './store/terminalStore';
import { useConfigStore } from './store/configStore';
import { useNotifyStore } from './store/notifyStore';
import Sidebar from './components/Sidebar';
import SessionList from './components/SessionList';
import HistoryList from './components/HistoryList';
import HistoryDetail from './components/HistoryDetail';
import NotifyList from './components/NotifyList';
import NotifyDetail from './components/NotifyDetail';
import Terminal from './components/Terminal';
import { TabBar } from './components/TabBar';
import { HistoryContent } from './components/HistoryContent';
import FlowView from './components/FlowView';
import SettingsView from './components/SettingsView';
import { NotificationToastContainer } from './components/NotificationToast';
import { useAIToolMonitor } from './hooks/useAIToolMonitor';
import './styles/App.css';

// Load test helper in development
if (import.meta.env.DEV) {
  import('./utils/testNotifications');
}

export type AppView = 'sessions' | 'history' | 'flow' | 'notify' | 'settings';

function App() {
  // Tier 4.5: 精准订阅，避免不必要的重渲染
  // 只订阅 ID 和长度，不订阅完整的 session 对象（避免 lastActivityTime 等字段变化触发渲染）
  const sessionCount = useTerminalStore(state => state.sessions.length);
  const visibleSessionIds = useTerminalStore(state => state.visibleSessionIds);
  const activeSessionId = useTerminalStore(state => state.activeSessionId);
  const historySessionIds = useTerminalStore(state => state.historySessionIds);
  const activeHistorySessionId = useTerminalStore(state => state.activeHistorySessionId);
  const tabs = useTerminalStore(state => state.tabs);
  const activeTabId = useTerminalStore(state => state.activeTabId);
  const createSession = useTerminalStore(state => state.createSession);
  const loadConfig = useConfigStore(state => state.loadConfig);
  const hasVisibleSessions = visibleSessionIds.length > 0;
  const hasHistorySessions = historySessionIds.length > 0;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('sessions');
  
  // State for selected items in history and notify views
  const [selectedHistorySessionId, setSelectedHistorySessionId] = useState<string | null>(null);
  const [selectedNotifySessionId, setSelectedNotifySessionId] = useState<string | null>(null);
  
  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);
  
  // Setup notification listeners
  useEffect(() => {
    const cleanup = useNotifyStore.getState().setupListeners();
    return cleanup;
  }, []);
  
  // Start AI tool monitoring
  useAIToolMonitor();

  // Tier 4.5: 按需获取 sessions，不在顶层订阅
  const getSessions = useTerminalStore(state => state.sessions);
  const activeHistorySession = activeHistorySessionId 
    ? getSessions.find((s: Session) => s.id === activeHistorySessionId)
    : null;
    
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
  }, [sidebarCollapsed, activeView]);

  // Render navigation panel based on active view
  const renderNavigationPanel = React.useMemo(() => {
    switch (activeView) {
      case 'sessions':
        return <SessionList />;
      case 'history':
        return (
          <HistoryList 
            onSessionSelect={setSelectedHistorySessionId}
            selectedSessionId={selectedHistorySessionId}
          />
        );
      case 'notify':
        return (
          <NotifyList 
            onSessionSelect={setSelectedNotifySessionId}
            selectedSessionId={selectedNotifySessionId}
          />
        );
      case 'flow':
      case 'settings':
        // These views don't use the navigation panel
        return null;
      default:
        return null;
    }
  }, [activeView, selectedHistorySessionId, selectedNotifySessionId]);

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
        return <FlowView />;
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
          <div className={`terminals-wrapper ${!hasVisibleSessions ? 'hidden' : ''}`}>
            {(() => {
              console.log('[App] Rendering terminals:', {
                activeSessionId,
                visibleSessionIds,
                sessions: getSessions.map(s => ({ 
                  id: s.id, 
                  terminalId: s.terminalId, 
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
                <Terminal
                  key={session.id}
                  sessionId={session.id}
                  terminalId={session.terminalId}
                  sessionName={session.name}
                  isActive={isActive}
                  isVisible={isVisible}
                />
              );
            })}
          </div>
          
          {/* Render history content for active history tab */}
          {activeTab?.type === 'history' && activeTab.sessionId && (
            <div className="history-area">
              <HistoryContent 
                sessionId={activeTab.sessionId}
                sessionName={activeTab.title.replace('[H]: ', '')}
              />
            </div>
          )}
          
          {/* Render settings for active settings tab */}
          {activeTab?.type === 'settings' && (
            <div className="settings-area">
              <SettingsView />
            </div>
          )}
        </div>
      </div>
    );
  }, [tabs, activeTabId, activeView, hasVisibleSessions, visibleSessionIds, activeSessionId, getSessions, activeHistorySession, handleCreateSession]);

  return (
    <div className="app">
      {/* Left: Icon tabs (48px) */}
      <aside className="app-sidebar-icons">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
      </aside>
      
      {/* Left: Navigation panel (250px, collapsible) - show for sessions, history, notify */}
      {(activeView === 'sessions' || activeView === 'history' || activeView === 'notify') && (
        <>
          <aside className={`app-navigation ${sidebarCollapsed ? 'collapsed' : ''}`}>
            {renderNavigationPanel}
          </aside>
          
          {/* Navigation toggle button */}
          <button 
            className="navigation-toggle" 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? '展开导航栏' : '收起导航栏'}
          >
            {sidebarCollapsed ? '▶' : '◀'}
          </button>
        </>
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
