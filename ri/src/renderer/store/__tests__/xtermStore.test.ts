import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useXTermStore } from '../xtermStore';

// Create mocks in hoisted scope
const { MockTerminal, MockFitAddon, MockSearchAddon, MockWebLinksAddon, MockUnicode11Addon } = vi.hoisted(() => {
  return {
    MockTerminal: class {
      options: any;
      
      constructor(options: any) {
        this.options = options; // Store options properly
      }
      
      loadAddon = vi.fn();
      open = vi.fn();
      write = vi.fn();
      dispose = vi.fn();
      unicode = { activeVersion: '11' };
    },
    MockFitAddon: class {
      fit = vi.fn();
    },
    MockSearchAddon: class {
      findNext = vi.fn();
    },
    MockWebLinksAddon: class {},
    MockUnicode11Addon: class {},
  };
});

// Mock xterm modules
vi.mock('xterm', () => ({
  Terminal: MockTerminal,
}));

vi.mock('xterm-addon-fit', () => ({
  FitAddon: MockFitAddon,
}));

vi.mock('@xterm/addon-search', () => ({
  SearchAddon: MockSearchAddon,
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: MockWebLinksAddon,
}));

vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: MockUnicode11Addon,
}));

describe('XTermStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useXTermStore.setState({
      instances: new Map(),
      terminalConfig: {
        fontFamily: 'Menlo',
        fontSize: 14,
        theme: { background: '#282828' },
      },
    });
  });

  describe('setTerminalConfig', () => {
    it('should update terminal configuration', () => {
      const newConfig = {
        fontSize: 16,
        fontFamily: 'Monaco',
        theme: { background: '#1e1e1e' },
      };

      useXTermStore.getState().setTerminalConfig(newConfig);

      expect(useXTermStore.getState().terminalConfig).toEqual(newConfig);
    });

    it('should preserve unspecified config properties', () => {
      const initialConfig = useXTermStore.getState().terminalConfig;
      const partialConfig = { fontSize: 18 };

      useXTermStore.getState().setTerminalConfig({
        ...initialConfig,
        ...partialConfig,
      });

      const updatedConfig = useXTermStore.getState().terminalConfig;
      expect(updatedConfig.fontSize).toBe(18);
      expect(updatedConfig.fontFamily).toBe('Menlo'); // preserved
    });
  });

  describe('createInstance', () => {
    it('should create a new xterm instance', () => {
      const sessionId = 'session-1';
      const terminalId = 'terminal-1';

       const instance = useXTermStore.getState().createInstance(terminalId, sessionId);

       expect(instance).toBeDefined();
       expect(instance.sessionId).toBe(sessionId);
       expect(instance.terminalId).toBe(terminalId);
      expect(instance.xterm).toBeInstanceOf(MockTerminal);
      expect(instance.fitAddon).toBeInstanceOf(MockFitAddon);
      expect(instance.searchAddon).toBeInstanceOf(MockSearchAddon);
      expect(instance.isOpened).toBe(false);
    });

    it('should use current terminal config when creating instance', () => {
      const config = {
        fontSize: 20,
        fontFamily: 'Consolas',
        theme: { background: '#000000' },
      };

       useXTermStore.getState().setTerminalConfig(config);
       const instance = useXTermStore.getState().createInstance('terminal-1', 'session-1');

      expect(instance.xterm.options.fontSize).toBe(20);
      expect(instance.xterm.options.fontFamily).toBe('Consolas');
    });

     it('should return existing instance if already created', () => {
       const sessionId = 'session-1';

       const instance1 = useXTermStore.getState().createInstance('terminal-1', sessionId);
       const instance2 = useXTermStore.getState().createInstance('terminal-1', 'session-2');

       expect(instance1).toBe(instance2);
     });

     it('should load all addons', () => {
       const instance = useXTermStore.getState().createInstance('terminal-1', 'session-1');

      expect(instance.xterm.loadAddon).toHaveBeenCalledTimes(4); // fit, search, weblinks, unicode11
    });
  });

  describe('getInstance', () => {
     it('should return existing instance', () => {
       const sessionId = 'session-1';
       const created = useXTermStore.getState().createInstance('terminal-1', sessionId);
       const retrieved = useXTermStore.getState().getInstance('terminal-1');

      expect(retrieved).toBe(created);
    });

    it('should return undefined for non-existent instance', () => {
      const retrieved = useXTermStore.getState().getInstance('non-existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('markAsOpened', () => {
     it('should mark instance as opened', () => {
       const sessionId = 'session-1';
       useXTermStore.getState().createInstance('terminal-1', sessionId);

       useXTermStore.getState().markAsOpened('terminal-1');

       const instance = useXTermStore.getState().getInstance('terminal-1');
       expect(instance?.isOpened).toBe(true);
    });

    it('should not throw for non-existent session', () => {
      expect(() => {
        useXTermStore.getState().markAsOpened('non-existent');
      }).not.toThrow();
    });
  });

  describe('destroyInstance', () => {
     it('should remove instance from store', () => {
       const sessionId = 'session-1';
       useXTermStore.getState().createInstance('terminal-1', sessionId);

       useXTermStore.getState().destroyInstance('terminal-1');

       const instance = useXTermStore.getState().getInstance('terminal-1');
       expect(instance).toBeUndefined();
    });

     it('should call xterm dispose method', () => {
       const sessionId = 'session-1';
       const instance = useXTermStore.getState().createInstance('terminal-1', sessionId);

       useXTermStore.getState().destroyInstance('terminal-1');

      expect(instance.xterm.dispose).toHaveBeenCalled();
    });

    it('should not throw for non-existent session', () => {
      expect(() => {
        useXTermStore.getState().destroyInstance('non-existent');
      }).not.toThrow();
    });
  });

  describe('clearAll', () => {
     it('should remove all instances', () => {
       useXTermStore.getState().createInstance('terminal-1', 'session-1');
       useXTermStore.getState().createInstance('terminal-2', 'session-2');

      expect(useXTermStore.getState().instances.size).toBe(2);

      useXTermStore.getState().clearAll();

      expect(useXTermStore.getState().instances.size).toBe(0);
    });

     it('should call dispose on all instances', () => {
       const instance1 = useXTermStore.getState().createInstance('terminal-1', 'session-1');
       const instance2 = useXTermStore.getState().createInstance('terminal-2', 'session-2');

      useXTermStore.getState().clearAll();

      expect(instance1.xterm.dispose).toHaveBeenCalled();
      expect(instance2.xterm.dispose).toHaveBeenCalled();
    });
  });

  describe('Multiple instances', () => {
     it('should manage multiple independent instances', () => {
       const instance1 = useXTermStore.getState().createInstance('terminal-1', 'session-1');
       const instance2 = useXTermStore.getState().createInstance('terminal-2', 'session-2');

      expect(instance1).not.toBe(instance2);
      expect(useXTermStore.getState().instances.size).toBe(2);
    });

     it('should destroy specific instance without affecting others', () => {
       useXTermStore.getState().createInstance('terminal-1', 'session-1');
       const instance2 = useXTermStore.getState().createInstance('terminal-2', 'session-2');

       useXTermStore.getState().destroyInstance('terminal-1');

       expect(useXTermStore.getState().getInstance('terminal-1')).toBeUndefined();
       expect(useXTermStore.getState().getInstance('terminal-2')).toBe(instance2);
    });
  });
});
