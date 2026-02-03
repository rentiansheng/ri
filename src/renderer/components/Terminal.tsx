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

// Tier 4: 后台定时清理所有终端的过期缓存（每 2 秒），将 filter 从热路径移除
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
    const t1 = performance.now();
    // Tier 4 优化：中文字符优先快速路径
    const isSmallData = data.length < 1024;
    const hasInteractiveKey = /[\r\n\t\x08\x7f ]/.test(data);
    const hasCJK = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(data);

    // 阶段 1.1 优化：CJK 字符使用完全同步的写入+刷新，消除回调异步延迟
    if (hasCJK && this.xterm && (this.xterm as any)._core) {
      try {
        // 同步写入（不使用回调）
        this.xterm.write(data);
        // 立即强制刷新，不等待异步回调
        this.xterm.refresh(0, this.xterm.rows - 1);
        
        const t2 = performance.now();
        console.log(`[WriteQueue] CJK sync fast path: ${(t2-t1).toFixed(2)}ms, data: "${data.substring(0, 20)}"`);
      } catch (e) {
        console.error('[WriteQueue] CJK sync write failed:', e);
      }
      return;
    }

    // 小数据、交互键走直接写入（保持原逻辑）
    if ((isSmallData || hasInteractiveKey) && this.xterm && (this.xterm as any)._core) {
      try {
        this.xterm.write(data);
        const t2 = performance.now();
        if (t2 - t1 > 5) {
          console.log(`[WriteQueue] Fast path took ${(t2-t1).toFixed(2)}ms`);
        }
      } catch (e) {
        console.error('Direct xterm write failed:', e);
      }
      return;
    }

    // 大量数据（如 cat 大文件）进入队列，防止阻塞主线程
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

    try {
      // Tier 4: 移除节流逻辑，因为需要快速响应的数据已在 write() 中直接处理
      const batchSize = 1000;
      
      const batch = this.queue.splice(0, batchSize); 
      const dataToFlush = batch.join('');
      
      if (this.xterm && (this.xterm as any)._core) {
        this.xterm.write(dataToFlush);
      } else {
        console.warn('Xterm instance is disposed or invalid, dropping data');
      }
    } catch (e) {
      console.error('Queued xterm write failed:', e);
    }
    
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
  isActive, 
  isVisible 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const writeQueueRef = useRef<TerminalWriteQueue | null>(null);
  const compositionRef = useRef<boolean>(false); 
  
  // 阶段 2.1: 本地回显缓存，用于去重服务端回显
  const localEchoCacheRef = useRef<Map<string, number> | null>(null);
  
  const lastUpdateTimeRef = useRef<number>(0);
  const userInputBufferRef = useRef<string>('');
  const hasOpenedRef = useRef<boolean>(false);
  const hasInitializedRef = useRef<boolean>(false);
  
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null);
  
  // 精准订阅
  const updateLastActivityTime = useTerminalStore((state) => state.updateLastActivityTime);
  const setSessionNameFromFirstInput = useTerminalStore((state) => state.setSessionNameFromFirstInput);
  const renameSession = useTerminalStore((state) => state.renameSession);
  const isNameSetByUser = useTerminalStore((state) => 
    state.sessions.find(s => s.id === sessionId)?.isNameSetByUser ?? false
  );
  
  const [isReady, setIsReady] = useState(false);

  // 确保 IME 状态在可见性切换时重置，防止输入锁定
  useEffect(() => {
    if (isVisible) {
      compositionRef.current = false;
    }
  }, [isVisible]);

  useEffect(() => {
    console.log(`[Terminal ${terminalId}] useEffect for initialization. sessionId: ${sessionId}, isVisible: ${isVisible}, isActive: ${isActive}`);
    if (!containerRef.current || hasInitializedRef.current) return;

    console.log(`[Terminal ${terminalId}] Initializing...`);
    hasInitializedRef.current = true;

    const xterm = new XTerm({
      fontFamily: 'Menlo, Monaco, "Courier New", "PingFang SC", "Microsoft YaHei", monospace',
      fontSize: 14,
      cursorBlink: false, // 中文输入时禁用闪烁可减少重绘压力
      cursorStyle: 'block',
      scrollback: 10000,
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 5,
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
      screenReaderMode: false,
      customGlyphs: true,
      minimumContrastRatio: 1, // Tier 3: 禁用对比度计算，提升渲染性能
      drawBoldTextInBrightColors: false, // Tier 4.5: 禁用粗体颜色计算
      windowOptions: {
        // Tier 4.5: IME 优化 - 显著改善中文输入性能
        setWinLines: false,
        setWinSizePixels: false,
        getWinSizePixels: false,
        getCellSizePixels: false,
        getIconTitle: false,
        getWinTitle: false,
        pushTitle: false,
        popTitle: false,
        setWinPosition: false,
        getScreenSizePixels: false,
        getScreenSizeChars: false,
      },
      smoothScrollDuration: 0, // Tier 4.5: 禁用平滑滚动，减少渲染延迟
      disableStdin: false,
      convertEol: false, // Tier 4.5: 禁用换行符转换，减少处理开销
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
    writeQueueRef.current = new TerminalWriteQueue(xterm);

    setIsReady(true);

    xterm.onData((data) => {
      // Tier 4 修复：移除 compositionRef 检查，让 xterm.js 自行处理 IME
      // xterm.js 内部已经正确管理了 IME 事件，外部阻塞会导致延迟
      const t1 = performance.now();
      
      // RIName 功能：检测 RIName="xxx" 命令并自动重命名 session
      // Debug: 记录包含 RIName 的输入
      if (data.includes('RIName')) {
        console.log(`[Terminal] RIName input detected: ${JSON.stringify(data)}`);
      }
      
      const riNameMatch = data.match(/^RIName=["'](.+?)["']\r?$/);
      if (riNameMatch) {
        const newName = riNameMatch[1].trim();
        if (newName) {
          renameSession(sessionId, newName);
          console.log(`[Terminal] Auto-renamed session to: "${newName}"`);
        }
      }
      
      // 阶段 2.1 优化：CJK 字符本地回显，零延迟显示
      const hasCJK = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(data);
      
      if (hasCJK && writeQueueRef.current) {
        // 立即本地回显，用户体验零延迟
        writeQueueRef.current.write(data);
        console.log(`[Terminal] CJK local echo: "${data}"`);
        
        // 记录本地回显，用于后续去重（字符级别缓存）
        if (!localEchoCacheRef.current) {
          localEchoCacheRef.current = new Map();
        }
        const timestamp = Date.now();
        
        // 将字符串拆分成单个字符，分别缓存
        for (let i = 0; i < data.length; i++) {
          const char = data[i];
          if (/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(char)) {
            localEchoCacheRef.current.set(char, timestamp);
            
            // 100ms 后清理缓存（避免内存泄漏）
            setTimeout(() => {
              if (localEchoCacheRef.current) {
                localEchoCacheRef.current.delete(char);
              }
            }, 100);
          }
        }
      }
      
      try {
        // 仍然发送到 PTY（作为备份，并触发 shell 处理）
        window.terminal.write({ id: terminalId, data });
        const t2 = performance.now();
        if (hasCJK || t2 - t1 > 5) {
          console.log(`[Terminal] onData -> IPC write took ${(t2-t1).toFixed(2)}ms, CJK: ${hasCJK}, data: "${data.substring(0, 20)}"`);
        }
      } catch (e) {
        console.error(`[Terminal ${terminalId}] IPC write failed:`, e);
      }
    });


    const setupTextAreaListeners = () => {
      const textarea = xterm.textarea;
      if (textarea) {
        textarea.addEventListener('compositionstart', () => {
          compositionRef.current = true;
          console.log('[IME] compositionstart at', performance.now().toFixed(2));
        });
        textarea.addEventListener('compositionupdate', (e: any) => {
          console.log('[IME] compositionupdate:', e.data, 'at', performance.now().toFixed(2));
        });
        textarea.addEventListener('compositionend', (e: any) => {
          const t1 = performance.now();
          console.log('[IME] compositionend:', e.data, 'at', t1.toFixed(2));
          compositionRef.current = false;
          
          // Tier 4.5: 立即同步刷新，不等待 requestAnimationFrame
          if (xtermRef.current) {
            xtermRef.current.refresh(0, xtermRef.current.rows - 1);
            const t2 = performance.now();
            console.log('[IME] Immediate refresh completed, took', (t2-t1).toFixed(2), 'ms');
          }
        });
      }
    };
    
    if (xterm.textarea) setupTextAreaListeners();

    const unsubscribeData = window.terminal.onData((payload: { id: string; data: string }) => {
      if (payload.id === terminalId) {
        const t1 = performance.now();
        
        // RIName 功能：检测 PTY 回显中的 RIName="xxx" 命令
        if (payload.data.includes('RIName=')) {
          console.log(`[Terminal] PTY contains RIName: ${JSON.stringify(payload.data)}`);
          const riNameMatch = payload.data.match(/RIName=["']([^"']+)["']/);
          if (riNameMatch) {
            const newName = riNameMatch[1].trim();
            if (newName) {
              renameSession(sessionId, newName);
              console.log(`[Terminal] Auto-renamed session to: "${newName}"`);
            }
          }
        }
        
        // 阶段 2.2 优化：完全过滤 PTY 回显中的 CJK 字符（已经本地回显过了）
        const originalData = payload.data;
        const hasCJK = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(originalData);
        
        let filteredData = originalData;
        if (hasCJK) {
          // 移除所有 CJK 字符，因为它们已经被本地回显了
          filteredData = originalData.replace(/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g, '');
          console.log(`[Terminal] PTY CJK filtered: original="${originalData}", filtered="${filteredData}"`);
        }
        
        // 只写入过滤后的数据（非 CJK 字符）
        if (filteredData.length > 0 && writeQueueRef.current) {
          writeQueueRef.current.write(filteredData);
        }
        
        const t2 = performance.now();
        if (hasCJK || t2 - t1 > 5) {
          console.log(`[Terminal] PTY data processed in ${(t2-t1).toFixed(2)}ms, had CJK: ${hasCJK}`);
        }
        
        const cache = outputCache.get(terminalId) || [];
        cache.push({ data: payload.data, timestamp: Date.now() });
        outputCache.set(terminalId, cache); // Tier 4: 不再实时 filter，改由后台定时器处理
        
        const now = Date.now();
        if (now - lastUpdateTimeRef.current > 5000) {
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
  }, [terminalId, sessionId]); // Removed isNameSetByUser to prevent re-initialization

  useEffect(() => {
    console.log(`[Terminal ${terminalId}] useEffect for open/focus. sessionId: ${sessionId}, isReady: ${isReady}, isActive: ${isActive}, isVisible: ${isVisible}, hasOpened: ${hasOpenedRef.current}`);
    if (!isReady || !isActive || !isVisible || !containerRef.current || !xtermRef.current) return;

    if (!hasOpenedRef.current) {
      try {
        xtermRef.current.open(containerRef.current!);
        hasOpenedRef.current = true;
        
        // 显式强制刷新一次
        xtermRef.current.refresh(0, xtermRef.current.rows - 1);
        
        // WebGL 报错修复：确保在 open 之后且 DOM 稳定后加载
        // 使用 requestAnimationFrame 确保 DOM 已经完全渲染
        requestAnimationFrame(() => {
          if (!xtermRef.current) return;
          try {
            const webglAddon = new WebglAddon();
            webglAddon.onContextLoss(() => {
              console.warn('[Terminal] WebGL context lost, will attempt to restore');
              webglAddon.dispose();
            });
            xtermRef.current.loadAddon(webglAddon);
            console.log(`[Terminal ${terminalId}] WebGL renderer loaded successfully`);
          } catch (e) {
            console.warn(`[Terminal ${terminalId}] WebGL addon failed, using canvas:`, e);
          }
        });

        setTimeout(() => {

          if (fitAddonRef.current && xtermRef.current) {
            fitAddonRef.current.fit();
            const { cols, rows } = xtermRef.current;
            window.terminal.resize({ id: terminalId, cols, rows });
            xtermRef.current.focus();

            const textarea = xtermRef.current.textarea;
            if (textarea) {
              // 再次绑定以确保万无一失
              textarea.addEventListener('compositionstart', () => { 
                compositionRef.current = true; 
              });
              textarea.addEventListener('compositionend', (e: any) => { 
                const t1 = performance.now();
                compositionRef.current = false;
                
                // 阶段 1.2 优化：移除 requestAnimationFrame，改为直接同步刷新
                if (xtermRef.current) {
                  xtermRef.current.refresh(0, xtermRef.current.rows - 1);
                }
                
                const t2 = performance.now();
                console.log(`[IME] compositionend sync refresh: ${(t2-t1).toFixed(2)}ms, data: "${e.data}"`);
              });
              
              // 强制聚焦 textarea
              textarea.focus({ preventScroll: true });
            }
          }
        }, 100);
      } catch (error) {
        console.error(`[Terminal ${terminalId}] Open failed:`, error);
      }
    } else {
      setTimeout(() => {
        if (fitAddonRef.current && xtermRef.current) {
          fitAddonRef.current.fit();
          const { cols, rows } = xtermRef.current;
          window.terminal.resize({ id: terminalId, cols, rows });
          xtermRef.current.focus();
          
          // 确保 textarea 聚焦
          if (xtermRef.current.textarea) {
            xtermRef.current.textarea.focus({ preventScroll: true });
          }
        }
      }, 50);
    }
  }, [isReady, isActive, isVisible, terminalId]);

  // Force refresh when visibility changes
  useEffect(() => {
    if (isVisible && isReady && xtermRef.current) {
      console.log(`[Terminal ${terminalId}] Visibility changed to visible, forcing refresh`);
      // Force a full refresh of the terminal
      xtermRef.current.refresh(0, xtermRef.current.rows - 1);
      // Also ensure it's focused if active
      if (isActive) {
        xtermRef.current.focus();
      }
    }
  }, [isVisible, isActive, isReady, terminalId]);

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
        onClick={() => {
          if (isActive && isVisible && xtermRef.current) {
            xtermRef.current.focus();
          }
        }}
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
