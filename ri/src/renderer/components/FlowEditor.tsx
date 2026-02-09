import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Flow } from '../types/global.d';
import { useTerminalStore } from '../store/terminalStore';
import './FlowEditor.css';

interface FlowEditorProps {
  flowId: string;
  onClose?: () => void;
}

const FlowEditor: React.FC<FlowEditorProps> = ({ flowId, onClose }) => {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [commands, setCommands] = useState<string[]>(['']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const { createSession } = useTerminalStore();

  useEffect(() => {
    loadFlow();
  }, [flowId]);

  const loadFlow = async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await window.config.get();
      const foundFlow = config.flows?.find(f => f.id === flowId);
      if (foundFlow) {
        setFlow(foundFlow);
        setCommands(foundFlow.commands.length > 0 ? foundFlow.commands : ['']);
      } else {
        setError('Flow not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flow');
    } finally {
      setLoading(false);
    }
  };

  const handleCommandChange = (index: number, value: string) => {
    const newCommands = [...commands];
    newCommands[index] = value;
    
    const isLastRow = index === commands.length - 1;
    const hasContent = value.trim() !== '';
    
    if (isLastRow && hasContent) {
      newCommands.push('');
    }
    
    setCommands(newCommands);
    setIsDirty(true);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newCommands = [...commands];
      newCommands.splice(index + 1, 0, '');
      setCommands(newCommands);
      setIsDirty(true);
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
    } else if (e.key === 'Backspace' && commands[index] === '' && commands.length > 1) {
      e.preventDefault();
      const newCommands = commands.filter((_, i) => i !== index);
      setCommands(newCommands);
      setIsDirty(true);
      setTimeout(() => inputRefs.current[Math.max(0, index - 1)]?.focus(), 0);
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowDown' && index < commands.length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleSave = useCallback(async () => {
    if (!flow) return;
    
    setSaveStatus('saving');
    setError(null);
    
    try {
      const config = await window.config.get();
      const filteredCommands = commands.filter(c => c.trim() !== '');
      const updatedFlows = (config.flows || []).map(f => 
        f.id === flowId ? { ...f, commands: filteredCommands } : f
      );
      
      await window.config.update({ flows: updatedFlows });
      
      const tabs = useTerminalStore.getState().tabs;
      const flowTab = tabs.find(t => t.type === 'flow' && t.flowId === flowId);
      if (flowTab) {
        useTerminalStore.setState(state => ({
          tabs: state.tabs.map(t => 
            t.id === flowTab.id ? { ...t, title: `⚡ ${flow.name}` } : t
          )
        }));
      }
      
      setSaveStatus('saved');
      setIsDirty(false);
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }, [flow, commands, flowId]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleRun = async () => {
    if (!flow) return;
    
    // Save first if dirty
    if (isDirty) {
      await handleSave();
    }
    
    const filteredCommands = commands.filter(c => c.trim() !== '');
    await createSession(flow.name, {
      cwd: flow.cwd,
      commands: filteredCommands,
    });
  };

  const addCommand = () => {
    setCommands([...commands, '']);
    setIsDirty(true);
    setTimeout(() => {
      inputRefs.current[commands.length]?.focus();
    }, 0);
  };

  const removeCommand = (index: number) => {
    if (commands.length <= 1) return;
    const newCommands = commands.filter((_, i) => i !== index);
    setCommands(newCommands);
    setIsDirty(true);
  };

  const moveCommand = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === commands.length - 1) return;
    
    const newCommands = [...commands];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newCommands[index], newCommands[targetIndex]] = [newCommands[targetIndex], newCommands[index]];
    setCommands(newCommands);
    setIsDirty(true);
  };

  if (loading) {
    return (
      <div className="flow-editor">
        <div className="flow-editor-loading">Loading...</div>
      </div>
    );
  }

  if (error && !flow) {
    return (
      <div className="flow-editor">
        <div className="flow-editor-error">{error}</div>
      </div>
    );
  }

  if (!flow) return null;

  return (
    <div className="flow-editor">
      <div className="flow-editor-header">
        <div className="flow-editor-title">
          <span className="flow-editor-icon">{flow.icon || '⚡'}</span>
          <span className="flow-editor-name">{flow.name}</span>
          <span className={`flow-editor-mode ${flow.mode}`}>{flow.mode.toUpperCase()}</span>
          {isDirty && <span className="flow-editor-dirty">*</span>}
        </div>
        <div className="flow-editor-actions">
          {saveStatus && (
            <span className={`save-status ${saveStatus}`}>
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'error' && 'Error!'}
            </span>
          )}
          <button 
            className="flow-editor-btn run" 
            onClick={handleRun}
            title="Run Flow"
          >
            ▶ Run
          </button>
          <button 
            className="flow-editor-btn primary" 
            onClick={handleSave}
            title="Save (Cmd+S)"
          >
            Save
          </button>
        </div>
      </div>
      
      {flow.description && (
        <div className="flow-editor-description">{flow.description}</div>
      )}
      
      {flow.cwd && (
        <div className="flow-editor-cwd">
          <span className="cwd-label">Working Directory:</span>
          <code>{flow.cwd}</code>
        </div>
      )}
      
      <div className="flow-editor-content">
        <div className="flow-editor-commands-header">
          <span>Commands</span>
          <button className="add-command-btn" onClick={addCommand} title="Add Command">
            +
          </button>
        </div>
        <div className="flow-editor-commands">
          {commands.map((cmd, index) => (
            <div key={index} className="command-row">
              <span className="command-number">{index + 1}</span>
              <input
                ref={el => inputRefs.current[index] = el}
                type="text"
                className="command-input"
                value={cmd}
                onChange={e => handleCommandChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                placeholder="Enter command..."
                spellCheck={false}
              />
              <div className="command-actions">
                <button 
                  className="command-action-btn"
                  onClick={() => moveCommand(index, 'up')}
                  disabled={index === 0}
                  title="Move Up"
                >
                  ↑
                </button>
                <button 
                  className="command-action-btn"
                  onClick={() => moveCommand(index, 'down')}
                  disabled={index === commands.length - 1}
                  title="Move Down"
                >
                  ↓
                </button>
                <button 
                  className="command-action-btn delete"
                  onClick={() => removeCommand(index)}
                  disabled={commands.length <= 1}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flow-editor-hint">
          Press <kbd>Enter</kbd> to add a new line, <kbd>Backspace</kbd> on empty line to remove
        </div>
      </div>
    </div>
  );
};

export default FlowEditor;
