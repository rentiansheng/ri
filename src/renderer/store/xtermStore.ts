import { create } from 'zustand';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';

// XTerm 实例及其相关 addons 的容器
export interface XTermInstance {
  xterm: XTerm;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
  terminalId: string;
  sessionId: string;
  isOpened: boolean;  // 是否已经调用过 xterm.open()
}

interface XTermStore {
  instances: Map<string, XTermInstance>;  // key: sessionId
  terminalConfig: any; // 终端配置
  
  // 设置终端配置
  setTerminalConfig: (config: any) => void;
  
  // 创建 xterm 实例
  createInstance: (sessionId: string, terminalId: string) => XTermInstance;
  
  // 获取 xterm 实例
  getInstance: (sessionId: string) => XTermInstance | undefined;
  
  // 标记 xterm 已打开（调用过 open()）
  markAsOpened: (sessionId: string) => void;
  
  // 标记 xterm 已关闭（需要重新挂载）
  markAsClosed: (sessionId: string) => void;
  
  // 销毁 xterm 实例
  destroyInstance: (sessionId: string) => void;
  
  // 清除所有实例
  clearAll: () => void;
}

// 默认配置
const defaultConfig = {
  fontFamily: '"SF Mono", "JetBrains Mono", Menlo, Monaco, "Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
  fontSize: 14,
  fontWeight: '400',
  fontWeightBold: '700',
  lineHeight: 1.0,
  letterSpacing: 0,
  cursorBlink: true,
  cursorStyle: 'block' as const,
  cursorWidth: 1,
  scrollback: 10000,
  allowTransparency: false,
  theme: {
    background: '#282828',
    foreground: '#ebdbb2',
    cursor: '#ebdbb2',
    cursorAccent: '#282828',
    selectionBackground: 'rgba(235, 219, 178, 0.25)',
    black: '#282828',
    red: '#cc241d',
    green: '#98971a',
    yellow: '#d79921',
    blue: '#458588',
    magenta: '#b16286',
    cyan: '#689d6a',
    white: '#a89984',
    brightBlack: '#928374',
    brightRed: '#fb4934',
    brightGreen: '#b8bb26',
    brightYellow: '#fabd2f',
    brightBlue: '#83a598',
    brightMagenta: '#d3869b',
    brightCyan: '#8ec07c',
    brightWhite: '#ebdbb2',
  }
};

export const useXTermStore = create<XTermStore>((set, get) => ({
  instances: new Map(),
  terminalConfig: defaultConfig,
  
  setTerminalConfig: (config: any) => {
    set({ terminalConfig: config });
  },
  
  createInstance: (sessionId: string, terminalId: string) => {
    // 如果已存在，直接返回
    const existing = get().instances.get(sessionId);
    if (existing) {
      console.log(`[XTermStore] Instance for session ${sessionId} already exists`);
      return existing;
    }
    
    console.log(`[XTermStore] Creating xterm instance for session ${sessionId}`);
    
    // 获取当前配置
    const config = get().terminalConfig;
    
    // 创建 xterm 实例
    const xterm = new XTerm({
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      fontWeight: config.fontWeight,
      fontWeightBold: config.fontWeightBold,
      lineHeight: config.lineHeight,
      letterSpacing: config.letterSpacing,
      cursorBlink: config.cursorBlink,
      cursorStyle: config.cursorStyle,
      cursorWidth: config.cursorWidth,
      scrollback: config.scrollback,
      allowTransparency: config.allowTransparency,
      theme: config.theme,
      rows: 24,
      cols: 80,
      allowProposedApi: true,
      disableStdin: true,
      convertEol: false,
      smoothScrollDuration: 0,
      fastScrollModifier: 'shift',
      fastScrollSensitivity: 5,
      scrollSensitivity: 1,
    });
    
    // 创建 addons
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicode11Addon = new Unicode11Addon();
    
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(searchAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.loadAddon(unicode11Addon);
    xterm.unicode.activeVersion = '11';
    
    const instance: XTermInstance = {
      xterm,
      fitAddon,
      searchAddon,
      terminalId,
      sessionId,
      isOpened: false,
    };
    
    set((state) => {
      const newInstances = new Map(state.instances);
      newInstances.set(sessionId, instance);
      return { instances: newInstances };
    });
    
    return instance;
  },
  
  getInstance: (sessionId: string) => {
    return get().instances.get(sessionId);
  },
  
  markAsOpened: (sessionId: string) => {
    const instance = get().instances.get(sessionId);
    if (instance) {
      instance.isOpened = true;
      set((state) => {
        const newInstances = new Map(state.instances);
        newInstances.set(sessionId, instance);
        return { instances: newInstances };
      });
    }
  },
  
  markAsClosed: (sessionId: string) => {
    const instance = get().instances.get(sessionId);
    if (instance) {
      console.log(`[XTermStore] Marking instance ${sessionId} as closed (needs re-mount)`);
      instance.isOpened = false;
      set((state) => {
        const newInstances = new Map(state.instances);
        newInstances.set(sessionId, instance);
        return { instances: newInstances };
      });
    }
  },
  
  destroyInstance: (sessionId: string) => {
    const instance = get().instances.get(sessionId);
    if (instance) {
      console.log(`[XTermStore] Destroying xterm instance for session ${sessionId}`);
      try {
        instance.xterm.dispose();
      } catch (e) {
        console.error('[XTermStore] Error disposing xterm:', e);
      }
      
      set((state) => {
        const newInstances = new Map(state.instances);
        newInstances.delete(sessionId);
        return { instances: newInstances };
      });
    }
  },
  
  clearAll: () => {
    const instances = get().instances;
    instances.forEach((instance) => {
      try {
        instance.xterm.dispose();
      } catch (e) {
        console.error('[XTermStore] Error disposing xterm:', e);
      }
    });
    set({ instances: new Map() });
  },
}));
