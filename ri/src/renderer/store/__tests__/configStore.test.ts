import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useConfigStore } from '../configStore';
import { Config } from '../../types/global';

describe('ConfigStore', () => {
  let mockConfig: Config;
  let mockOnChangeCallback: ((config: Config) => void) | null = null;

  beforeEach(() => {
    // Reset store state
    useConfigStore.setState({
      config: null,
      isLoading: false,
      error: null,
    });

    // Mock config data
    mockConfig = {
      version: '1.0.0',
      history: {
        logsDirectory: '~/.ri/logs',
        maxRecordsPerFile: 1000,
        retentionDays: 30,
        trimDebounceMs: 5000,
        autoTrim: true,
        enableFiltering: true,
      },
      terminal: {
        defaultShell: null,
        fontFamily: 'Menlo',
        fontSize: 14,
        fontWeight: '400',
        fontWeightBold: '700',
        lineHeight: 1.2,
        letterSpacing: 0,
        cursorStyle: 'block',
        cursorBlink: true,
        scrollback: 1000,
        smoothScrollDuration: 0,
        scrollSensitivity: 1,
        fastScrollSensitivity: 5,
        fastScrollModifier: 'alt',
        allowTransparency: false,
        theme: {
          name: 'Default',
          background: '#1e1e1e',
          foreground: '#cccccc',
          cursor: '#cccccc',
          cursorAccent: '#1e1e1e',
          selectionBackground: '#264f78',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5',
        },
      },
      window: {
        width: 1200,
        height: 800,
        alwaysOnTop: false,
        sidebarCollapsed: false,
        navigationWidth: 200,
      },
      ai: {
        enabled: false,
        provider: null,
        apiKey: null,
        model: null,
      },
      advanced: {
        devToolsOnStartup: false,
        enablePerformanceMonitoring: false,
        logLevel: 'info',
      },
    } as Config;

    // Mock window.config API
    window.config = {
      get: vi.fn().mockResolvedValue(mockConfig),
      update: vi.fn().mockImplementation(async (partial) => ({
        success: true,
        config: { ...mockConfig, ...partial },
      })),
      reset: vi.fn().mockResolvedValue({
        success: true,
        config: mockConfig,
      }),
      onChange: vi.fn().mockImplementation((callback) => {
        mockOnChangeCallback = callback;
        return () => {
          mockOnChangeCallback = null;
        };
      }),
    } as any;
  });

  describe('Initial State', () => {
    it('should have null config initially', () => {
      const state = useConfigStore.getState();
      expect(state.config).toBeNull();
    });

    it('should not be loading initially', () => {
      const state = useConfigStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      const state = useConfigStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('loadConfig', () => {
    it('should load config successfully', async () => {
      const { loadConfig } = useConfigStore.getState();

      await loadConfig();

      const state = useConfigStore.getState();
      expect(state.config).toEqual(mockConfig);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should call window.config.get', async () => {
      const { loadConfig } = useConfigStore.getState();

      await loadConfig();

      expect(window.config.get).toHaveBeenCalled();
    });

    it('should set isLoading to true while loading', async () => {
      const { loadConfig } = useConfigStore.getState();

      const loadPromise = loadConfig();

      // Check loading state immediately (before promise resolves)
      const loadingState = useConfigStore.getState();
      expect(loadingState.isLoading).toBe(true);

      await loadPromise;
    });

    it('should set isLoading to false after loading', async () => {
      const { loadConfig } = useConfigStore.getState();

      await loadConfig();

      const state = useConfigStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should handle load error gracefully', async () => {
      window.config.get = vi.fn().mockRejectedValue(new Error('Load failed'));

      const { loadConfig } = useConfigStore.getState();

      await loadConfig();

      const state = useConfigStore.getState();
      expect(state.config).toBeNull();
      expect(state.error).toBe('Load failed');
      expect(state.isLoading).toBe(false);
    });

    it('should update config when onChange is triggered', async () => {
      const { loadConfig } = useConfigStore.getState();

      await loadConfig();

      const newConfig = { 
        ...mockConfig, 
        window: { ...mockConfig.window, navigationWidth: 300 }
      };
      mockOnChangeCallback?.(newConfig);

      const state = useConfigStore.getState();
      expect(state.config?.window.navigationWidth).toBe(300);
    });
  });

  describe('updateConfig', () => {
    beforeEach(async () => {
      // Load config first
      await useConfigStore.getState().loadConfig();
    });

    it('should update config successfully', async () => {
      const { updateConfig } = useConfigStore.getState();

      const result = await updateConfig({ 
        window: { ...mockConfig.window, navigationWidth: 300 }
      });

      expect(result).toBe(true);
      const state = useConfigStore.getState();
      expect(state.config?.window.navigationWidth).toBe(300);
    });

    it('should call window.config.update with correct params', async () => {
      const { updateConfig } = useConfigStore.getState();

      const updateData = { 
        window: { ...mockConfig.window, navigationWidth: 350 }
      };
      await updateConfig(updateData);

      expect(window.config.update).toHaveBeenCalledWith(updateData);
    });

    it('should update terminal config', async () => {
      const { updateConfig } = useConfigStore.getState();

      const result = await updateConfig({
        terminal: {
          ...mockConfig.terminal,
          fontSize: 16,
        },
      });

      expect(result).toBe(true);
      const state = useConfigStore.getState();
      expect(state.config?.terminal?.fontSize).toBe(16);
    });

    it('should return false if config is null', async () => {
      useConfigStore.setState({ config: null });

      const { updateConfig } = useConfigStore.getState();
      const result = await updateConfig({ 
        window: { ...mockConfig.window, navigationWidth: 300 }
      });

      expect(result).toBe(false);
    });

    it('should handle update failure', async () => {
      window.config.update = vi.fn().mockResolvedValue({
        success: false,
        error: 'Update failed',
      });

      const { updateConfig } = useConfigStore.getState();
      const result = await updateConfig({ 
        window: { ...mockConfig.window, navigationWidth: 300 }
      });

      expect(result).toBe(false);
      const state = useConfigStore.getState();
      expect(state.error).toBe('Update failed');
    });

    it('should handle update exception', async () => {
      window.config.update = vi.fn().mockRejectedValue(new Error('Network error'));

      const { updateConfig } = useConfigStore.getState();
      const result = await updateConfig({ 
        window: { ...mockConfig.window, navigationWidth: 300 }
      });

      expect(result).toBe(false);
      const state = useConfigStore.getState();
      expect(state.error).toBe('Network error');
    });

    it('should update multiple config properties at once', async () => {
      const { updateConfig } = useConfigStore.getState();

      const result = await updateConfig({
        window: {
          ...mockConfig.window,
          navigationWidth: 400,
        },
        terminal: {
          ...mockConfig.terminal,
          fontSize: 18,
          fontFamily: 'Monaco',
        },
      });

      expect(result).toBe(true);
      const state = useConfigStore.getState();
      expect(state.config?.window.navigationWidth).toBe(400);
      expect(state.config?.terminal?.fontSize).toBe(18);
      expect(state.config?.terminal?.fontFamily).toBe('Monaco');
    });
  });

  describe('resetConfig', () => {
    beforeEach(async () => {
      // Load config first
      await useConfigStore.getState().loadConfig();
      
      // Update to non-default values
      await useConfigStore.getState().updateConfig({ 
        window: { ...mockConfig.window, navigationWidth: 500 }
      });
    });

    it('should reset config successfully', async () => {
      const { resetConfig } = useConfigStore.getState();

      const result = await resetConfig();

      expect(result).toBe(true);
      const state = useConfigStore.getState();
      expect(state.config).toEqual(mockConfig);
    });

    it('should call window.config.reset', async () => {
      const { resetConfig } = useConfigStore.getState();

      await resetConfig();

      expect(window.config.reset).toHaveBeenCalled();
    });

    it('should handle reset failure', async () => {
      window.config.reset = vi.fn().mockResolvedValue({
        success: false,
        error: 'Reset failed',
      });

      const { resetConfig } = useConfigStore.getState();
      const result = await resetConfig();

      expect(result).toBe(false);
      const state = useConfigStore.getState();
      expect(state.error).toBe('Reset failed');
    });

    it('should handle reset exception', async () => {
      window.config.reset = vi.fn().mockRejectedValue(new Error('File system error'));

      const { resetConfig } = useConfigStore.getState();
      const result = await resetConfig();

      expect(result).toBe(false);
      const state = useConfigStore.getState();
      expect(state.error).toBe('File system error');
    });
  });

  describe('Error Handling', () => {
    it('should clear error on successful load after error', async () => {
      // First, trigger an error
      window.config.get = vi.fn().mockRejectedValue(new Error('Initial error'));
      await useConfigStore.getState().loadConfig();
      
      expect(useConfigStore.getState().error).toBe('Initial error');

      // Then, successful load
      window.config.get = vi.fn().mockResolvedValue(mockConfig);
      await useConfigStore.getState().loadConfig();

      const state = useConfigStore.getState();
      expect(state.error).toBeNull();
      expect(state.config).toEqual(mockConfig);
    });

    it('should preserve config on update error', async () => {
      await useConfigStore.getState().loadConfig();
      const originalConfig = useConfigStore.getState().config;

      window.config.update = vi.fn().mockRejectedValue(new Error('Update error'));
      
      await useConfigStore.getState().updateConfig({ 
        window: { ...mockConfig.window, navigationWidth: 999 }
      });

      const state = useConfigStore.getState();
      expect(state.config).toEqual(originalConfig);
      expect(state.error).toBe('Update error');
    });
  });

  describe('Config Change Listener', () => {
    it('should respond to external config changes', async () => {
      await useConfigStore.getState().loadConfig();

      // Simulate external config change
      const updatedConfig = { 
        ...mockConfig, 
        window: { ...mockConfig.window, navigationWidth: 250 }
      };
      mockOnChangeCallback?.(updatedConfig);

      const state = useConfigStore.getState();
      expect(state.config?.window.navigationWidth).toBe(250);
    });

    it('should handle multiple external changes', async () => {
      await useConfigStore.getState().loadConfig();

      mockOnChangeCallback?.({ 
        ...mockConfig, 
        window: { ...mockConfig.window, navigationWidth: 250 }
      });
      mockOnChangeCallback?.({ 
        ...mockConfig, 
        window: { ...mockConfig.window, navigationWidth: 300 }
      });
      mockOnChangeCallback?.({ 
        ...mockConfig, 
        window: { ...mockConfig.window, navigationWidth: 350 }
      });

      const state = useConfigStore.getState();
      expect(state.config?.window.navigationWidth).toBe(350);
    });
  });
});
