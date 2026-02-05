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

interface SidebarProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const totalUnread = useNotifyStore((state) => state.totalUnread);
  const openTab = useTerminalStore((state) => state.openTab);
  
  const handleViewChange = (view: AppView) => {
    onViewChange(view);
    
    // Open settings tab when clicking settings
    if (view === 'settings') {
      openTab('settings', undefined, '[S]: Settings');
    }
  };

  return (
    <div className="sidebar-tabs" data-testid="sidebar">
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
  );
};

export default Sidebar;
