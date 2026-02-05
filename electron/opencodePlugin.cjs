/**
 * OpenCode Plugin Manager
 * 管理 OpenCode RI 通知插件的安装、检测和更新
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { shell } = require('electron');
const { execSync } = require('child_process');
const crypto = require('crypto');

class OpencodePluginManager {
  constructor() {
    this.pluginName = 'opencode-ri-notification';
    this.pluginVersion = '1.0.0';
    
    // Source path (在 RI 应用内)
    this.sourcePath = path.join(__dirname, '../opencode-ri-notification');
    
    // Target path (用户的 OpenCode 插件目录)
    this.targetPath = path.join(os.homedir(), '.config/opencode/plugins', this.pluginName);
    
    // OpenCode config path
    this.opencodeConfigPath = path.join(os.homedir(), '.config/opencode/opencode.json');
    
    // Cache for detection results
    this._detectionCache = null;
    this._detectionCacheTime = null;
    this._cacheTimeout = 60 * 60 * 1000; // 1 hour
    
    // Config manager reference (will be set by main.cjs)
    this.configManager = null;
  }

  /**
   * 检查 OpenCode 是否已安装（保留旧方法用于兼容）
   */
  async isOpencodeInstalled() {
    try {
      const installations = await this.detectAllInstallations();
      return installations.length > 0;
    } catch (error) {
      console.error('[OpencodePlugin] isOpencodeInstalled failed:', error);
      return false;
    }
  }

  /**
   * 通过 Shell 环境检测 OpenCode (最准确)
   */
  async detectViaShell() {
    const installations = [];
    const shells = [
      { cmd: 'zsh -l -c "which opencode"', name: 'zsh' },
      { cmd: 'bash -l -c "which opencode"', name: 'bash' },
      { cmd: '/bin/zsh -l -c "which opencode"', name: 'zsh-explicit' },
      { cmd: '/bin/bash -l -c "which opencode"', name: 'bash-explicit' },
    ];
    
    for (const { cmd, name } of shells) {
      try {
        const result = execSync(cmd, {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 3000,
          env: { ...process.env, HOME: os.homedir() }
        }).trim();
        
        if (result && await fs.pathExists(result)) {
          const installation = await this.validateOpencodeInstallation(result);
          if (installation) {
            installation.source = 'shell';
            installation.shellType = name;
            installations.push(installation);
            console.log(`[OpencodePlugin] Found via ${name}: ${result}`);
            break; // Found one, no need to try other shells
          }
        }
      } catch (error) {
        // Shell failed, continue to next
        continue;
      }
    }
    
    return installations;
  }

  /**
   * 通过文件系统常见路径检测 OpenCode
   */
  async detectViaFilesystem() {
    const homeDir = os.homedir();
    const candidatePaths = [
      // OpenCode 官方默认安装路径
      path.join(homeDir, '.opencode/bin/opencode'),
      
      // Homebrew (Apple Silicon)
      '/opt/homebrew/bin/opencode',
      
      // Homebrew (Intel Mac)
      '/usr/local/bin/opencode',
      
      // MacPorts
      '/opt/local/bin/opencode',
      
      // 用户目录常见位置
      path.join(homeDir, '.local/bin/opencode'),
      path.join(homeDir, 'bin/opencode'),
      path.join(homeDir, '.cargo/bin/opencode'),
      
      // 配置目录
      path.join(homeDir, '.config/opencode/bin/opencode'),
      
      // npm 全局安装
      path.join(homeDir, '.npm-global/bin/opencode'),
      path.join(homeDir, '.npm/bin/opencode'),
      
      // 系统路径
      '/usr/bin/opencode',
      '/bin/opencode',
    ];
    
    const installations = [];
    for (const candidatePath of candidatePaths) {
      try {
        const installation = await this.validateOpencodeInstallation(candidatePath);
        if (installation) {
          installation.source = 'filesystem';
          installations.push(installation);
          console.log(`[OpencodePlugin] Found via filesystem: ${candidatePath}`);
        }
      } catch (error) {
        // Path invalid, continue
        continue;
      }
    }
    
    return installations;
  }

  /**
   * 通过用户自定义路径检测 OpenCode
   */
  async detectViaCustomPaths() {
    const config = this.getPluginConfig();
    const customPaths = config.customPaths || [];
    const installations = [];
    
    for (const customPath of customPaths) {
      try {
        const installation = await this.validateOpencodeInstallation(customPath);
        if (installation) {
          installation.source = 'manual';
          installations.push(installation);
          console.log(`[OpencodePlugin] Found via custom path: ${customPath}`);
        } else {
          console.warn(`[OpencodePlugin] Custom path is invalid: ${customPath}`);
        }
      } catch (error) {
        console.error(`[OpencodePlugin] Failed to validate custom path ${customPath}:`, error);
        continue;
      }
    }
    
    return installations;
  }

  /**
   * 验证路径是否为有效的 OpenCode 安装
   * @returns {Promise<Object|null>} Installation object or null if invalid
   */
  async validateOpencodeInstallation(opencodeExePath) {
    try {
      // 1. 检查文件是否存在
      if (!await fs.pathExists(opencodeExePath)) {
        return null;
      }
      
      // 2. 检查是否可执行
      try {
        await fs.access(opencodeExePath, fs.constants.X_OK);
      } catch (error) {
        console.warn(`[OpencodePlugin] Not executable: ${opencodeExePath}`);
        return null;
      }
      
      // 3. 尝试获取版本号 (验证是真的 OpenCode)
      let version = null;
      try {
        version = execSync(`"${opencodeExePath}" --version`, {
          encoding: 'utf-8',
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
      } catch (error) {
        console.warn(`[OpencodePlugin] Cannot get version for: ${opencodeExePath}`);
        return null;
      }
      
      // 4. 推断插件目录
      const pluginDir = await this.getPluginDirForOpencode(opencodeExePath);
      
      // 5. 生成唯一 ID (用于配置存储)
      const id = crypto.createHash('md5').update(opencodeExePath).digest('hex');
      
      return {
        id,
        path: opencodeExePath,
        version,
        pluginDir,
        isValid: true,
        isActive: false,  // Will be set later
        source: null,     // Caller will set this
      };
    } catch (error) {
      console.error(`[OpencodePlugin] Validate failed for ${opencodeExePath}:`, error);
      return null;
    }
  }

  /**
   * 推断 OpenCode 对应的插件目录
   */
  async getPluginDirForOpencode(opencodeExePath) {
    // 默认使用 ~/.config/opencode/plugins/
    // 未来可以通过 OpenCode 命令获取配置目录（如果支持）
    return path.join(os.homedir(), '.config/opencode/plugins', this.pluginName);
  }

  /**
   * 从配置文件加载检测缓存
   */
  loadDetectionCache() {
    const config = this.getPluginConfig();
    if (config.detectionCache && config.detectionCache.installations) {
      console.log('[OpencodePlugin] Loaded detection cache from config');
      return config.detectionCache.installations;
    }
    return null;
  }

  /**
   * 保存检测缓存到配置文件
   */
  saveDetectionCache(installations) {
    const config = this.getPluginConfig();
    config.detectionCache = {
      timestamp: Date.now(),
      installations: installations.map(inst => ({
        id: inst.id,
        path: inst.path,
        version: inst.version,
        pluginDir: inst.pluginDir,
        source: inst.source,
        shellType: inst.shellType,
        isValid: inst.isValid,
        isActive: inst.isActive
      }))
    };
    this.savePluginConfig(config);
    console.log('[OpencodePlugin] Saved detection cache to config');
  }

  /**
   * 智能合并：新检测的路径 + 缓存中仍然有效的路径
   */
  async smartMerge(newList, cachedList) {
    const merged = new Map();
    
    // 1. 添加所有新检测到的路径
    for (const inst of newList) {
      merged.set(inst.path, inst);
    }
    
    // 2. 验证并添加缓存中的路径（如果不在新列表中）
    for (const cached of cachedList) {
      if (!merged.has(cached.path)) {
        // 验证路径是否仍然有效
        const valid = await this.validateOpencodeInstallation(cached.path);
        if (valid) {
          // 保留原有的 source 和其他属性
          valid.source = cached.source;
          if (cached.shellType) {
            valid.shellType = cached.shellType;
          }
          merged.set(cached.path, valid);
          console.log(`[OpencodePlugin] Cached path still valid: ${cached.path}`);
        } else {
          console.log(`[OpencodePlugin] Cached path no longer valid, removing: ${cached.path}`);
        }
      }
    }
    
    return Array.from(merged.values());
  }

  /**
   * 检测所有 OpenCode 安装（主方法）
   */
  async detectAllInstallations(forceRefresh = false) {
    // 1. 如果不强制刷新，优先从持久化缓存加载
    if (!forceRefresh) {
      const cached = this.loadDetectionCache();
      if (cached && cached.length > 0) {
        console.log('[OpencodePlugin] Using persistent cache');
        // 更新内存缓存
        this._detectionCache = cached;
        this._detectionCacheTime = Date.now();
        return cached;
      }
    }
    
    console.log('[OpencodePlugin] Starting full OpenCode detection...');
    
    const installationMap = new Map(); // Key: path, Value: installation
    
    // 2. 执行完整检测
    // 2.1. 优先级最高: 用户手动添加的路径
    try {
      const customPaths = await this.detectViaCustomPaths();
      for (const inst of customPaths) {
        installationMap.set(inst.path, inst);
      }
      console.log(`[OpencodePlugin] Custom paths: ${customPaths.length}`);
    } catch (error) {
      console.error('[OpencodePlugin] detectViaCustomPaths failed:', error);
    }
    
    // 2.2. Shell 环境检测 (最准确)
    try {
      const shellPaths = await this.detectViaShell();
      for (const inst of shellPaths) {
        if (!installationMap.has(inst.path)) {
          installationMap.set(inst.path, inst);
        }
      }
      console.log(`[OpencodePlugin] Shell detection: ${shellPaths.length}`);
    } catch (error) {
      console.error('[OpencodePlugin] detectViaShell failed:', error);
    }
    
    // 2.3. 文件系统常见路径检测 (兜底)
    try {
      const fsPaths = await this.detectViaFilesystem();
      for (const inst of fsPaths) {
        if (!installationMap.has(inst.path)) {
          installationMap.set(inst.path, inst);
        }
      }
      console.log(`[OpencodePlugin] Filesystem detection: ${fsPaths.length}`);
    } catch (error) {
      console.error('[OpencodePlugin] detectViaFilesystem failed:', error);
    }
    
    // 3. 智能合并：新检测结果 + 缓存中仍然有效的路径
    let newInstallations = Array.from(installationMap.values()).filter(inst => inst.isValid);
    
    if (forceRefresh) {
      const cached = this.loadDetectionCache();
      if (cached && cached.length > 0) {
        console.log('[OpencodePlugin] Performing smart merge with cache...');
        newInstallations = await this.smartMerge(newInstallations, cached);
      }
    }
    
    // 4. 标记活动安装
    const config = this.getPluginConfig();
    const activeId = config.activeOpencodeId;
    
    if (activeId) {
      newInstallations = newInstallations.map(inst => ({
        ...inst,
        isActive: inst.id === activeId
      }));
    } else if (newInstallations.length > 0) {
      // No active set, auto-select the first one (prefer manual > shell > filesystem)
      newInstallations[0].isActive = true;
    }
    
    // 5. 排序：活动的优先，然后按 source 优先级
    newInstallations.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      
      const sourceOrder = { manual: 0, shell: 1, filesystem: 2 };
      return sourceOrder[a.source] - sourceOrder[b.source];
    });
    
    console.log(`[OpencodePlugin] Total installations found: ${newInstallations.length}`);
    
    // 6. 保存到持久化缓存
    this.saveDetectionCache(newInstallations);
    
    // 7. 更新内存缓存
    this._detectionCache = newInstallations;
    this._detectionCacheTime = Date.now();
    
    return newInstallations;
  }

  /**
   * 获取 OpenCode 版本
   */
  async getOpencodeVersion() {
    try {
      const activeInstallation = await this.getActiveInstallation();
      if (activeInstallation) {
        return activeInstallation.version;
      }
      
      // Fallback to old method
      const version = execSync('opencode --version', { 
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      return version;
    } catch (error) {
      console.error('[OpencodePlugin] Failed to get version:', error);
      return null;
    }
  }

  /**
   * 检查插件是否已安装
   */
  async checkPlugin() {
    try {
      const installed = await fs.pathExists(this.targetPath);
      
      let version = null;
      if (installed) {
        try {
          const packageJsonPath = path.join(this.targetPath, 'package.json');
          if (await fs.pathExists(packageJsonPath)) {
            const packageJson = await fs.readJson(packageJsonPath);
            version = packageJson.version;
          }
        } catch (error) {
          console.error('[OpencodePlugin] Failed to read plugin version:', error);
        }
      }
      
      // Check config status
      const configStatus = await this.checkPluginConfig();
      
      return {
        installed,
        path: this.targetPath,
        version: version || (installed ? 'unknown' : null),
        sourcePath: this.sourcePath,
        configEnabled: configStatus.enabled,
        configExists: configStatus.configExists,
        configValid: configStatus.configValid,
      };
    } catch (error) {
      console.error('[OpencodePlugin] Check failed:', error);
      throw error;
    }
  }

  /**
   * 读取 OpenCode 配置文件
   */
  async readOpencodeConfig() {
    try {
      if (await fs.pathExists(this.opencodeConfigPath)) {
        const configContent = await fs.readJson(this.opencodeConfigPath);
        console.log('[OpencodePlugin] OpenCode config loaded');
        return configContent;
      }
      
      // 返回默认配置
      console.log('[OpencodePlugin] OpenCode config not found, using default');
      return { "$schema": "https://opencode.ai/config.json" };
    } catch (error) {
      console.error('[OpencodePlugin] Failed to read OpenCode config:', error);
      // 如果 JSON 格式错误，也返回默认配置
      return { "$schema": "https://opencode.ai/config.json" };
    }
  }

  /**
   * 备份 OpenCode 配置文件
   */
  async backupOpencodeConfig() {
    try {
      if (!await fs.pathExists(this.opencodeConfigPath)) {
        console.log('[OpencodePlugin] No config to backup');
        return { success: true, backed: false };
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('-').slice(0, 3).join('') + '_' + new Date().toTimeString().split(' ')[0].replace(/:/g, '');
      const backupPath = `${this.opencodeConfigPath}.backup.${timestamp}`;
      
      await fs.copy(this.opencodeConfigPath, backupPath);
      console.log(`[OpencodePlugin] Config backed up to: ${backupPath}`);
      
      return { success: true, backed: true, backupPath };
    } catch (error) {
      console.error('[OpencodePlugin] Failed to backup config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 写入 OpenCode 配置文件
   */
  async writeOpencodeConfig(config) {
    try {
      // 确保目录存在
      await fs.ensureDir(path.dirname(this.opencodeConfigPath));
      
      // 写入配置
      await fs.writeJson(this.opencodeConfigPath, config, { spaces: 2 });
      console.log('[OpencodePlugin] OpenCode config written successfully');
      
      return { success: true };
    } catch (error) {
      console.error('[OpencodePlugin] Failed to write OpenCode config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查插件在配置中的状态
   */
  async checkPluginConfig() {
    try {
      const configExists = await fs.pathExists(this.opencodeConfigPath);
      
      if (!configExists) {
        return {
          success: true,
          enabled: false,
          configExists: false,
          configValid: false,
        };
      }
      
      let config;
      let configValid = true;
      
      try {
        config = await this.readOpencodeConfig();
      } catch (error) {
        configValid = false;
        return {
          success: true,
          enabled: false,
          configExists: true,
          configValid: false,
        };
      }
      
      // 检查插件是否在 plugin 数组中
      const enabled = Array.isArray(config.plugin) && config.plugin.includes(this.pluginName);
      
      return {
        success: true,
        enabled,
        configExists: true,
        configValid: true,
      };
    } catch (error) {
      console.error('[OpencodePlugin] Failed to check plugin config:', error);
      return {
        success: false,
        error: error.message,
        enabled: false,
        configExists: false,
        configValid: false,
      };
    }
  }

  /**
   * 在配置中启用插件
   */
  async enablePluginInConfig() {
    try {
      console.log('[OpencodePlugin] Enabling plugin in OpenCode config...');
      
      // 备份配置
      await this.backupOpencodeConfig();
      
      // 读取现有配置
      const config = await this.readOpencodeConfig();
      
      // 确保有 plugin 数组
      if (!config.plugin) {
        config.plugin = [];
      }
      
      // 检查插件是否已在列表中
      if (config.plugin.includes(this.pluginName)) {
        console.log('[OpencodePlugin] Plugin already enabled in config');
        return { success: true, added: false };
      }
      
      // 添加插件
      config.plugin.push(this.pluginName);
      
      // 写入配置
      const writeResult = await this.writeOpencodeConfig(config);
      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Failed to write config');
      }
      
      console.log(`[OpencodePlugin] Plugin enabled in config: ${this.pluginName}`);
      return { success: true, added: true };
    } catch (error) {
      console.error('[OpencodePlugin] Failed to enable plugin in config:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 在配置中禁用插件
   */
  async disablePluginInConfig() {
    try {
      console.log('[OpencodePlugin] Disabling plugin in OpenCode config...');
      
      // 备份配置
      await this.backupOpencodeConfig();
      
      // 读取现有配置
      const config = await this.readOpencodeConfig();
      
      if (!config.plugin || !Array.isArray(config.plugin)) {
        console.log('[OpencodePlugin] No plugin array in config');
        return { success: true, removed: false };
      }
      
      // 检查插件是否在列表中
      const index = config.plugin.indexOf(this.pluginName);
      if (index === -1) {
        console.log('[OpencodePlugin] Plugin not found in config');
        return { success: true, removed: false };
      }
      
      // 移除插件
      config.plugin.splice(index, 1);
      
      // 写入配置
      const writeResult = await this.writeOpencodeConfig(config);
      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Failed to write config');
      }
      
      console.log(`[OpencodePlugin] Plugin disabled in config: ${this.pluginName}`);
      return { success: true, removed: true };
    } catch (error) {
      console.error('[OpencodePlugin] Failed to disable plugin in config:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 打开 OpenCode 配置文件
   */
  async openOpencodeConfig() {
    try {
      // 确保配置文件存在
      if (!await fs.pathExists(this.opencodeConfigPath)) {
        // 创建默认配置
        const defaultConfig = { "$schema": "https://opencode.ai/config.json" };
        await this.writeOpencodeConfig(defaultConfig);
      }
      
      await shell.openPath(this.opencodeConfigPath);
      console.log('[OpencodePlugin] Opened OpenCode config file');
      return { success: true };
    } catch (error) {
      console.error('[OpencodePlugin] Failed to open config:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 安装插件
   */
  async installPlugin() {
    try {
      console.log('[OpencodePlugin] Installing plugin...');
      console.log('[OpencodePlugin] Source:', this.sourcePath);
      console.log('[OpencodePlugin] Target:', this.targetPath);
      
      // 检查源目录是否存在
      if (!await fs.pathExists(this.sourcePath)) {
        throw new Error(`Plugin source not found: ${this.sourcePath}`);
      }
      
      // 创建目标目录的父目录
      await fs.ensureDir(path.dirname(this.targetPath));
      
      // 如果目标已存在，先删除
      if (await fs.pathExists(this.targetPath)) {
        console.log('[OpencodePlugin] Removing existing plugin...');
        await fs.remove(this.targetPath);
      }
      
      // 复制插件文件
      console.log('[OpencodePlugin] Copying plugin files...');
      await fs.copy(this.sourcePath, this.targetPath, {
        overwrite: true,
        filter: (src) => {
          // 排除一些不必要的文件
          const basename = path.basename(src);
          return basename !== 'node_modules' && 
                 basename !== '.git' && 
                 basename !== 'test-plugin.sh' &&
                 basename !== 'install.sh';
        }
      });
      
      console.log('[OpencodePlugin] Plugin files installed successfully');
      
      // 自动启用插件配置
      console.log('[OpencodePlugin] Enabling plugin in OpenCode config...');
      const enableResult = await this.enablePluginInConfig();
      
      if (!enableResult.success) {
        console.warn('[OpencodePlugin] Plugin installed but failed to enable in config:', enableResult.error);
        return {
          success: true,
          path: this.targetPath,
          configUpdated: false,
          warning: 'Plugin installed but not automatically enabled in config. Please add manually.'
        };
      }
      
      console.log('[OpencodePlugin] Plugin installed and enabled successfully');
      
      return {
        success: true,
        path: this.targetPath,
        configUpdated: true,
        configAdded: enableResult.added,
      };
    } catch (error) {
      console.error('[OpencodePlugin] Install failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 卸载插件
   */
  async uninstallPlugin() {
    try {
      console.log('[OpencodePlugin] Uninstalling plugin...');
      
      // 先禁用配置
      console.log('[OpencodePlugin] Disabling plugin in OpenCode config...');
      await this.disablePluginInConfig();
      
      // 删除插件文件
      if (await fs.pathExists(this.targetPath)) {
        await fs.remove(this.targetPath);
        console.log('[OpencodePlugin] Plugin files removed successfully');
      }
      
      console.log('[OpencodePlugin] Plugin uninstalled successfully');
      
      return {
        success: true,
      };
    } catch (error) {
      console.error('[OpencodePlugin] Uninstall failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 在文件管理器中打开插件目录
   */
  async openPluginDirectory() {
    try {
      if (await fs.pathExists(this.targetPath)) {
        await shell.openPath(this.targetPath);
      } else {
        // 如果插件未安装，打开父目录
        const parentDir = path.dirname(this.targetPath);
        await fs.ensureDir(parentDir);
        await shell.openPath(parentDir);
      }
      return { success: true };
    } catch (error) {
      console.error('[OpencodePlugin] Failed to open directory:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 打开插件文档
   */
  async openPluginDocs() {
    try {
      const readmePath = path.join(this.targetPath, 'README.md');
      if (await fs.pathExists(readmePath)) {
        await shell.openPath(readmePath);
        return { success: true };
      } else {
        // 如果安装的插件没有 README，打开源目录的 README
        const sourceReadmePath = path.join(this.sourcePath, 'README.md');
        if (await fs.pathExists(sourceReadmePath)) {
          await shell.openPath(sourceReadmePath);
          return { success: true };
        } else {
          throw new Error('README.md not found');
        }
      }
    } catch (error) {
      console.error('[OpencodePlugin] Failed to open docs:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取插件信息（用于显示）
   */
  async getPluginInfo() {
    try {
      const checkResult = await this.checkPlugin();
      const opencodeInstalled = await this.isOpencodeInstalled();
      const opencodeVersion = await this.getOpencodeVersion();
      
      return {
        success: true,
        plugin: checkResult,
        opencode: {
          installed: opencodeInstalled,
          version: opencodeVersion,
        },
      };
    } catch (error) {
      console.error('[OpencodePlugin] Failed to get plugin info:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 设置 ConfigManager 引用
   */
  setConfigManager(configManager) {
    this.configManager = configManager;
  }

  /**
   * 获取插件配置
   */
  getPluginConfig() {
    if (!this.configManager) {
      console.warn('[OpencodePlugin] ConfigManager not set, using defaults');
      return {
        activeOpencodeId: null,
        customPaths: [],
        detectionCache: null
      };
    }
    
    const config = this.configManager.loadConfig();
    if (!config.opencodePlugin) {
      config.opencodePlugin = {
        activeOpencodeId: null,
        customPaths: [],
        detectionCache: null
      };
    }
    
    return config.opencodePlugin;
  }

  /**
   * 保存插件配置
   */
  savePluginConfig(pluginConfig) {
    if (!this.configManager) {
      console.error('[OpencodePlugin] ConfigManager not set, cannot save config');
      return;
    }
    
    const config = this.configManager.loadConfig();
    config.opencodePlugin = pluginConfig;
    this.configManager.saveConfig(config);
  }

  /**
   * 获取当前活动的 OpenCode 安装
   */
  async getActiveInstallation() {
    const installations = await this.detectAllInstallations();
    const active = installations.find(inst => inst.isActive);
    
    if (!active && installations.length > 0) {
      // Auto-select first one if none active
      installations[0].isActive = true;
      await this.setActiveInstallation(installations[0].id);
      return installations[0];
    }
    
    return active || null;
  }

  /**
   * 设置活动的 OpenCode 安装
   */
  async setActiveInstallation(installationId) {
    const installations = await this.detectAllInstallations();
    const installation = installations.find(inst => inst.id === installationId);
    
    if (!installation) {
      throw new Error(`Installation not found: ${installationId}`);
    }
    
    // Update config
    const config = this.getPluginConfig();
    config.activeOpencodeId = installationId;
    this.savePluginConfig(config);
    
    // Update target path for plugin installation
    this.targetPath = installation.pluginDir;
    
    // Clear cache to force refresh
    this._detectionCache = null;
    this._detectionCacheTime = null;
    
    console.log(`[OpencodePlugin] Active installation set to: ${installation.path}`);
    
    return installation;
  }

  /**
   * 添加自定义路径
   */
  async addCustomPath(customPath) {
    // Validate path first
    const installation = await this.validateOpencodeInstallation(customPath);
    if (!installation) {
      throw new Error('Invalid OpenCode path or not executable');
    }
    
    installation.source = 'manual';
    
    // Add to config
    const config = this.getPluginConfig();
    if (!config.customPaths) {
      config.customPaths = [];
    }
    
    // Check if already exists
    if (config.customPaths.includes(customPath)) {
      throw new Error('Path already added');
    }
    
    config.customPaths.push(customPath);
    this.savePluginConfig(config);
    
    // Clear cache
    this._detectionCache = null;
    this._detectionCacheTime = null;
    
    console.log(`[OpencodePlugin] Custom path added: ${customPath}`);
    
    return installation;
  }

  /**
   * 移除自定义路径
   */
  async removeCustomPath(customPath) {
    const config = this.getPluginConfig();
    if (!config.customPaths) {
      config.customPaths = [];
    }
    
    const index = config.customPaths.indexOf(customPath);
    if (index === -1) {
      throw new Error('Path not found in custom paths');
    }
    
    config.customPaths.splice(index, 1);
    
    // If this was the active installation, clear it
    const installations = await this.detectAllInstallations();
    const installation = installations.find(inst => inst.path === customPath);
    if (installation && installation.isActive) {
      config.activeOpencodeId = null;
    }
    
    this.savePluginConfig(config);
    
    // Clear cache
    this._detectionCache = null;
    this._detectionCacheTime = null;
    
    console.log(`[OpencodePlugin] Custom path removed: ${customPath}`);
  }
}

module.exports = OpencodePluginManager;
