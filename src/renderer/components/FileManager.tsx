import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTerminalStore, Session } from '../store/terminalStore';
import { FileEntry, Config } from '../types/global';
import './FileManager.css';

type ViewMode = 'current' | 'tabs' | 'all';
type SortBy = 'name' | 'size' | 'mtime' | 'ctime';
type SortOrder = 'asc' | 'desc';

interface SessionWorkspace {
  sessionId: string;
  sessionName: string;
  terminalId: string;
  cwd: string | null;
  loading: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: 'directory' | 'file' | 'workspace' | 'favorite';
  path: string;
}

interface FileManagerProps {
  onOpenFile?: (filePath: string) => void;
}

const POLL_INTERVAL = 3000;

// Helper to format file size
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

// Helper to format time
const formatTime = (timestamp: number): string => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const FileManager: React.FC<FileManagerProps> = ({ onOpenFile }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('tabs');
  const [workspaces, setWorkspaces] = useState<SessionWorkspace[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [directoryContents, setDirectoryContents] = useState<Record<string, FileEntry[]>>({});
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const prevCwdMapRef = useRef<Map<string, string | null>>(new Map());
  
  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showHidden, setShowHidden] = useState(false);
  // Per-directory override for showHidden (temporary, session-only)
  const [dirShowHiddenOverride, setDirShowHiddenOverride] = useState<Record<string, boolean>>({});
  const [favoriteDirectories, setFavoriteDirectories] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [expandedFavorites, setExpandedFavorites] = useState<Set<string>>(new Set());

  const sessions = useTerminalStore(state => state.sessions);
  const tabs = useTerminalStore(state => state.tabs);
  const activeTabId = useTerminalStore(state => state.activeTabId);
  const openFileTab = useTerminalStore(state => state.openFileTab);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config: Config = await window.config.get();
        if (config.fileManager) {
          setFavoriteDirectories(config.fileManager.favorites || []);
          setShowHidden(config.fileManager.showHidden || false);
          setSortBy(config.fileManager.sortBy || 'name');
          setSortOrder(config.fileManager.sortOrder || 'asc');
        }
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    };
    loadConfig();
  }, []);

  const saveFavorites = useCallback(async (favorites: string[]) => {
    try {
      await window.config.update({
        fileManager: {
          favorites,
          showHidden,
          sortBy,
          sortOrder,
        }
      });
    } catch (e) {
      console.error('Failed to save favorites:', e);
    }
  }, [showHidden, sortBy, sortOrder]);

  const saveSettings = useCallback(async () => {
    try {
      await window.config.update({
        fileManager: {
          favorites: favoriteDirectories,
          showHidden,
          sortBy,
          sortOrder,
        }
      });
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [favoriteDirectories, showHidden, sortBy, sortOrder]);

  useEffect(() => {
    saveSettings();
  }, [showHidden, sortBy, sortOrder]);

  const getFilteredSessions = useCallback((): Session[] => {
    switch (viewMode) {
      case 'current': {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab?.type === 'terminal' && activeTab.sessionId) {
          const session = sessions.find(s => s.id === activeTab.sessionId);
          return session ? [session] : [];
        }
        return [];
      }
      case 'tabs': {
        const tabSessionIds = new Set(
          tabs.filter(t => t.type === 'terminal' && t.sessionId).map(t => t.sessionId)
        );
        return sessions.filter(s => tabSessionIds.has(s.id));
      }
      case 'all':
      default:
        return sessions;
    }
  }, [viewMode, sessions, tabs, activeTabId]);

  const fetchWorkspaceCwd = useCallback(async (session: Session): Promise<SessionWorkspace[]> => {
    const results: SessionWorkspace[] = [];
    
    for (const terminalId of session.terminalIds) {
      try {
        const processInfo = await window.terminal.getProcessInfo({ id: terminalId });
        results.push({
          sessionId: session.id,
          sessionName: session.name,
          terminalId,
          cwd: processInfo?.cwd || null,
          loading: false,
        });
      } catch (e) {
        results.push({
          sessionId: session.id,
          sessionName: session.name,
          terminalId,
          cwd: null,
          loading: false,
        });
      }
    }
    
    return results;
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    const filteredSessions = getFilteredSessions();
    const allWorkspaces: SessionWorkspace[] = [];
    
    setWorkspaces(filteredSessions.flatMap(s => 
      s.terminalIds.map(tid => ({
        sessionId: s.id,
        sessionName: s.name,
        terminalId: tid,
        cwd: null,
        loading: true,
      }))
    ));

    for (const session of filteredSessions) {
      const sessionWorkspaces = await fetchWorkspaceCwd(session);
      allWorkspaces.push(...sessionWorkspaces);
    }
    
    setWorkspaces(allWorkspaces);
  }, [getFilteredSessions, fetchWorkspaceCwd]);

  const pollCwdChanges = useCallback(async () => {
    const filteredSessions = getFilteredSessions();
    const newCwdMap = new Map<string, string | null>();
    const changedTerminals: string[] = [];
    
    for (const session of filteredSessions) {
      for (const terminalId of session.terminalIds) {
        try {
          const processInfo = await window.terminal.getProcessInfo({ id: terminalId });
          const newCwd = processInfo?.cwd || null;
          newCwdMap.set(terminalId, newCwd);
          
          const prevCwd = prevCwdMapRef.current.get(terminalId);
          if (prevCwd !== undefined && prevCwd !== newCwd) {
            changedTerminals.push(terminalId);
          }
        } catch (e) {
          newCwdMap.set(terminalId, null);
        }
      }
    }
    
    prevCwdMapRef.current = newCwdMap;
    
    if (changedTerminals.length > 0) {
      setWorkspaces(prev => prev.map(ws => {
        if (changedTerminals.includes(ws.terminalId)) {
          const newCwd = newCwdMap.get(ws.terminalId) || null;
          const oldCwd = ws.cwd;
          
          if (oldCwd && directoryContents[oldCwd]) {
            setDirectoryContents(prevContents => {
              const next = { ...prevContents };
              delete next[oldCwd];
              return next;
            });
          }
          
          return { ...ws, cwd: newCwd };
        }
        return ws;
      }));
    }
  }, [getFilteredSessions, directoryContents]);

  useEffect(() => {
    refreshWorkspaces();
  }, [viewMode, sessions.length, tabs.length, activeTabId]);

  useEffect(() => {
    const interval = setInterval(pollCwdChanges, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [pollCwdChanges]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const loadDirectory = async (dirPath: string) => {
    if (loadingDirs.has(dirPath)) return;
    
    setLoadingDirs(prev => new Set(prev).add(dirPath));
    
    try {
      const result = await window.file.readDir(dirPath);
      if (result.success && result.files) {
        setDirectoryContents(prev => ({ ...prev, [dirPath]: result.files! }));
      }
    } catch (e) {
      console.error('Failed to load directory:', e);
    } finally {
      setLoadingDirs(prev => {
        const next = new Set(prev);
        next.delete(dirPath);
        return next;
      });
    }
  };

  const handleFileClick = (filePath: string, isDirectory: boolean) => {
    if (isDirectory) {
      if (directoryContents[filePath]) {
        setDirectoryContents(prev => {
          const next = { ...prev };
          delete next[filePath];
          return next;
        });
      } else {
        loadDirectory(filePath);
      }
    } else {
      openFileTab(filePath);
      onOpenFile?.(filePath);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, type: ContextMenuState['type'], path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, path });
  };

  const addToFavorites = (path: string) => {
    if (!favoriteDirectories.includes(path)) {
      const newFavorites = [...favoriteDirectories, path];
      setFavoriteDirectories(newFavorites);
      saveFavorites(newFavorites);
    }
    setContextMenu(null);
  };

  const removeFromFavorites = (path: string) => {
    const newFavorites = favoriteDirectories.filter(f => f !== path);
    setFavoriteDirectories(newFavorites);
    saveFavorites(newFavorites);
    setContextMenu(null);
  };

  const toggleDirShowHidden = (dirPath: string) => {
    const currentGlobal = showHidden;
    const currentOverride = dirShowHiddenOverride[dirPath];
    if (currentOverride === undefined) {
      setDirShowHiddenOverride(prev => ({ ...prev, [dirPath]: !currentGlobal }));
    } else {
      setDirShowHiddenOverride(prev => {
        const next = { ...prev };
        delete next[dirPath];
        return next;
      });
    }
    setContextMenu(null);
  };

  const collapseAllInDir = (dirPath: string) => {
    setDirectoryContents(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        if (key.startsWith(dirPath) && key !== dirPath) {
          delete next[key];
        }
      });
      return next;
    });
    setContextMenu(null);
  };

  const shouldShowHiddenFor = (dirPath: string): boolean => {
    const override = dirShowHiddenOverride[dirPath];
    return override !== undefined ? override : showHidden;
  };

  const sortEntries = (entries: FileEntry[], dirPath: string): FileEntry[] => {
    const shouldShow = shouldShowHiddenFor(dirPath);
    let filtered = shouldShow ? entries : entries.filter(e => !e.isHidden && !e.name.startsWith('.'));
    
    return [...filtered].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'mtime':
          comparison = (a.mtime || 0) - (b.mtime || 0);
          break;
        case 'ctime':
          comparison = (a.ctime || 0) - (b.ctime || 0);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const toggleFavorite = (path: string) => {
    setExpandedFavorites(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
        setDirectoryContents(prevContents => {
          const nextContents = { ...prevContents };
          delete nextContents[path];
          return nextContents;
        });
      } else {
        next.add(path);
        loadDirectory(path);
      }
      return next;
    });
  };

  const groupedWorkspaces = workspaces.reduce((acc, ws) => {
    if (!acc[ws.sessionId]) {
      acc[ws.sessionId] = { name: ws.sessionName, workspaces: [] };
    }
    acc[ws.sessionId].workspaces.push(ws);
    return acc;
  }, {} as Record<string, { name: string; workspaces: SessionWorkspace[] }>);

  const getFileIcon = (entry: FileEntry, isWorkspaceRoot: boolean = false) => {
    if (entry.isDirectory) {
      return isWorkspaceRoot ? '📂' : '📁';
    }
    const ext = entry.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'json': return '📋';
      case 'yaml': case 'yml': return '📝';
      case 'md': return '📄';
      case 'ts': case 'tsx': return '🔷';
      case 'js': case 'jsx': return '🟨';
      case 'css': return '🎨';
      case 'html': return '🌐';
      case 'xml': return '📰';
      case 'sh': case 'bash': return '⚙️';
      case 'py': return '🐍';
      case 'go': return '🐹';
      case 'rs': return '🦀';
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': return '🖼️';
      case 'zip': case 'tar': case 'gz': return '📦';
      case 'pdf': return '📕';
      default: return '📄';
    }
  };

  const renderDirectoryContents = (dirPath: string, depth: number = 0) => {
    const contents = directoryContents[dirPath];
    if (!contents) return null;

    const sorted = sortEntries(contents, dirPath);

    return (
      <div className="fm-dir-contents" style={{ marginLeft: depth * 12 }}>
        {sorted.map(entry => {
          const fullPath = entry.path || `${dirPath}/${entry.name}`;
          const isExpanded = !!directoryContents[fullPath];
          
          return (
            <div key={entry.name}>
              <div 
                className={`fm-file-entry ${entry.isDirectory ? 'directory' : 'file'} ${(entry.isHidden || entry.name.startsWith('.')) ? 'hidden-file' : ''}`}
                onClick={() => handleFileClick(fullPath, entry.isDirectory)}
                onContextMenu={(e) => handleContextMenu(e, entry.isDirectory ? 'directory' : 'file', fullPath)}
                title={`${entry.name}${entry.size ? ` • ${formatSize(entry.size)}` : ''}${entry.mtime ? ` • Modified: ${new Date(entry.mtime).toLocaleString()}` : ''}`}
              >
                {entry.isDirectory && (
                  <span className="fm-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                )}
                {!entry.isDirectory && <span className="fm-expand-icon-placeholder" />}
                <span className="fm-file-icon">{getFileIcon(entry, false)}</span>
                <span className="fm-file-name">{entry.name}</span>
                {entry.isFile && entry.size !== undefined && (
                  <span className="fm-file-size">{formatSize(entry.size)}</span>
                )}
                {entry.mtime && (
                  <span className="fm-file-time">{formatTime(entry.mtime)}</span>
                )}
              </div>
              {entry.isDirectory && isExpanded && renderDirectoryContents(fullPath, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderFavorites = () => {
    if (favoriteDirectories.length === 0) return null;

    return (
      <div className="fm-favorites-section">
        <div className="fm-section-header">
          <span className="fm-section-icon">⭐</span>
          <span className="fm-section-title">Favorites</span>
        </div>
        {favoriteDirectories.map(favPath => {
          const name = favPath.split('/').pop() || favPath;
          const isExpanded = expandedFavorites.has(favPath);
          
          return (
            <div key={favPath} className="fm-favorite-item">
              <div 
                className="fm-favorite-path"
                onClick={() => toggleFavorite(favPath)}
                onContextMenu={(e) => handleContextMenu(e, 'favorite', favPath)}
                title={favPath}
              >
                <span className="fm-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                <span className="fm-folder-icon">📂</span>
                <span className="fm-path-text">{name}</span>
              </div>
              {isExpanded && directoryContents[favPath] && renderDirectoryContents(favPath, 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderContextMenu = () => {
    if (!contextMenu) return null;

    const isFavorite = favoriteDirectories.includes(contextMenu.path);
    const isDir = contextMenu.type === 'directory' || contextMenu.type === 'workspace' || contextMenu.type === 'favorite';
    const showHiddenForDir = contextMenu.path ? shouldShowHiddenFor(contextMenu.path) : showHidden;

    return (
      <div 
        className="fm-context-menu"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onClick={(e) => e.stopPropagation()}
      >
        {isDir && contextMenu.path && (
          <>
            {!isFavorite && (
              <div className="fm-context-item" onClick={() => addToFavorites(contextMenu.path)}>
                ⭐ Add to Favorites
              </div>
            )}
            {isFavorite && (
              <div className="fm-context-item" onClick={() => removeFromFavorites(contextMenu.path)}>
                ✖ Remove from Favorites
              </div>
            )}
            <div className="fm-context-separator" />
            <div className="fm-context-item" onClick={() => toggleDirShowHidden(contextMenu.path)}>
              {showHiddenForDir ? '👁 Hide Hidden Files' : '👁 Show Hidden Files'}
            </div>
            <div className="fm-context-item" onClick={() => collapseAllInDir(contextMenu.path)}>
              📁 Collapse All
            </div>
            <div className="fm-context-separator" />
          </>
        )}
        <div className="fm-context-submenu">
          <div className="fm-context-item has-submenu">
            📊 Sort by ▸
            <div className="fm-context-submenu-content">
              <div 
                className={`fm-context-item ${sortBy === 'name' ? 'active' : ''}`}
                onClick={() => { setSortBy('name'); setContextMenu(null); }}
              >
                Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div 
                className={`fm-context-item ${sortBy === 'size' ? 'active' : ''}`}
                onClick={() => { setSortBy('size'); setContextMenu(null); }}
              >
                Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div 
                className={`fm-context-item ${sortBy === 'mtime' ? 'active' : ''}`}
                onClick={() => { setSortBy('mtime'); setContextMenu(null); }}
              >
                Modified {sortBy === 'mtime' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div 
                className={`fm-context-item ${sortBy === 'ctime' ? 'active' : ''}`}
                onClick={() => { setSortBy('ctime'); setContextMenu(null); }}
              >
                Created {sortBy === 'ctime' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div className="fm-context-separator" />
              <div 
                className="fm-context-item"
                onClick={() => { setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); setContextMenu(null); }}
              >
                {sortOrder === 'asc' ? '↓ Descending' : '↑ Ascending'}
              </div>
            </div>
          </div>
        </div>
        <div className="fm-context-separator" />
        <div 
          className="fm-context-item"
          onClick={() => { setShowHidden(!showHidden); setContextMenu(null); }}
        >
          {showHidden ? '👁 Hide All Hidden' : '👁 Show All Hidden'}
        </div>
      </div>
    );
  };

  return (
    <div className="file-manager" onContextMenu={(e) => handleContextMenu(e, 'workspace', '')}>
      <div className="fm-header">
        <h3>📁 Files</h3>
        <button className="fm-refresh-btn" onClick={refreshWorkspaces} title="Refresh">
          🔄
        </button>
      </div>

      <div className="fm-mode-selector">
        <button 
          className={`fm-mode-btn ${viewMode === 'current' ? 'active' : ''}`}
          onClick={() => setViewMode('current')}
          title="Current Session"
        >
          Current
        </button>
        <button 
          className={`fm-mode-btn ${viewMode === 'tabs' ? 'active' : ''}`}
          onClick={() => setViewMode('tabs')}
          title="Open Tabs"
        >
          Tabs
        </button>
        <button 
          className={`fm-mode-btn ${viewMode === 'all' ? 'active' : ''}`}
          onClick={() => setViewMode('all')}
          title="All Sessions"
        >
          All
        </button>
      </div>

      <div className="fm-workspace-list">
        {renderFavorites()}
        
        {Object.keys(groupedWorkspaces).length === 0 && favoriteDirectories.length === 0 ? (
          <div className="fm-empty">
            {viewMode === 'current' ? 'No active terminal session' : 
             viewMode === 'tabs' ? 'No terminal tabs open' : 
             'No sessions'}
          </div>
        ) : (
          Object.entries(groupedWorkspaces).map(([sessionId, { name, workspaces: sessionWorkspaces }]) => (
            <div key={sessionId} className="fm-session-group">
              <div 
                className="fm-session-header"
                onClick={() => toggleSession(sessionId)}
              >
                <span className="fm-expand-icon">
                  {expandedSessions.has(sessionId) ? '▼' : '▶'}
                </span>
                <span className="fm-session-icon">⚡</span>
                <span className="fm-session-name">{name}</span>
                <span className="fm-session-count">{sessionWorkspaces.length}</span>
              </div>
              
              {expandedSessions.has(sessionId) && (
                <div className="fm-terminal-list">
                  {sessionWorkspaces.map(ws => (
                    <div key={ws.terminalId} className="fm-terminal-item">
                      {ws.loading ? (
                        <div className="fm-loading">Loading...</div>
                      ) : ws.cwd ? (
                        <div className="fm-cwd-container">
                          <div 
                            className="fm-cwd-path"
                            onClick={() => handleFileClick(ws.cwd!, true)}
                            onContextMenu={(e) => handleContextMenu(e, 'workspace', ws.cwd!)}
                            title={ws.cwd}
                          >
                            <span className="fm-expand-icon">
                              {directoryContents[ws.cwd] ? '▼' : '▶'}
                            </span>
                            <span className="fm-folder-icon">📂</span>
                            <span className="fm-path-text">{ws.cwd}</span>
                          </div>
                          {directoryContents[ws.cwd] && renderDirectoryContents(ws.cwd, 1)}
                        </div>
                      ) : (
                        <div className="fm-no-cwd">Unable to get working directory</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      {renderContextMenu()}
    </div>
  );
};

export default FileManager;
