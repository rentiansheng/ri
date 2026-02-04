import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { useTerminalStore } from '../store/terminalStore';
import { useXTermStore } from '../store/xtermStore';
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
// Terminal 组件 - 从 xtermStore 获取实例
// ============================================================
const Terminal: React.FC<TerminalProps> = ({ 
  sessionId, 
  terminalId, 
  isActive, 
  isVisible 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLTextAreaElement | null>(null);
  const isComposingRef = useRef<boolean>(false);
  const dataUnsubscribeRef = useRef<(() => void) | null>(null);
  const exitUnsubscribeRef = useRef<(() => void) | null>(null);
  
  const lastUpdateTimeRef = useRef<number>(0);
  
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null);
  
  const updateLastActivityTime = useTerminalStore((state) => state.updateLastActivityTime);
  const renameSession = useTerminalStore((state) => state.renameSession);
  const xtermStore = useXTermStore();

  // 从 xtermStore 获取 xterm 实例
  const xtermInstance = xtermStore.getInstance(sessionId);
  const xterm = xtermInstance?.xterm;
  const fitAddon = xtermInstance?.fitAddon;
  const searchAddon = xtermInstance?.searchAddon;

  // 同步 textarea 位置到光标位置（候选框显示在光标下方）
  const syncInputPosition = () => {
    if (!xterm || !hiddenInputRef.current || !containerRef.current) return;
    
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
    if (!containerRef.current || !xterm) {
      console.log(`[Terminal ${sessionId}] setupHiddenInput: missing deps`, {
        hasContainer: !!containerRef.current,
        hasXterm: !!xterm
      });
      return;
    }

    console.log(`[Terminal ${sessionId}] Setting up hidden input`);

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

    console.log(`[Terminal ${sessionId}] Hidden input created and appended`);

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
      console.log(`[Terminal ${sessionId}] onKeyDown:`, e.key);
      
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
      console.log(`[Terminal ${sessionId}] onInput:`, input.value, 'composing:', isComposingRef.current);
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

    console.log(`[Terminal ${sessionId}] Event listeners attached to textarea`);

    return () => {
      console.log(`[Terminal ${sessionId}] Cleaning up textarea event listeners`);
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
      // Clear the ref so it can be recreated
      if (hiddenInputRef.current === input) {
        hiddenInputRef.current = null;
      }
    };
  };

  // 设置 PTY 数据监听
  useEffect(() => {
    if (!xterm) return;

    console.log(`[Terminal ${sessionId}] Setting up PTY data listener`);
    
    // 监听 PTY 输出
    const unsubscribeData = window.terminal.onData((payload: { id: string; data: string }) => {
      if (payload.id === terminalId && xterm) {
        // RIName 功能：检测 PTY 回显中的 RIName="xxx" 命令
        if (payload.data.includes('RIName=')) {
          const riNameMatch = payload.data.match(/RIName=["']([^"']+)["']/);
          if (riNameMatch) {
            const newName = riNameMatch[1].trim();
            if (newName) {
              renameSession(sessionId, newName);
            }
          }
        }
        
        // 直接写入 xterm
        xterm.write(payload.data);
        
        // 数据写入后，同步 textarea 位置
        requestAnimationFrame(() => syncInputPosition());
        
        // 缓存输出
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
      if (payload.id === terminalId && xterm) {
        xterm.write('\r\n[Process completed]\r\n');
      }
    });

    dataUnsubscribeRef.current = unsubscribeData;
    exitUnsubscribeRef.current = unsubscribeExit;

    return () => {
      console.log(`[Terminal ${sessionId}] Cleaning up PTY listeners`);
      unsubscribeData();
      unsubscribeExit();
    };
  }, [xterm, terminalId, sessionId]);

  // 打开 xterm 到 DOM (只在首次打开时运行，不响应 isVisible 变化)
  useEffect(() => {
    if (!xterm || !xtermInstance || !containerRef.current) return;
    
    // 如果已经打开过，不需要重新 open
    if (xtermInstance.isOpened) {
      console.log(`[Terminal ${sessionId}] Already opened, skipping open`);
      return;
    }

    console.log(`[Terminal ${sessionId}] Opening xterm to DOM`);

    try {
      xterm.open(containerRef.current);
      xtermStore.markAsOpened(sessionId);
      
      // 加载 WebGL 渲染器
      requestAnimationFrame(() => {
        if (!xterm) return;
        try {
          const webglAddon = new WebglAddon();
          webglAddon.onContextLoss(() => {
            webglAddon.dispose();
          });
          xterm.loadAddon(webglAddon);
        } catch (e) {
          console.warn(`[Terminal ${sessionId}] WebGL addon failed:`, e);
        }
      });

      // Fit 和聚焦
      setTimeout(() => {
        if (fitAddon && xterm) {
          fitAddon.fit();
          const { cols, rows } = xterm;
          window.terminal.resize({ id: terminalId, cols, rows });
        }
        syncInputPosition();
      }, 100);

      // 右键菜单处理
      const handleContextMenu = (e: Event) => {
        e.preventDefault();
        const mouseEvent = e as MouseEvent;
        const hasSelection = xterm.hasSelection();
        setContextMenu({
          x: mouseEvent.clientX,
          y: mouseEvent.clientY,
          hasSelection,
        });
      };

      // 添加到 xterm 元素上
      const xtermElement = containerRef.current.querySelector('.xterm');
      if (xtermElement) {
        xtermElement.addEventListener('contextmenu', handleContextMenu);
      }

      // 窗口 resize 处理
      const handleResize = () => {
        if (fitAddon && xterm) {
          try {
            fitAddon.fit();
            const { cols, rows } = xterm;
            window.terminal.resize({ id: terminalId, cols, rows });
          } catch (e) {
            console.error('[Terminal] Resize failed:', e);
          }
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        console.log(`[Terminal ${sessionId}] Cleaning up resize listener and contextmenu`);
        window.removeEventListener('resize', handleResize);
        const xtermElement = containerRef.current?.querySelector('.xterm');
        if (xtermElement) {
          xtermElement.removeEventListener('contextmenu', handleContextMenu);
        }
      };
    } catch (error) {
      console.error(`[Terminal ${sessionId}] Open failed:`, error);
    }
  }, [xterm, xtermInstance, containerRef.current, sessionId, terminalId]);

  // 设置输入 textarea (只在首次运行，之后保持存在)
  useEffect(() => {
    if (!xterm || !xtermInstance || !containerRef.current) return;
    if (!xtermInstance.isOpened) return;
    
    // 如果已经有 textarea，不重复创建
    if (hiddenInputRef.current) {
      console.log(`[Terminal ${sessionId}] Hidden input already exists`);
      return;
    }
    
    console.log(`[Terminal ${sessionId}] Setting up hidden input`);
    const cleanup = setupHiddenInput();
    
    // 只在组件真正卸载时清理（不在 isVisible 变化时清理）
    return () => {
      console.log(`[Terminal ${sessionId}] Cleaning up hidden input (component unmount)`);
      if (cleanup) cleanup();
    };
  }, [xterm, xtermInstance, containerRef.current, sessionId]);

  // 当 tab 变为 active 和 visible 时，调整大小和聚焦
  useEffect(() => {
    if (!isActive || !isVisible) return;
    if (!xterm || !fitAddon || !hiddenInputRef.current) return;
    
    console.log(`[Terminal ${sessionId}] Tab became active and visible, fitting and focusing`);
    
    // 延迟一下，确保 DOM 已经渲染完成
    const timer = setTimeout(() => {
      if (fitAddon && xterm) {
        try {
          fitAddon.fit();
          const { cols, rows } = xterm;
          window.terminal.resize({ id: terminalId, cols, rows });
        } catch (e) {
          console.error('[Terminal] Fit failed:', e);
        }
      }
      if (hiddenInputRef.current) {
        hiddenInputRef.current.focus({ preventScroll: true });
      }
      syncInputPosition();
    }, 50);
    
    return () => clearTimeout(timer);
  }, [isActive, isVisible, xterm, fitAddon, terminalId, sessionId]);

  // 点击容器时聚焦到隐藏输入框
  const handleContainerClick = () => {
    console.log(`[Terminal ${sessionId}] Container clicked`, {
      isActive,
      isVisible,
      hasHiddenInput: !!hiddenInputRef.current
    });
    if (isActive && isVisible && hiddenInputRef.current) {
      hiddenInputRef.current.focus({ preventScroll: true });
      console.log(`[Terminal ${sessionId}] Focused hidden input`);
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
    if (!searchAddon || !term) return;
    if (forward) searchAddon.findNext(term, { incremental: false });
    else searchAddon.findPrevious(term, { incremental: false });
  };

  const handleCopy = async () => {
    if (!xterm) return;
    const selection = xterm.getSelection();
    console.log('[Terminal] Copy triggered, selection:', selection);
    if (selection) {
      try {
        await navigator.clipboard.writeText(selection);
        console.log('[Terminal] Copy successful');
      } catch (err) {
        console.error('[Terminal] Copy failed:', err);
      }
    }
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
    if (xterm) xterm.clear();
    setContextMenu(null);
  };

  const handleSelectAll = () => {
    if (xterm) xterm.selectAll();
    setContextMenu(null);
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // 如果 xterm 实例不存在，不渲染
  if (!xterm) {
    return null;
  }

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
