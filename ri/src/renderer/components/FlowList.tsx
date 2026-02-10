import React, { useState, useEffect, useRef } from 'react';
import { Flow } from '../types/global.d';
import { useTerminalStore } from '../store/terminalStore';
import { nanoid } from 'nanoid';
import './FlowList.css';

interface FlowTreeNode {
  id: string;
  label: string;
  icon?: string;
  type: 'folder' | 'flow';
  path: string;
  children?: FlowTreeNode[];
  flow?: Flow;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetNode: FlowTreeNode | null;
  targetPath: string;
}

interface DragState {
  isDragging: boolean;
  draggedNode: FlowTreeNode | null;
  dropTarget: FlowTreeNode | null;
  dropPosition: 'before' | 'after' | 'inside' | null;
}

interface FlowListProps {
  onFlowSelect?: (flow: Flow) => void;
  onFolderSelect?: (path: string) => void;
  selectedFlowId?: string | null;
  selectedPath?: string;
}

const FlowList: React.FC<FlowListProps> = ({
  onFlowSelect,
  onFolderSelect,
  selectedFlowId,
  selectedPath = '',
}) => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetNode: null,
    targetPath: '',
  });
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedNode: null,
    dropTarget: null,
    dropPosition: null,
  });
  const editInputRef = useRef<HTMLInputElement>(null);
  const { createSession, openFlowTab } = useTerminalStore();

  useEffect(() => {
    loadFlows();
  }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(prev => ({ ...prev, visible: false }));
    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

  const loadFlows = async () => {
    const config = await window.config.get();
    setFlows(config.flows || []);
  };

  const buildTree = (flows: Flow[]): FlowTreeNode[] => {
    const folderMap = new Map<string, FlowTreeNode>();
    folderMap.set('', { id: 'root', label: 'Root', type: 'folder', path: '', children: [] });

    const sortedFlows = [...flows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    sortedFlows.forEach(flow => {
      const flowPath = flow.path || '';
      const parts = flowPath ? flowPath.split('/') : [];
      
      let currentPath = '';
      parts.forEach((part) => {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!folderMap.has(currentPath)) {
          const folderNode: FlowTreeNode = {
            id: `folder-${currentPath}`,
            label: part,
            icon: '📁',
            type: 'folder',
            path: currentPath,
            children: [],
          };
          folderMap.set(currentPath, folderNode);
          
          const parent = folderMap.get(parentPath);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(folderNode);
          }
        }
      });

      const flowNode: FlowTreeNode = {
        id: flow.id,
        label: flow.name,
        icon: flow.icon || (flow.mode === 'cron' ? '⏰' : '▶️'),
        type: 'flow',
        path: flowPath,
        flow,
      };

      const parent = folderMap.get(flowPath);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(flowNode);
      }
    });

    const rootNode = folderMap.get('');
    return rootNode?.children || [];
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleNodeClick = (node: FlowTreeNode) => {
    if (node.type === 'folder') {
      toggleFolder(node.path);
      onFolderSelect?.(node.path);
    } else if (node.flow) {
      onFlowSelect?.(node.flow);
      openFlowTab(node.flow.id, node.flow.name);
    }
  };

  const handleNodeDoubleClick = async (node: FlowTreeNode) => {
    if (node.type === 'flow' && node.flow) {
      await createSession(node.flow.name, {
        cwd: node.flow.cwd,
        commands: node.flow.commands,
      });
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, node: FlowTreeNode) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
    setDragState({
      isDragging: true,
      draggedNode: node,
      dropTarget: null,
      dropPosition: null,
    });
  };

  const handleDragEnd = () => {
    setDragState({
      isDragging: false,
      draggedNode: null,
      dropTarget: null,
      dropPosition: null,
    });
  };

  const handleDragOver = (e: React.DragEvent, node: FlowTreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!dragState.draggedNode || dragState.draggedNode.id === node.id) return;
    
    // Don't allow dropping a folder into itself or its children
    if (dragState.draggedNode.type === 'folder' && 
        (node.path === dragState.draggedNode.path || 
         node.path.startsWith(dragState.draggedNode.path + '/'))) {
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    let position: 'before' | 'after' | 'inside';
    if (node.type === 'folder') {
      // For folders: top 25% = before, middle 50% = inside, bottom 25% = after
      if (y < height * 0.25) {
        position = 'before';
      } else if (y > height * 0.75) {
        position = 'after';
      } else {
        position = 'inside';
      }
    } else {
      // For flows: top 50% = before, bottom 50% = after
      position = y < height * 0.5 ? 'before' : 'after';
    }
    
    setDragState(prev => ({
      ...prev,
      dropTarget: node,
      dropPosition: position,
    }));
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only clear if leaving the actual element, not entering a child
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragState(prev => ({
        ...prev,
        dropTarget: null,
        dropPosition: null,
      }));
    }
  };

  const handleDrop = async (e: React.DragEvent, targetNode: FlowTreeNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { draggedNode, dropPosition } = dragState;
    if (!draggedNode) {
      handleDragEnd();
      return;
    }

    const config = await window.config.get();
    let updatedFlows = [...(config.flows || [])];
    
    let newPath: string;
    let newOrder: number;
    
    if (!targetNode) {
      newPath = '';
      const rootFlows = updatedFlows.filter(f => (f.path || '') === '');
      newOrder = Math.max(...rootFlows.map(f => f.order ?? 0), -1) + 1;
    } else if (!dropPosition || draggedNode.id === targetNode.id) {
      handleDragEnd();
      return;
    } else if (dropPosition === 'inside' && targetNode.type === 'folder') {
      newPath = targetNode.path;
      const folderFlows = updatedFlows.filter(f => (f.path || '') === newPath);
      newOrder = Math.max(...folderFlows.map(f => f.order ?? 0), -1) + 1;
    } else {
      newPath = targetNode.path;
      const targetFlow = targetNode.type === 'flow' ? targetNode.flow : null;
      const targetOrder = targetFlow?.order ?? 0;
      
      if (dropPosition === 'before') {
        newOrder = targetOrder;
        updatedFlows = updatedFlows.map(f => {
          if ((f.path || '') === newPath && (f.order ?? 0) >= targetOrder && f.id !== draggedNode.id) {
            return { ...f, order: (f.order ?? 0) + 1 };
          }
          return f;
        });
      } else {
        newOrder = targetOrder + 1;
        updatedFlows = updatedFlows.map(f => {
          if ((f.path || '') === newPath && (f.order ?? 0) > targetOrder && f.id !== draggedNode.id) {
            return { ...f, order: (f.order ?? 0) + 1 };
          }
          return f;
        });
      }
    }

    if (draggedNode.type === 'flow' && draggedNode.flow) {
      updatedFlows = updatedFlows.map(f => 
        f.id === draggedNode.id ? { ...f, path: newPath, order: newOrder } : f
      );
    } else if (draggedNode.type === 'folder') {
      const oldPath = draggedNode.path;
      const folderName = oldPath.split('/').pop() || '';
      const newFolderPath = newPath ? `${newPath}/${folderName}` : folderName;
      
      updatedFlows = updatedFlows.map(f => {
        if (f.path === oldPath) {
          return { ...f, path: newFolderPath };
        }
        if (f.path?.startsWith(oldPath + '/')) {
          return { ...f, path: f.path.replace(oldPath, newFolderPath) };
        }
        return f;
      });
      
      setExpandedFolders(prev => {
        const next = new Set(prev);
        if (next.has(oldPath)) {
          next.delete(oldPath);
          next.add(newFolderPath);
        }
        if (targetNode && dropPosition === 'inside') {
          next.add(targetNode.path);
        }
        return next;
      });
    }

    await window.config.update({ flows: updatedFlows });
    setFlows(updatedFlows);
    handleDragEnd();
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    if (!dragState.draggedNode) return;
    const target = e.target as HTMLElement;
    if (target.closest('.flow-tree-item')) return;
    
    e.preventDefault();
    setDragState(prev => ({
      ...prev,
      dropTarget: null,
      dropPosition: 'inside',
    }));
  };

  const handleRootDrop = (e: React.DragEvent) => {
    if (!dragState.draggedNode) return;
    const target = e.target as HTMLElement;
    if (target.closest('.flow-tree-item')) return;
    
    handleDrop(e, null);
  };

  const handleContextMenu = (e: React.MouseEvent, node: FlowTreeNode | null, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetNode: node,
      targetPath: path,
    });
  };

  const createNewFolder = async () => {
    const parentPath = contextMenu.targetNode?.type === 'folder' 
      ? contextMenu.targetNode.path 
      : contextMenu.targetPath;
    
    const folderName = 'New Folder';
    const newPath = parentPath ? `${parentPath}/${folderName}` : folderName;
    
    const config = await window.config.get();
    const placeholderFlow: Flow = {
      id: nanoid(),
      name: '.folder-placeholder',
      mode: 'template',
      commands: [],
      enabled: false,
      path: newPath,
    };
    
    const updatedFlows = [...(config.flows || []), placeholderFlow];
    await window.config.update({ flows: updatedFlows });
    setFlows(updatedFlows);
    
    setExpandedFolders(prev => new Set([...prev, parentPath, newPath]));
    setEditingId(`folder-${newPath}`);
    setEditingValue(folderName);
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const createNewFlow = async () => {
    const parentPath = contextMenu.targetNode?.type === 'folder' 
      ? contextMenu.targetNode.path 
      : contextMenu.targetPath;
    
    const newFlow: Flow = {
      id: nanoid(),
      name: 'New Flow',
      mode: 'template',
      commands: [],
      enabled: false,
      path: parentPath,
    };
    
    const config = await window.config.get();
    const updatedFlows = [...(config.flows || []), newFlow];
    await window.config.update({ flows: updatedFlows });
    setFlows(updatedFlows);
    
    if (parentPath) {
      setExpandedFolders(prev => new Set([...prev, parentPath]));
    }
    
    setEditingId(newFlow.id);
    setEditingValue(newFlow.name);
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const startRename = (node: FlowTreeNode) => {
    setEditingId(node.id);
    setEditingValue(node.label);
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleRenameSubmit = async (node: FlowTreeNode) => {
    const newName = editingValue.trim();
    if (!newName || newName === node.label) {
      setEditingId(null);
      return;
    }

    const config = await window.config.get();
    let updatedFlows = [...(config.flows || [])];

    if (node.type === 'folder') {
      const oldPath = node.path;
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');

      updatedFlows = updatedFlows.map(f => {
        if (f.path === oldPath) {
          return { ...f, path: newPath };
        }
        if (f.path?.startsWith(oldPath + '/')) {
          return { ...f, path: f.path.replace(oldPath, newPath) };
        }
        return f;
      });

      setExpandedFolders(prev => {
        const next = new Set(prev);
        if (next.has(oldPath)) {
          next.delete(oldPath);
          next.add(newPath);
        }
        return next;
      });
    } else {
      updatedFlows = updatedFlows.map(f => 
        f.id === node.id ? { ...f, name: newName } : f
      );
    }

    await window.config.update({ flows: updatedFlows });
    setFlows(updatedFlows);
    setEditingId(null);
  };

  const canDeleteNode = (node: FlowTreeNode): boolean => {
    if (node.type === 'flow') return true;
    
    const hasRealChildren = node.children?.some(child => {
      if (child.type === 'flow' && child.flow?.name === '.folder-placeholder') {
        return false;
      }
      return true;
    });
    
    return !hasRealChildren;
  };

  const handleDelete = async (node: FlowTreeNode) => {
    if (node.type === 'folder' && !canDeleteNode(node)) {
      alert('Cannot delete folder with contents. Please delete or move items first.');
      setContextMenu(prev => ({ ...prev, visible: false }));
      return;
    }

    if (!confirm(`Delete "${node.label}"?`)) return;

    const config = await window.config.get();
    let updatedFlows = [...(config.flows || [])];

    if (node.type === 'folder') {
      updatedFlows = updatedFlows.filter(f => 
        f.path !== node.path && !f.path?.startsWith(node.path + '/')
      );
    } else {
      updatedFlows = updatedFlows.filter(f => f.id !== node.id);
    }

    await window.config.update({ flows: updatedFlows });
    setFlows(updatedFlows);
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const renderNode = (node: FlowTreeNode, depth: number = 0): React.ReactNode => {
    if (node.type === 'flow' && node.flow?.name === '.folder-placeholder') {
      return null;
    }

    const isExpanded = expandedFolders.has(node.path);
    const isSelected = node.type === 'flow' && node.id === selectedFlowId;
    const hasChildren = node.children && node.children.length > 0;
    const isEditing = editingId === node.id;
    const isDragging = dragState.draggedNode?.id === node.id;
    const isDropTarget = dragState.dropTarget?.id === node.id;
    const dropPosition = isDropTarget ? dragState.dropPosition : null;

    return (
      <div key={node.id} className="flow-tree-node">
        <div
          className={`flow-tree-item ${isSelected ? 'selected' : ''} ${node.type} ${isDragging ? 'dragging' : ''} ${isDropTarget ? `drop-${dropPosition}` : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => !isEditing && handleNodeClick(node)}
          onDoubleClick={() => !isEditing && handleNodeDoubleClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node, node.path)}
          draggable={!isEditing}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, node)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node)}
        >
          {node.type === 'folder' && (
            <span 
              className={`flow-tree-arrow ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleFolder(node.path); }}
            >
              ▶
            </span>
          )}
          {node.type === 'flow' && <span className="flow-tree-spacer" />}
          <span className="flow-tree-icon">{node.icon}</span>
          
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              className="flow-tree-edit-input"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={() => handleRenameSubmit(node)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit(node);
                if (e.key === 'Escape') setEditingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flow-tree-label">{node.label}</span>
          )}
          
          {node.type === 'flow' && node.flow && !isEditing && (
            <span className={`flow-tree-badge ${node.flow.mode}`}>
              {node.flow.mode === 'cron' ? 'C' : 'T'}
            </span>
          )}
        </div>
        {node.type === 'folder' && isExpanded && hasChildren && (
          <div className="flow-tree-children">
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const tree = buildTree(flows);

  return (
    <div 
      className="flow-list"
      data-testid="flow-list"
      onContextMenu={(e) => handleContextMenu(e, null, '')}
    >
      <div className="flow-list-header">
        <h3>WORKFLOWS</h3>
        <button 
          className="btn-new-flow"
          data-testid="create-flow-btn"
          onClick={() => {
            setContextMenu({ visible: false, x: 0, y: 0, targetNode: null, targetPath: '' });
            createNewFlow();
          }}
          title="New Flow"
        >
          +
        </button>
      </div>
      <div 
        className={`flow-list-content ${dragState.isDragging && !dragState.dropTarget ? 'drop-root' : ''}`}
        data-testid="flow-list-content"
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
        {tree.length === 0 ? (
          <div className="flow-list-empty" data-testid="flow-list-empty">
            <p>No workflows yet</p>
            <p className="flow-list-hint">Right-click to create</p>
          </div>
        ) : (
          tree.map(node => renderNode(node, 0))
        )}
      </div>

      {contextMenu.visible && (
        <div 
          className="flow-context-menu"
          data-testid="flow-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="flow-context-menu-item" data-testid="ctx-new-folder" onClick={createNewFolder}>
            📁 New Folder
          </div>
          <div className="flow-context-menu-item" data-testid="ctx-new-flow" onClick={createNewFlow}>
            ⚡ New Flow
          </div>
          {contextMenu.targetNode && (
            <>
              <div className="flow-context-menu-divider" />
              <div 
                className="flow-context-menu-item"
                data-testid="ctx-rename"
                onClick={() => startRename(contextMenu.targetNode!)}
              >
                ✏️ Rename
              </div>
              <div 
                className="flow-context-menu-item danger"
                data-testid="ctx-delete"
                onClick={() => handleDelete(contextMenu.targetNode!)}
              >
                🗑️ Delete
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FlowList;
