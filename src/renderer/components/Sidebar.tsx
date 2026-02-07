import React from 'react';
import { useNotifyStore } from '../store/notifyStore';
import { useTerminalStore } from '../store/terminalStore';
import { AppView } from '../App';
import './Sidebar.css';

interface CategoryTab {
  id: AppView;
  label: string;
  icon: string;
}

const CATEGORIES: CategoryTab[] = [
  { id: 'sessions', label: 'Sessions', icon: '⚡' },
  { id: 'flow', label: 'Flow', icon: '🛤️' },
  { id: 'notify', label: 'Notify', icon: '🔔' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

// Views that have a navigation panel
const VIEWS_WITH_NAV: AppView[] = ['sessions', 'notify', 'flow'];

interface SidebarProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  sidebarCollapsed: boolean;
  onToggleCollapse: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange, sidebarCollapsed, onToggleCollapse }) => {
  const totalUnread = useNotifyStore((state) => state.totalUnread);
  const openTab = useTerminalStore((state) => state.openTab);
  
  const handleViewChange = (view: AppView) => {
    const hasNav = VIEWS_WITH_NAV.includes(view);
    
    if (view === activeView && hasNav) {
      // Clicking active view with nav panel → toggle collapse
      onToggleCollapse(!sidebarCollapsed);
    } else {
      onViewChange(view);
      // Switching to a view with nav → ensure expanded
      if (hasNav && sidebarCollapsed) {
        onToggleCollapse(false);
      }
    }
    
    // Open settings tab when clicking settings
    if (view === 'settings') {
      openTab('settings', undefined, '[S]: Settings');
    }
  };

  return (
    <div className="sidebar-tabs" data-testid="sidebar">
      <div className="sidebar-tabs-main">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            className={`sidebar-tab ${activeView === category.id ? 'active' : ''}`}
            onClick={() => handleViewChange(category.id)}
            aria-label={category.label}
            data-testid={`view-${category.id}`}
          >
            <span className="sidebar-tab-icon">{category.icon}</span>
            <span className="sidebar-tab-label">{category.label}</span>
            {category.id === 'notify' && totalUnread > 0 && (
              <span className="sidebar-tab-badge">{totalUnread}</span>
            )}
          </button>
        ))}
      </div>
      {VIEWS_WITH_NAV.includes(activeView) && (
        <div className="sidebar-tabs-footer">
          <button
            className="sidebar-tab sidebar-toggle-btn"
            onClick={() => onToggleCollapse(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            data-testid="sidebar-toggle"
          >
            <span className="sidebar-tab-icon">{sidebarCollapsed ? '⇥' : '⇤'}</span>
            <span className="sidebar-tab-label">{sidebarCollapsed ? '展开' : '收起'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
