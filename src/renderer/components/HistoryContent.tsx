import React, { useState, useEffect } from 'react';
import { SessionLogRecord } from '../types/global';
import './HistoryContent.css';

interface HistoryContentProps {
  sessionId: string;
  sessionName: string;
}

interface CommandGroup {
  timestamp: number;
  command: string;
  output: string[];
}

export const HistoryContent: React.FC<HistoryContentProps> = ({
  sessionId,
  sessionName,
}) => {
  const [logRecords, setLogRecords] = useState<SessionLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  // Load log records when sessionId changes
  useEffect(() => {
    const loadRecords = async () => {
      setIsLoading(true);
      try {
        const records = await window.sessionLog.read({ sessionId, limit: 500 });
        setLogRecords(records);
      } catch (error) {
        console.error('Failed to load session logs:', error);
        setLogRecords([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecords();
  }, [sessionId]);

  // Group records by command
  const groupByCommand = (records: SessionLogRecord[]): CommandGroup[] => {
    const groups: CommandGroup[] = [];
    let currentGroup: CommandGroup | null = null;
    
    records.forEach((record) => {
      if (record.type === 'command') {
        // Save previous group
        if (currentGroup) {
          groups.push(currentGroup);
        }
        
        // Create new group
        currentGroup = {
          timestamp: record.timestamp,
          command: record.cleaned,
          output: [],
        };
      } else if (record.type === 'output' && currentGroup) {
        // Add output to current group
        currentGroup.output.push(record.cleaned);
      }
    });
    
    // Add last group
    if (currentGroup) {
      groups.push(currentGroup);
    }
    
    return groups;
  };

  const groupedRecords = groupByCommand(logRecords);

  const toggleExpand = (index: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="history-content">
        <div className="history-content-loading">
          <div className="loading-spinner"></div>
          <p>Loading history...</p>
        </div>
      </div>
    );
  }

  if (groupedRecords.length === 0) {
    return (
      <div className="history-content">
        <div className="history-content-empty">
          <p>No command history</p>
          <p className="history-empty-hint">Commands will be logged here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-content">
      <div className="history-content-header">
        <div className="history-content-title">
          <span className="history-title-prefix">[h]:</span>
          <span className="history-title-name">{sessionName}</span>
        </div>
        <div className="history-content-stats">
          <span>{groupedRecords.length} commands</span>
          <span>•</span>
          <span>{logRecords.length} records</span>
        </div>
      </div>
      
      <div className="history-content-body">
        {groupedRecords.map((group, index) => {
          const outputText = group.output.join('\n');
          const isLongOutput = outputText.length > 1000;
          const isExpanded = expandedGroups.has(index);
          
          return (
            <div key={index} className="history-entry">
              <div className="history-entry-header">
                <span className="history-command-icon">$</span>
                <span className="history-command-text">{group.command}</span>
                <span className="history-entry-time">
                  {formatTime(group.timestamp)}
                </span>
              </div>
              
              {group.output.length > 0 && (
                <div className={`history-output ${isLongOutput && !isExpanded ? 'collapsed' : ''}`}>
                  <pre>{outputText}</pre>
                  {isLongOutput && (
                    <button 
                      className="history-expand-btn"
                      onClick={() => toggleExpand(index)}
                    >
                      {isExpanded ? 'Collapse' : 'Show full output'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
