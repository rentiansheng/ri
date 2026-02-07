import React, { useState, useEffect } from 'react';
import { useTerminalStore } from '../store/terminalStore';
import { Flow } from '../types/global.d';
import { nanoid } from 'nanoid';
import './FlowView.css';

interface FlowViewProps {
  initialPath?: string[];
}

const FlowView: React.FC<FlowViewProps> = ({ initialPath }) => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<Partial<Flow> | null>(null);
  const [logViewFlow, setLogViewFlow] = useState<Flow | null>(null);
  const [logs, setLogs] = useState<string>('');
  
  const { createSession } = useTerminalStore();

  const [currentPath, setCurrentPath] = useState<string[]>(initialPath || []);

  useEffect(() => {
    if (initialPath) {
      setCurrentPath(initialPath);
    }
  }, [initialPath]);

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    const config = await window.config.get();
    setFlows(config.flows || []);
  };

  const getFilteredFlows = () => {
    const pathStr = currentPath.join('/');
    return flows.filter(f => (f.path || '') === pathStr);
  };

  const getSubFolders = () => {
    const pathStr = currentPath.join('/');
    const folders = new Set<string>();
    flows.forEach(f => {
      const fPath = f.path || '';
      if (fPath.startsWith(pathStr) && fPath !== pathStr) {
        const relative = pathStr ? fPath.slice(pathStr.length + 1) : fPath;
        const firstPart = relative.split('/')[0];
        if (firstPart) folders.add(firstPart);
      }
    });
    return Array.from(folders);
  };

  const saveFlow = async (flowData: Partial<Flow>) => {
    const config = await window.config.get();
    let updatedFlows = [...(config.flows || [])];
    
    const flowToSave = {
      ...flowData,
      path: flowData.path || currentPath.join('/')
    };
    
    if (flowData.id) {
      updatedFlows = updatedFlows.map(f => f.id === flowData.id ? { ...f, ...flowToSave } as Flow : f);
    } else {
      const newFlow: Flow = {
        ...flowToSave,
        id: nanoid(),
        enabled: flowData.mode === 'cron' ? true : false,
        commands: flowData.commands || [],
      } as Flow;
      updatedFlows.push(newFlow);
    }
    
    await window.config.update({ flows: updatedFlows });
    setFlows(updatedFlows);
    setIsModalOpen(false);
    setEditingFlow(null);
  };

  const deleteFlow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this flow?')) return;
    const config = await window.config.get();
    const updatedFlows = (config.flows || []).filter(f => f.id !== id);
    await window.config.update({ flows: updatedFlows });
    setFlows(updatedFlows);
  };

  const runFlow = async (flow: Flow) => {
    if (flow.mode === 'template') {
      await createSession(flow.name, {
        cwd: flow.cwd,
        commands: flow.commands,
      });
    } else {
      await window.flow.runNow(flow);
    }
  };

  const openLogs = async (flow: Flow) => {
    const flowLogs = await window.flow.getLogs(flow.id);
    setLogs(flowLogs);
    setLogViewFlow(flow);
  };

  const openFile = async () => {
    try {
      const result = await window.file.openDialog({});
      if (result.success && result.filePaths && result.filePaths.length > 0) {
        useTerminalStore.getState().openFileTab(result.filePaths[0]);
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
    }
  };

  return (
    <div className="flow-view">
      <div className="flow-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3>Workflows 🛤️</h3>
          <div className="flow-breadcrumb">
            <span onClick={() => setCurrentPath([])}>Root</span>
            {currentPath.map((p, i) => (
              <React.Fragment key={i}>
                <span className="separator">/</span>
                <span onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}>{p}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="flow-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="add-flow-btn secondary" onClick={openFile} title="Open File">
            📄 Open File
          </button>
          <button className="add-flow-btn" onClick={() => { setEditingFlow({ mode: 'template', commands: [], path: currentPath.join('/') }); setIsModalOpen(true); }}>
            + New Flow
          </button>
        </div>
      </div>
      
      <div className="flow-content">
        <div className="flow-grid">
          {currentPath.length > 0 && (
            <div className="flow-card folder" onClick={() => setCurrentPath(currentPath.slice(0, -1))}>
              <div className="flow-card-header">
                <div className="flow-card-title">
                  <h4>..</h4>
                </div>
              </div>
              <div className="flow-card-info">
                Go back
              </div>
            </div>
          )}
          {getSubFolders().map(folder => (
            <div key={folder} className="flow-card folder" onClick={() => setCurrentPath([...currentPath, folder])}>
              <div className="flow-card-header">
                <div className="flow-card-title">
                  <h4>📁 {folder}</h4>
                </div>
              </div>
              <div className="flow-card-info">
                Folder
              </div>
            </div>
          ))}
          {getFilteredFlows().map(flow => (
            <div key={flow.id} className="flow-card">
              <div className="flow-card-header">
                <div className="flow-card-title">
                  {flow.icon && <span className="flow-icon">{flow.icon}</span>}
                  <h4>{flow.name}</h4>
                  <span className={`flow-mode-badge ${flow.mode}`}>{flow.mode.toUpperCase()}</span>
                </div>
                <div className="flow-card-actions">
                  <button className="action-btn run" title="Run Now" onClick={() => runFlow(flow)}>▶</button>
                  <button className="action-btn" title="View Logs" onClick={() => openLogs(flow)}>📋</button>
                  <button className="action-btn" title="Edit" onClick={() => { setEditingFlow(flow); setIsModalOpen(true); }}>✏️</button>
                  <button className="action-btn" title="Delete" onClick={() => deleteFlow(flow.id)}>🗑️</button>
                </div>
              </div>
              
              {flow.description && (
                <div className="flow-card-description">{flow.description}</div>
              )}
              
              <div className="flow-card-info">
                <div className="flow-status">
                  <span className={`status-dot ${flow.lastRunStatus || 'idle'}`}></span>
                  <span>{flow.lastRunStatus ? `Last: ${flow.lastRunStatus}` : 'Never run'}</span>
                </div>
                {flow.mode === 'cron' && <div>Cron: <code>{flow.cron}</code></div>}
                {flow.commands.length > 0 && (
                  <div className="flow-commands-preview">
                    {flow.commands.filter(c => c.trim()).slice(0, 3).map((cmd, i) => (
                      <code key={i}>{cmd}</code>
                    ))}
                    {flow.commands.filter(c => c.trim()).length > 3 && (
                      <span className="flow-commands-more">+{flow.commands.filter(c => c.trim()).length - 3} more</span>
                    )}
                  </div>
                )}
                {flow.lastRunTime && <div>Last Run: {new Date(flow.lastRunTime).toLocaleString()}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h4>{editingFlow?.id ? 'Edit Flow' : 'Create New Flow'}</h4>
              <button className="action-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Name</label>
                <input 
                  type="text" 
                  value={editingFlow?.name || ''} 
                  onChange={e => setEditingFlow({ ...editingFlow, name: e.target.value })}
                  placeholder="e.g. Daily Cleanup"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input 
                  type="text" 
                  value={editingFlow?.description || ''} 
                  onChange={e => setEditingFlow({ ...editingFlow, description: e.target.value })}
                  placeholder="Brief description of this flow"
                />
              </div>
              <div className="form-group">
                <label>Icon (emoji)</label>
                <input 
                  type="text" 
                  value={editingFlow?.icon || ''} 
                  onChange={e => setEditingFlow({ ...editingFlow, icon: e.target.value })}
                  placeholder="🚀"
                  style={{ width: '60px' }}
                />
              </div>
              <div className="form-group">
                <label>Mode</label>
                <select 
                  value={editingFlow?.mode || 'template'} 
                  onChange={e => setEditingFlow({ ...editingFlow, mode: e.target.value as any })}
                >
                  <option value="template">Template (Interactive)</option>
                  <option value="cron">Cron (Automated)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Path (Folder/Subfolder)</label>
                <input 
                  type="text" 
                  value={editingFlow?.path || ''} 
                  onChange={e => setEditingFlow({ ...editingFlow, path: e.target.value })}
                  placeholder="category/subcategory"
                />
              </div>
              {editingFlow?.mode === 'cron' && (
                <div className="form-group">
                  <label>Cron Expression (Minute-level)</label>
                  <input 
                    type="text" 
                    value={editingFlow?.cron || ''} 
                    onChange={e => setEditingFlow({ ...editingFlow, cron: e.target.value })}
                    placeholder="*/5 * * * *"
                  />
                </div>
              )}
              <div className="form-group">
                <label>Working Directory</label>
                <input 
                  type="text" 
                  value={editingFlow?.cwd || ''} 
                  onChange={e => setEditingFlow({ ...editingFlow, cwd: e.target.value })}
                  placeholder="/absolute/path/to/project"
                />
              </div>
              <div className="form-group">
                <label>Commands (one per line)</label>
                <textarea 
                  rows={5}
                  value={editingFlow?.commands?.join('\n') || ''} 
                  onChange={e => setEditingFlow({ ...editingFlow, commands: e.target.value.split('\n') })}
                  placeholder="npm install&#10;npm run build"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => saveFlow(editingFlow!)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Log Viewer Modal */}
      {logViewFlow && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '800px' }}>
            <div className="modal-header">
              <h4>Logs: {logViewFlow.name}</h4>
              <button className="action-btn" onClick={() => setLogViewFlow(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="log-viewer">
                {logs || 'No logs found for this flow.'}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { window.flow.clearLogs(logViewFlow.id); setLogs(''); }}>Clear Logs</button>
              <button className="btn-primary" onClick={() => setLogViewFlow(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowView;
