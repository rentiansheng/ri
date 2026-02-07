import React, { useState, useEffect } from 'react';
import { Flow } from '../types/global.d';
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

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    const config = await window.config.get();
    setFlows(config.flows || []);
  };

  const buildTree = (flows: Flow[]): FlowTreeNode[] => {
    const root: FlowTreeNode[] = [];
    const folderMap = new Map<string, FlowTreeNode>();

    folderMap.set('', { id: 'root', label: 'Root', type: 'folder', path: '', children: [] });

    flows.forEach(flow => {
      const flowPath = flow.path || '';
      const parts = flowPath ? flowPath.split('/') : [];
      
      let currentPath = '';
      parts.forEach((part, index) => {
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
    }
  };

  const renderNode = (node: FlowTreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = node.type === 'flow' && node.id === selectedFlowId;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="flow-tree-node">
        <div
          className={`flow-tree-item ${isSelected ? 'selected' : ''} ${node.type}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleNodeClick(node)}
        >
          {node.type === 'folder' && (
            <span className={`flow-tree-arrow ${isExpanded ? 'expanded' : ''}`}>
              ▶
            </span>
          )}
          {node.type === 'flow' && <span className="flow-tree-spacer" />}
          <span className="flow-tree-icon">{node.icon}</span>
          <span className="flow-tree-label">{node.label}</span>
          {node.type === 'flow' && node.flow && (
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
    <div className="flow-list">
      <div className="flow-list-header">
        <h3>WORKFLOWS</h3>
        <button 
          className="btn-new-flow"
          onClick={() => onFolderSelect?.('')}
          title="View All Flows"
        >
          ⚙
        </button>
      </div>
      <div className="flow-list-content">
        {tree.length === 0 ? (
          <div className="flow-list-empty">
            <p>No workflows yet</p>
            <p className="flow-list-hint">Create one in the Flow view</p>
          </div>
        ) : (
          tree.map(node => renderNode(node, 0))
        )}
      </div>
    </div>
  );
};

export default FlowList;
