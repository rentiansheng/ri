const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const EventEmitter = require('events');

/**
 * Configuration Manager
 * Handles loading, saving, watching, and validating application configuration
 */
class ConfigManager extends EventEmitter {
  constructor() {
    super();
    
    // Configuration file paths
    this.userDataDir = app.getPath('userData');
    this.configFilePath = path.join(this.userDataDir, 'config.json');
    this.defaultConfigPath = path.join(__dirname, 'config.default.json');
    
    // Current configuration
    this.config = null;
    
    // File watcher
    this.watcher = null;
    
    // Debounce timer for file changes
    this.watchDebounceTimer = null;
    this.WATCH_DEBOUNCE_MS = 1000;
  }
  
  /**
   * Load configuration from file
   * Creates default config if file doesn't exist
   * @returns {Object} Configuration object
   */
  loadConfig() {
    try {
      // Ensure user data directory exists
      if (!fs.existsSync(this.userDataDir)) {
        fs.mkdirSync(this.userDataDir, { recursive: true });
      }
      
      // Load default configuration
      const defaultConfig = this.loadDefaultConfig();
      
      // Check if user config exists
      if (!fs.existsSync(this.configFilePath)) {
        console.log('[ConfigManager] Config file not found, creating default config');
        this.config = defaultConfig;
        this.saveConfig(this.config);
        return this.config;
      }
      
      // Load user configuration
      const userConfigContent = fs.readFileSync(this.configFilePath, 'utf8');
      const userConfig = JSON.parse(userConfigContent);
      
      // Merge with defaults (in case new fields were added)
      this.config = this.deepMerge(defaultConfig, userConfig);
      
      // Validate configuration
      const validationResult = this.validateConfig(this.config);
      if (!validationResult.valid) {
        console.warn('[ConfigManager] Config validation failed:', validationResult.errors);
        // Use default config if validation fails
        this.config = defaultConfig;
        this.saveConfig(this.config);
      }
      
      console.log('[ConfigManager] Config loaded successfully');
      return this.config;
    } catch (error) {
      console.error('[ConfigManager] Failed to load config:', error);
      // Fall back to default config
      this.config = this.loadDefaultConfig();
      return this.config;
    }
  }
  
  /**
   * Load default configuration
   * @returns {Object} Default configuration object
   */
  loadDefaultConfig() {
    try {
      const defaultConfigContent = fs.readFileSync(this.defaultConfigPath, 'utf8');
      return JSON.parse(defaultConfigContent);
    } catch (error) {
      console.error('[ConfigManager] Failed to load default config:', error);
      // Hard-coded fallback
      return this.getHardcodedDefaultConfig();
    }
  }
  
  /**
   * Get hard-coded default configuration (last resort fallback)
   * @returns {Object} Default configuration
   */
  getHardcodedDefaultConfig() {
    return {
      version: '0.1.0',
      history: {
        logsDirectory: 'session-logs',
        maxRecordsPerFile: 1000,
        retentionDays: 30,
        trimDebounceMs: 30000,
        autoTrim: true,
        enableFiltering: true
      },
      terminal: {
        defaultShell: null,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        cursorStyle: 'block',
        cursorBlink: true,
        scrollback: 1000,
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#ffffff',
          selection: '#264f78'
        }
      },
      window: {
        width: 1200,
        height: 800,
        alwaysOnTop: false,
        sidebarCollapsed: false
      },
      ai: {
        enabled: false,
        provider: null,
        apiKey: null,
        model: null
      },
      advanced: {
        devToolsOnStartup: false,
        enablePerformanceMonitoring: false,
        logLevel: 'info'
      }
    };
  }
  
  /**
   * Save configuration to file
   * @param {Object} config - Configuration object to save
   */
  saveConfig(config) {
    try {
      const configJson = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configFilePath, configJson, 'utf8');
      console.log('[ConfigManager] Config saved successfully');
    } catch (error) {
      console.error('[ConfigManager] Failed to save config:', error);
      throw error;
    }
  }
  
  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config;
  }
  
  /**
   * Update configuration with partial config
   * @param {Object} partialConfig - Partial configuration to merge
   * @returns {Object} Updated configuration
   */
  async updateConfig(partialConfig) {
    try {
      if (!this.config) {
        this.loadConfig();
      }
      
      // Deep merge the partial config
      const updatedConfig = this.deepMerge(this.config, partialConfig);
      
      // Validate the updated config
      const validationResult = this.validateConfig(updatedConfig);
      if (!validationResult.valid) {
        throw new Error(`Config validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Save the updated config
      this.config = updatedConfig;
      this.saveConfig(this.config);
      
      // Emit config-changed event
      this.emit('config-changed', this.config);
      
      console.log('[ConfigManager] Config updated successfully');
      return this.config;
    } catch (error) {
      console.error('[ConfigManager] Failed to update config:', error);
      throw error;
    }
  }
  
  /**
   * Reset configuration to default
   * @returns {Object} Default configuration
   */
  async resetToDefault() {
    try {
      const defaultConfig = this.loadDefaultConfig();
      this.config = defaultConfig;
      this.saveConfig(this.config);
      
      // Emit config-changed event
      this.emit('config-changed', this.config);
      
      console.log('[ConfigManager] Config reset to default');
      return this.config;
    } catch (error) {
      console.error('[ConfigManager] Failed to reset config:', error);
      throw error;
    }
  }
  
  /**
   * Start watching configuration file for changes
   */
  watchConfig() {
    try {
      if (this.watcher) {
        console.log('[ConfigManager] Already watching config file');
        return;
      }
      
      if (!fs.existsSync(this.configFilePath)) {
        console.warn('[ConfigManager] Config file does not exist, cannot watch');
        return;
      }
      
      this.watcher = fs.watch(this.configFilePath, (eventType) => {
        if (eventType === 'change') {
          // Debounce file changes
          if (this.watchDebounceTimer) {
            clearTimeout(this.watchDebounceTimer);
          }
          
          this.watchDebounceTimer = setTimeout(() => {
            console.log('[ConfigManager] Config file changed, reloading...');
            try {
              const oldConfig = this.config;
              this.loadConfig();
              
              // Only emit if config actually changed
              if (JSON.stringify(oldConfig) !== JSON.stringify(this.config)) {
                this.emit('config-changed', this.config);
              }
            } catch (error) {
              console.error('[ConfigManager] Failed to reload config after file change:', error);
            }
          }, this.WATCH_DEBOUNCE_MS);
        }
      });
      
      console.log('[ConfigManager] Started watching config file');
    } catch (error) {
      console.error('[ConfigManager] Failed to watch config file:', error);
    }
  }
  
  /**
   * Stop watching configuration file
   */
  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('[ConfigManager] Stopped watching config file');
    }
    
    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
      this.watchDebounceTimer = null;
    }
  }
  
  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }
  
  /**
   * Validate configuration
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  validateConfig(config) {
    const errors = [];
    
    try {
      // Validate version
      if (!config.version || typeof config.version !== 'string') {
        errors.push('Invalid version');
      }
      
      // Validate history config
      if (config.history) {
        const { maxRecordsPerFile, retentionDays, trimDebounceMs } = config.history;
        
        if (maxRecordsPerFile !== undefined) {
          if (typeof maxRecordsPerFile !== 'number' || maxRecordsPerFile < 100 || maxRecordsPerFile > 10000) {
            errors.push('history.maxRecordsPerFile must be between 100 and 10000');
          }
        }
        
        if (retentionDays !== undefined) {
          if (typeof retentionDays !== 'number' || retentionDays < 1 || retentionDays > 365) {
            errors.push('history.retentionDays must be between 1 and 365');
          }
        }
        
        if (trimDebounceMs !== undefined) {
          if (typeof trimDebounceMs !== 'number' || trimDebounceMs < 5000 || trimDebounceMs > 120000) {
            errors.push('history.trimDebounceMs must be between 5000 and 120000');
          }
        }
      }
      
      // Validate terminal config
      if (config.terminal) {
        const { fontSize, scrollback, cursorStyle } = config.terminal;
        
        if (fontSize !== undefined) {
          if (typeof fontSize !== 'number' || fontSize < 10 || fontSize > 24) {
            errors.push('terminal.fontSize must be between 10 and 24');
          }
        }
        
        if (scrollback !== undefined) {
          if (typeof scrollback !== 'number' || scrollback < 100 || scrollback > 10000) {
            errors.push('terminal.scrollback must be between 100 and 10000');
          }
        }
        
        if (cursorStyle !== undefined) {
          if (!['block', 'underline', 'bar'].includes(cursorStyle)) {
            errors.push('terminal.cursorStyle must be "block", "underline", or "bar"');
          }
        }
      }
      
      // Validate window config
      if (config.window) {
        const { width, height } = config.window;
        
        if (width !== undefined) {
          if (typeof width !== 'number' || width < 800 || width > 4096) {
            errors.push('window.width must be between 800 and 4096');
          }
        }
        
        if (height !== undefined) {
          if (typeof height !== 'number' || height < 600 || height > 2160) {
            errors.push('window.height must be between 600 and 2160');
          }
        }
      }
      
      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        errors: ['Validation error: ' + error.message]
      };
    }
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    this.stopWatching();
    this.removeAllListeners();
    console.log('[ConfigManager] Cleaned up resources');
  }
}

module.exports = ConfigManager;
