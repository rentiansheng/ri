import { create } from 'zustand';
import { Config } from '../types/global';

interface ConfigState {
  config: Config | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadConfig: () => Promise<void>;
  updateConfig: (partialConfig: Partial<Config>) => Promise<boolean>;
  resetConfig: () => Promise<boolean>;
}

let changeListenerCleanup: (() => void) | null = null;

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  isLoading: false,
  error: null,

  loadConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await window.config.get();
      set({ config, isLoading: false });
      
      // Setup change listener (only once)
      if (!changeListenerCleanup) {
        changeListenerCleanup = window.config.onChange((newConfig) => {
          console.log('[ConfigStore] Config changed:', newConfig);
          set({ config: newConfig });
        });
      }
    } catch (error) {
      console.error('[ConfigStore] Failed to load config:', error);
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  updateConfig: async (partialConfig) => {
    const { config } = get();
    if (!config) return false;

    try {
      const result = await window.config.update(partialConfig);
      if (result.success && result.config) {
        set({ config: result.config });
        return true;
      }
      set({ error: result.error || 'Failed to update config' });
      return false;
    } catch (error) {
      console.error('[ConfigStore] Failed to update config:', error);
      set({ error: (error as Error).message });
      return false;
    }
  },

  resetConfig: async () => {
    try {
      const result = await window.config.reset();
      if (result.success && result.config) {
        set({ config: result.config });
        return true;
      }
      set({ error: result.error || 'Failed to reset config' });
      return false;
    } catch (error) {
      console.error('[ConfigStore] Failed to reset config:', error);
      set({ error: (error as Error).message });
      return false;
    }
  },
}));
