import { vi } from 'vitest';

/**
 * Mock Electron IPC APIs
 */
export const mockElectronAPI = {
  config: {
    get: vi.fn().mockResolvedValue({
      terminal: { 
        fontSize: 14, 
        fontFamily: 'Menlo',
        theme: { name: 'Gruvbox Dark', background: '#282828' } 
      },
      window: { navigationWidth: 250 },
    }),
    update: vi.fn().mockResolvedValue({ success: true }),
    onChange: vi.fn((callback) => () => {}),
  },
  
  terminal: {
    create: vi.fn().mockResolvedValue({ success: true, terminalId: 'test-id' }),
    write: vi.fn().mockResolvedValue({ success: true }),
    resize: vi.fn().mockResolvedValue({ success: true }),
    destroy: vi.fn().mockResolvedValue({ success: true }),
    onData: vi.fn((callback) => () => {}),
    onExit: vi.fn((callback) => () => {}),
  },
  
  notification: {
    send: vi.fn().mockResolvedValue({ success: true }),
    getAll: vi.fn().mockResolvedValue([]),
    markAsRead: vi.fn().mockResolvedValue({ success: true }),
  },
  
  flow: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue({ success: true }),
    delete: vi.fn().mockResolvedValue({ success: true }),
  },
};

/**
 * Helper to inject mocked Electron APIs into window
 */
export function setupElectronAPIMocks() {
  (global.window as any).config = mockElectronAPI.config;
  (global.window as any).terminal = mockElectronAPI.terminal;
  (global.window as any).notification = mockElectronAPI.notification;
  (global.window as any).flow = mockElectronAPI.flow;
}

/**
 * Helper to reset all Electron API mocks
 */
export function resetElectronAPIMocks() {
  vi.clearAllMocks();
}

export default mockElectronAPI;
