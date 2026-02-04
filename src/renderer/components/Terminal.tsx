import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
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

// 后台定时清理所有终端的过期缓存（每 2 秒）
setInterval(() => {
  const now = Date.now();
  for (const [terminalId, entries] of outputCache.entries()) {
    const filtered = entries.filter(e => now - e.timestamp < 10000);
    if (filtered.length < entries.length) {
      outputCache.set(terminalId, filtered);
    }
  }
}, 2000);

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
// Terminal 组件 - 使用隐藏 textarea 接管输入
// ============================================================
const Terminal: React.FC<TerminalProps> = ({ 
  sessionId, 
  terminalId, 
  isActive, 
  isVisible 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const hiddenInputRef = useRef<HTMLTextAreaElement | null>(null);
  const isComposingRef = useRef<boolean>(false);
  
  const lastUpdateTimeRef = useRef<number>(0);
  const hasInitializedRef = useRef<boolean>(false);
  const hasOpenedRef = useRef<boolean>(false);
  
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null);
  
  const updateLastActivityTime = useTerminalStore((state) => state.updateLastActivityTime);
  const renameSession = useTerminalStore((state) => state.renameSession);
  
  const [isReady, setIsReady] = useState(false);

  // 同步 textarea 位置到光标位置（候选框显示在光标下方）
  const syncInputPosition = () => {
    if (!xtermRef.current || !hiddenInputRef.current || !containerRef.current) return;
    
    const xterm = xtermRef.current;
    const buffer = xterm.buffer.active;
    const cursorX = buffer.cursorX;
    const cursorY = buffer.cursorY;
    
    // 尝试多种方式获取 cell dimensions
    const core = (xterm as any)._core;
    
    let cellWidth = 0;
    let cellHeight = 0;
    
    // 方法1：从 _renderService.dimensions 获取
    if (core?._renderService?.dimensions) {
      const dims = core._renderService.dimensions;
      cellWidth = dims.actualCellWidth || dims.css?.cell?.width || 0;
      cellHeight = dims.actualCellHeight || dims.css?.cell?.height || 0;
    }
    
    // 方法2：从 _renderService._renderer 获取
    if (!cellWidth && core?._renderService?._renderer?.dimensions) {
      const dims = core._renderService._renderer.dimensions;
      cellWidth = dims.actualCellWidth || dims.css?.cell?.width || 0;
      cellHeight = dims.actualCellHeight || dims.css?.cell?.height || 0;
    }
    
    // 方法3：从 cols/rows 和容器大小计算
    if (!cellWidth) {
      const terminalElement = containerRef.current.querySelector('.xterm-screen');
      if (terminalElement) {
        const rect = terminalElement.getBoundingClientRect();
        cellWidth = rect.width / xterm.cols;
        cellHeight = rect.height / xterm.rows;
      }
    }
    
    if (!cellWidth || !cellHeight) return;
    
    // 获取终端元素的位置（考虑滚动和偏移）
    const terminalElement = containerRef.current.querySelector('.xterm');
    if (!terminalElement) return;
    
    const terminalRect = terminalElement.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // 计算光标的像素位置（相对于容器）
    const left = terminalRect.left - containerRect.left + cursorX * cellWidth;
    // 重要：top 设置为下一行的位置，这样输入法候选框会显示在光标下方
    const top = terminalRect.top - containerRect.top + (cursorY + 1) * cellHeight;
    
    hiddenInputRef.current.style.left = `${left}px`;
    hiddenInputRef.current.style.top = `${top}px`;
  };

  // 发送数据到 PTY
  const sendToPty = (data: string) => {
    try {
      window.terminal.write({ id: terminalId, data });
    } catch (e) {
      console.error(`[Terminal ${terminalId}] Write to PTY failed:`, e);
    }
  };

  // 创建隐藏的 textarea 接管所有输入
  const setupHiddenInput = () => {
    if (!containerRef.current || !xtermRef.current) return;

    const input = document.createElement('textarea');
    input.style.position = 'absolute';
    input.style.opacity = '0';
    input.style.width = '20px';
    input.style.height = '20px';
    input.style.left = '0px';
    input.style.top = '0px';
    input.style.pointerEvents = 'none';
    input.style.zIndex = '1000';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    
    containerRef.current.appendChild(input);
    hiddenInputRef.current = input;

    // 在 composition 开始时同步位置
    const onCompositionStart = () => {
      isComposingRef.current = true;
      syncInputPosition();
    };
    
    // 在 composition 更新时也同步位置（输入过程中）
    const onCompositionUpdate = () => {
      syncInputPosition();
    };

    // 键盘事件处理（特殊键）
    const onKeyDown = (e: KeyboardEvent) => {
      // 在每次按键前同步位置，确保输入法候选框在正确位置
      if (!isComposingRef.current) {
        // 延迟一点让光标先移动
        requestAnimationFrame(() => syncInputPosition());
      }
      
      const key = e.key;
      
      // Enter
      if (key === 'Enter') {
        e.preventDefault();
        sendToPty('\r');
        return;
      }
      
      // Backspace
      if (key === 'Backspace') {
        e.preventDefault();
        sendToPty('\x7f');
        return;
      }
      
      // Tab
      if (key === 'Tab') {
        e.preventDefault();
        sendToPty('\t');
        return;
      }
      
      // Escape
      if (key === 'Escape') {
        e.preventDefault();
        sendToPty('\x1b');
        return;
      }
      
      // 箭头键
      if (key === 'ArrowUp') {
        e.preventDefault();
        sendToPty('\x1b[A');
        return;
      }
      if (key === 'ArrowDown') {
        e.preventDefault();
        sendToPty('\x1b[B');
        return;
      }
      if (key === 'ArrowRight') {
        e.preventDefault();
        sendToPty('\x1b[C');
        return;
      }
      if (key === 'ArrowLeft') {
        e.preventDefault();
        sendToPty('\x1b[D');
        return;
      }
      
      // Home/End
      if (key === 'Home') {
        e.preventDefault();
        sendToPty('\x1b[H');
        return;
      }
      if (key === 'End') {
        e.preventDefault();
        sendToPty('\x1b[F');
        return;
      }
      
      // Page Up/Down
      if (key === 'PageUp') {
        e.preventDefault();
        sendToPty('\x1b[5~');
        return;
      }
      if (key === 'PageDown') {
        e.preventDefault();
        sendToPty('\x1b[6~');
        return;
      }
      
      // Delete
      if (key === 'Delete') {
        e.preventDefault();
        sendToPty('\x1b[3~');
        return;
      }
      
      // Insert
      if (key === 'Insert') {
        e.preventDefault();
        sendToPty('\x1b[2~');
        return;
      }
      
      // Ctrl 组合键
      if (e.ctrlKey && !e.altKey && !e.metaKey) {
        // Ctrl+C
        if (key === 'c' || key === 'C') {
          e.preventDefault();
          sendToPty('\x03');
          return;
        }
        // Ctrl+D
        if (key === 'd' || key === 'D') {
          e.preventDefault();
          sendToPty('\x04');
          return;
        }
        // Ctrl+Z
        if (key === 'z' || key === 'Z') {
          e.preventDefault();
          sendToPty('\x1a');
          return;
        }
        // Ctrl+A-Z (通用处理)
        if (key.length === 1) {
          const char = key.toLowerCase();
          if (char >= 'a' && char <= 'z') {
            e.preventDefault();
            const code = char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
            sendToPty(String.fromCharCode(code));
            return;
          }
        }
      }
      
      // Alt 组合键
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (key.length === 1) {
          e.preventDefault();
          sendToPty('\x1b' + key);
          return;
        }
      }
      
      // 对于普通字符，不阻止默认行为，让 input 事件处理
    };

    // Composition 事件（中文输入）
    const onCompositionEnd = (e: CompositionEvent) => {
      isComposingRef.current = false;
      const data = e.data || input.value;
      if (data) {
        sendToPty(data);
      }
      input.value = '';
    };

    // Input 事件（普通字符输入）
    const onInput = () => {
      if (!isComposingRef.current && input.value) {
        sendToPty(input.value);
        input.value = '';
      }
    };

    const onBlur = () => {
      if (isComposingRef.current) {
        isComposingRef.current = false;
        input.value = '';
      }
    };

    // 粘贴处理
    const onPaste = async (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          sendToPty(text);
        }
      } catch (err) {
        console.error('[Terminal] Paste failed:', err);
      }
    };

    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('compositionstart', onCompositionStart);
    input.addEventListener('compositionupdate', onCompositionUpdate);
    input.addEventListener('compositionend', onCompositionEnd);
    input.addEventListener('input', onInput);
    input.addEventListener('blur', onBlur);
    input.addEventListener('paste', onPaste);

    return () => {
      input.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('compositionstart', onCompositionStart);
      input.removeEventListener('compositionupdate', onCompositionUpdate);
      input.removeEventListener('compositionend', onCompositionEnd);
      input.removeEventListener('input', onInput);
      input.removeEventListener('blur', onBlur);
      input.removeEventListener('paste', onPaste);
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };
  };

  // 初始化终端
  useEffect(() => {
    console.log(`[Terminal ${terminalId}] useEffect for initialization`);
    if (!containerRef.current || hasInitializedRef.current) return;

    console.log(`[Terminal ${terminalId}] Initializing...`);
    hasInitializedRef.current = true;

    // 创建 xterm 实例，禁用其输入系统
    const xterm = new XTerm({
      fontFamily: 'Menlo, Monaco, "Courier New", "PingFang SC", "Microsoft YaHei", monospace',
      fontSize: 14,
      cursorBlink: false,
      cursorStyle: 'block',
      scrollback: 10000,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        cursorAccent: '#1e1e1e',
        selectionBackground: 'rgba(38, 79, 120, 0.4)',
      },
      rows: 24,
      cols: 80,
      allowProposedApi: true,
      disableStdin: true,  // 关键！禁用 xterm.js 的输入系统
      convertEol: false,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicode11Addon = new Unicode11Addon();
    
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(searchAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.loadAddon(unicode11Addon);
    xterm.unicode.activeVersion = '11';
    
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    setIsReady(true);

    // 监听 PTY 输出 -> 直接写入 xterm 渲染
    const unsubscribeData = window.terminal.onData((payload: { id: string; data: string }) => {
      if (payload.id === terminalId && xtermRef.current) {
        // RIName 功能：检测 PTY 回显中的 RIName="xxx" 命令
        if (payload.data.includes('RIName=')) {
          const riNameMatch = payload.data.match(/RIName=["']([^"']+)["']/);
          if (riNameMatch) {
            const newName = riNameMatch[1].trim();
            if (newName) {
              renameSession(sessionId, newName);
              console.log(`[Terminal] Auto-renamed session to: "${newName}"`);
            }
          }
        }
        
        // 直接写入 xterm，没有本地回显，所有回显来自 PTY
        xtermRef.current.write(payload.data);
        
        // 数据写入后，同步 textarea 位置（光标可能已移动）
        requestAnimationFrame(() => syncInputPosition());
        
        // 缓存输出（用于通知检测等）
        const cache = outputCache.get(terminalId) || [];
        cache.push({ data: payload.data, timestamp: Date.now() });
        outputCache.set(terminalId, cache);
        
        // 更新活跃时间
        const now = Date.now();
        if (now - lastUpdateTimeRef.current > 5000) {
          updateLastActivityTime(sessionId);
          lastUpdateTimeRef.current = now;
        }
      }
    });

    const unsubscribeExit = window.terminal.onExit((payload: { id: string }) => {
      if (payload.id === terminalId && xtermRef.current) {
        xtermRef.current.write('\r\n[Process completed]\r\n');
      }
    });

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          const { cols, rows } = xtermRef.current;
          window.terminal.resize({ id: terminalId, cols, rows });
        } catch (e) {
          console.error('[Terminal] Resize failed:', e);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribeData();
      unsubscribeExit();
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
      clearOutputCache(terminalId);
      hasInitializedRef.current = false;
      hasOpenedRef.current = false;
      setIsReady(false);
    };
  }, [terminalId, sessionId]);

  // Open terminal and setup hidden input
  useEffect(() => {
    console.log(`[Terminal ${terminalId}] useEffect for open/focus`);
    if (!isReady || !isActive || !isVisible || !containerRef.current || !xtermRef.current) return;

    if (!hasOpenedRef.current) {
      try {
        xtermRef.current.open(containerRef.current);
        hasOpenedRef.current = true;
        
        // 设置隐藏 textarea 接管输入
        const cleanup = setupHiddenInput();
        
        // WebGL 渲染器
        requestAnimationFrame(() => {
          if (!xtermRef.current) return;
          try {
            const webglAddon = new WebglAddon();
            webglAddon.onContextLoss(() => {
              console.warn('[Terminal] WebGL context lost');
              webglAddon.dispose();
            });
            xtermRef.current.loadAddon(webglAddon);
            console.log(`[Terminal ${terminalId}] WebGL renderer loaded`);
          } catch (e) {
            console.warn(`[Terminal ${terminalId}] WebGL addon failed:`, e);
          }
        });

        setTimeout(() => {
          if (fitAddonRef.current && xtermRef.current) {
            fitAddonRef.current.fit();
            const { cols, rows } = xtermRef.current;
            window.terminal.resize({ id: terminalId, cols, rows });
            
            // 聚焦到隐藏输入框
            if (hiddenInputRef.current) {
              hiddenInputRef.current.focus({ preventScroll: true });
            }
            
            // 初始化时同步一次位置
            setTimeout(() => syncInputPosition(), 100);
          }
        }, 100);

        return cleanup;
      } catch (error) {
        console.error(`[Terminal ${terminalId}] Open failed:`, error);
      }
    } else {
      // 重新聚焦
      setTimeout(() => {
        if (fitAddonRef.current && xtermRef.current) {
          fitAddonRef.current.fit();
          const { cols, rows } = xtermRef.current;
          window.terminal.resize({ id: terminalId, cols, rows });
          
          // 聚焦到隐藏输入框
          if (hiddenInputRef.current) {
            hiddenInputRef.current.focus({ preventScroll: true });
          }
          
          // 重新激活时也同步位置
          setTimeout(() => syncInputPosition(), 50);
        }
      }, 50);
    }
  }, [isReady, isActive, isVisible, terminalId]);

  // 点击容器时聚焦到隐藏输入框
  const handleContainerClick = () => {
    if (isActive && isVisible && hiddenInputRef.current) {
      hiddenInputRef.current.focus({ preventScroll: true });
    }
  };
  
  // 定期检查并确保 textarea 保持焦点（当终端激活时）
  useEffect(() => {
    if (!isActive || !isVisible) return;
    
    const ensureFocus = () => {
      if (hiddenInputRef.current && document.activeElement !== hiddenInputRef.current) {
        hiddenInputRef.current.focus({ preventScroll: true });
      }
    };
    
    // 定期检查焦点（每 500ms）
    const intervalId = setInterval(ensureFocus, 500);
    
    // 监听 focusout 事件，立即重新聚焦
    const handleFocusOut = (e: FocusEvent) => {
      // 如果焦点离开了隐藏输入框，且不是因为窗口失去焦点
      if (e.target === hiddenInputRef.current && document.hasFocus()) {
        setTimeout(() => {
          if (hiddenInputRef.current) {
            hiddenInputRef.current.focus({ preventScroll: true });
          }
        }, 10);
      }
    };
    
    if (hiddenInputRef.current) {
      hiddenInputRef.current.addEventListener('focusout', handleFocusOut as any);
    }
    
    return () => {
      clearInterval(intervalId);
      if (hiddenInputRef.current) {
        hiddenInputRef.current.removeEventListener('focusout', handleFocusOut as any);
      }
    };
  }, [isActive, isVisible]);

  const handleSearch = (term: string, forward: boolean = true) => {
    if (!searchAddonRef.current || !term) return;
    if (forward) searchAddonRef.current.findNext(term, { incremental: false });
    else searchAddonRef.current.findPrevious(term, { incremental: false });
  };

  const handleCopy = () => {
    if (!xtermRef.current) return;
    const selection = xtermRef.current.getSelection();
    if (selection) navigator.clipboard.writeText(selection);
    setContextMenu(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        sendToPty(text);
      }
    } catch (err) {
      console.error('[Terminal] Paste failed:', err);
    }
    setContextMenu(null);
  };

  const handleClear = () => {
    if (xtermRef.current) xtermRef.current.clear();
    setContextMenu(null);
  };

  const handleSelectAll = () => {
    if (xtermRef.current) xtermRef.current.selectAll();
    setContextMenu(null);
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  return (
    <>
      <div 
        ref={containerRef} 
        className="terminal-container"
        data-session-id={sessionId}
        data-terminal-id={terminalId}
        data-is-visible={isVisible}
        data-is-active={isActive}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          height: '100%',
          width: '100%',
          contain: 'strict',
          visibility: isVisible ? 'visible' : 'hidden',
          pointerEvents: isVisible ? 'auto' : 'none',
          zIndex: isVisible && isActive ? 2 : isVisible ? 1 : 0,
        }}
        onClick={handleContainerClick}
      />
      
      {searchVisible && isActive && isVisible && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#2d2d2d', padding: '8px', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', gap: '4px' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(searchTerm, !e.shiftKey); }}
            placeholder="Search..."
            style={{ background: '#1e1e1e', border: '1px solid #3e3e3e', color: '#d4d4d4', padding: '4px 8px', borderRadius: '3px', fontSize: '13px', outline: 'none' }}
            autoFocus
          />
          <button onClick={() => handleSearch(searchTerm, false)} style={{ background: '#0e639c', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '3px', cursor: 'pointer' }}>↑</button>
          <button onClick={() => handleSearch(searchTerm, true)} style={{ background: '#0e639c', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '3px', cursor: 'pointer' }}>↓</button>
          <button onClick={() => setSearchVisible(false)} style={{ background: 'transparent', border: 'none', color: '#d4d4d4', padding: '4px 8px', cursor: 'pointer' }}>✕</button>
        </div>
      )}
      
      {contextMenu && isActive && isVisible && (
        <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: '#2d2d2d', border: '1px solid #3e3e3e', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', zIndex: 2000, minWidth: '150px', padding: '4px 0' }} onClick={(e) => e.stopPropagation()}>
          {contextMenu.hasSelection && (
            <div onClick={handleCopy} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#d4d4d4' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#0e639c'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>Copy</div>
          )}
          <div onClick={handlePaste} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#d4d4d4' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#0e639c'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>Paste</div>
          <div onClick={handleSelectAll} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#d4d4d4' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#0e639c'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>Select All</div>
          <div style={{ height: '1px', background: '#3e3e3e', margin: '4px 0' }} />
          <div onClick={handleClear} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#d4d4d4' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#0e639c'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>Clear Terminal</div>
        </div>
      )}
    </>
  );
};

export default React.memo(Terminal);
