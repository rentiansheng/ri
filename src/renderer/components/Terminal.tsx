import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useTerminalStore } from '../store/terminalStore';
import 'xterm/css/xterm.css';

// ============================================================
// 全局输出缓存
// ============================================================
interface OutputCacheEntry {
  data: string;
  timestamp: number;
}

const outputCache = new Map<string, OutputCacheEntry[]>();

export function getRecentOutput(terminalId: string, windowMs: number = 5000): string {
  const entries = outputCache.get(terminalId) || [];
  const now = Date.now();
  const recent = entries
    .filter(e => now - e.timestamp < windowMs)
    .map(e => e.data)
    .join('');
  return recent;
}

export function clearOutputCache(terminalId: string): void {
  outputCache.delete(terminalId);
}

// ============================================================
// 终端写入队列 - 批处理优化
// ============================================================
class TerminalWriteQueue {
  private queue: string[] = [];
  private isProcessing = false;
  private xterm: XTerm;
  
  constructor(xterm: XTerm) {
    this.xterm = xterm;
  }
  
  write(data: string) {
    this.queue.push(data);
    if (!this.isProcessing) {
      this.isProcessing = true;
      requestAnimationFrame(() => this.processQueue());
    }
  }
  
  private processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    const batch = this.queue.splice(0, this.queue.length);
    this.xterm.write(batch.join(''));
    
    if (this.queue.length > 0) {
      requestAnimationFrame(() => this.processQueue());
    } else {
      this.isProcessing = false;
    }
  }
  
  dispose() {
    this.queue = [];
    this.isProcessing = false;
  }
}

// ============================================================
// Terminal 组件接口
// ============================================================
interface TerminalProps {
  sessionId: string;
  terminalId: string;
  sessionName: string;
  isActive: boolean;
  isVisible: boolean;
}

// ============================================================
// Terminal 组件
// ============================================================
const Terminal: React.FC<TerminalProps> = ({ 
  sessionId, 
  terminalId, 
  sessionName, 
  isActive, 
  isVisible 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const writeQueueRef = useRef<TerminalWriteQueue | null>(null);
  
  const lastUpdateTimeRef = useRef<number>(0);
  const userInputBufferRef = useRef<string>('');
  const isNameSetByUserRef = useRef<boolean>(false);
  const hasOpenedRef = useRef<boolean>(false);
  const hasInitializedRef = useRef<boolean>(false);
  
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null);
  
  const updateLastActivityTime = useTerminalStore((state) => state.updateLastActivityTime);
  const setSessionNameFromFirstInput = useTerminalStore((state) => state.setSessionNameFromFirstInput);
  const sessions = useTerminalStore((state) => state.sessions);
  
  const [isReady, setIsReady] = useState(false);
  
  const UPDATE_THROTTLE = 100;
  
  useEffect(() => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      isNameSetByUserRef.current = session.isNameSetByUser;
    }
  }, [sessions, sessionId]);

  // ============================================================
  // 初始化 xterm
  // ============================================================
  useEffect(() => {
    if (!containerRef.current) return;
    
    if (hasInitializedRef.current) {
      return;
    }

    console.log(`[Terminal ${terminalId}] Initializing...`);
    hasInitializedRef.current = true;

    const xterm = new XTerm({
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
      },
      rows: 24,
      cols: 80,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(searchAddon);
    xterm.loadAddon(webLinksAddon);
    
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;
    writeQueueRef.current = new TerminalWriteQueue(xterm);

    // 标志已准备好
    setIsReady(true);

    // 处理用户输入
    xterm.onData((data) => {
      window.terminal.write({ id: terminalId, data });
      
      if (!isNameSetByUserRef.current) {
        userInputBufferRef.current += data;
        
        if (data.includes('\r') || data.includes('\n')) {
          const input = userInputBufferRef.current
            .replace(/\r/g, '')
            .replace(/\n/g, '')
            .replace(/\x7F/g, '')
            .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
            .trim();
          
          if (input) {
            setSessionNameFromFirstInput(sessionId, input);
            isNameSetByUserRef.current = true;
          }
          
          userInputBufferRef.current = '';
        }
      }
    });

    // 处理后端数据（使用队列）
    const unsubscribeData = window.terminal.onData((payload: { id: string; data: string }) => {
      if (payload.id === terminalId && writeQueueRef.current) {
        writeQueueRef.current.write(payload.data);
        
        const cache = outputCache.get(terminalId) || [];
        cache.push({ 
          data: payload.data, 
          timestamp: Date.now() 
        });
        
        const now = Date.now();
        const filtered = cache.filter(e => now - e.timestamp < 10000);
        outputCache.set(terminalId, filtered);
        
        if (now - lastUpdateTimeRef.current > UPDATE_THROTTLE) {
          updateLastActivityTime(sessionId);
          lastUpdateTimeRef.current = now;
        }
      }
    });

    const unsubscribeExit = window.terminal.onExit((payload: { id: string }) => {
      if (payload.id === terminalId) {
        xterm.write('\r\n[Process completed]\r\n');
      }
    });

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          const { cols, rows } = xtermRef.current;
          window.terminal.resize({ id: terminalId, cols, rows });
        } catch (e) {}
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      console.log(`[Terminal ${terminalId}] Cleaning up...`);
      window.removeEventListener('resize', handleResize);
      unsubscribeData();
      unsubscribeExit();
      if (writeQueueRef.current) writeQueueRef.current.dispose();
      xterm.dispose();
      clearOutputCache(terminalId);
      hasInitializedRef.current = false;
      hasOpenedRef.current = false;
      setIsReady(false);
    };
  }, [terminalId]);

  // ============================================================
  // 处理显示和焦点 (使用 useEffect 并在 isReady 后执行)
  // ============================================================
  useEffect(() => {
    if (!isReady || !isActive || !isVisible || !containerRef.current || !xtermRef.current) return;

    if (!hasOpenedRef.current) {
      console.log(`[Terminal ${terminalId}] Opening in DOM...`);
      try {
        xtermRef.current.open(containerRef.current);
        hasOpenedRef.current = true;
        
        // 尝试加载 WebGL
        try {
          const webglAddon = new WebglAddon();
          xtermRef.current.loadAddon(webglAddon);
        } catch (e) {}

        // 初始调整大小
        setTimeout(() => {
          if (fitAddonRef.current && xtermRef.current) {
            fitAddonRef.current.fit();
            const { cols, rows } = xtermRef.current;
            window.terminal.resize({ id: terminalId, cols, rows });
            xtermRef.current.focus();
          }
        }, 100);
      } catch (error) {
        console.error(`[Terminal ${terminalId}] Open failed:`, error);
      }
    } else {
      // 已经打开，只需聚焦
      setTimeout(() => {
        if (fitAddonRef.current && xtermRef.current) {
          fitAddonRef.current.fit();
          xtermRef.current.focus();
        }
      }, 50);
    }
  }, [isReady, isActive, isVisible, terminalId]);

  // 搜索功能
  const handleSearch = (term: string, forward: boolean = true) => {
    if (!searchAddonRef.current || !term) return;
    
    if (forward) {
      searchAddonRef.current.findNext(term, { incremental: false });
    } else {
      searchAddonRef.current.findPrevious(term, { incremental: false });
    }
  };

  // 右键菜单操作
  const handleCopy = () => {
    if (!xtermRef.current) return;
    const selection = xtermRef.current.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
    }
    setContextMenu(null);
  };

  const handlePaste = async () => {
    if (!xtermRef.current) return;
    try {
      const text = await navigator.clipboard.readText();
      window.terminal.write({ id: terminalId, data: text });
    } catch (err) {
      console.error('[Terminal] Paste failed:', err);
    }
    setContextMenu(null);
  };

  const handleClear = () => {
    if (!xtermRef.current) return;
    xtermRef.current.clear();
    setContextMenu(null);
  };

  const handleSelectAll = () => {
    if (!xtermRef.current) return;
    xtermRef.current.selectAll();
    setContextMenu(null);
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <>
      <div 
        ref={containerRef} 
        className="terminal-container"
        style={{ 
          display: isActive && isVisible ? 'block' : 'none',
          height: '100%',
          width: '100%',
        }}
        onClick={() => {
          if (isActive && isVisible && xtermRef.current) {
            xtermRef.current.focus();
          }
        }}
      />
      
      {/* 搜索框 */}
      {searchVisible && isActive && isVisible && (
        <div 
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: '#2d2d2d',
            padding: '8px',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 1000,
            display: 'flex',
            gap: '4px',
          }}
        >
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(searchTerm, !e.shiftKey);
              }
            }}
            placeholder="Search..."
            style={{
              background: '#1e1e1e',
              border: '1px solid #3e3e3e',
              color: '#d4d4d4',
              padding: '4px 8px',
              borderRadius: '3px',
              fontSize: '13px',
              outline: 'none',
            }}
            autoFocus
          />
          <button
            onClick={() => handleSearch(searchTerm, false)}
            style={{
              background: '#0e639c',
              border: 'none',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            ↑
          </button>
          <button
            onClick={() => handleSearch(searchTerm, true)}
            style={{
              background: '#0e639c',
              border: 'none',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            ↓
          </button>
          <button
            onClick={() => setSearchVisible(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#d4d4d4',
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}
      
      {/* 右键菜单 */}
      {contextMenu && isActive && isVisible && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: '#2d2d2d',
            border: '1px solid #3e3e3e',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 2000,
            minWidth: '150px',
            padding: '4px 0',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.hasSelection && (
            <div
              onClick={handleCopy}
              style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#d4d4d4' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#0e639c'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              Copy
            </div>
          )}
          <div
            onClick={handlePaste}
            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#d4d4d4' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#0e639c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            Paste
          </div>
          <div
            onClick={handleSelectAll}
            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#d4d4d4' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#0e639c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            Select All
          </div>
          <div style={{ height: '1px', background: '#3e3e3e', margin: '4px 0' }} />
          <div
            onClick={handleClear}
            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#d4d4d4' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#0e639c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            Clear Terminal
          </div>
        </div>
      )}
    </>
  );
};

export default Terminal;
