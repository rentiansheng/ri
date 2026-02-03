/**
 * OpenCode Plugin Manager
 * 管理 OpenCode RI 通知插件的安装、检测和更新
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { shell } = require('electron');
const { execSync } = require('child_process');

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
  }

  /**
   * 检查 OpenCode 是否已安装
   */
  async isOpencodeInstalled() {
    try {
      execSync('which opencode', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取 OpenCode 版本
   */
  async getOpencodeVersion() {
    try {
      const version = execSync('opencode --version', { encoding: 'utf-8' }).trim();
      return version;
    } catch (error) {
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
      
      return {
        installed,
        path: this.targetPath,
        version: version || (installed ? 'unknown' : null),
        sourcePath: this.sourcePath,
      };
    } catch (error) {
      console.error('[OpencodePlugin] Check failed:', error);
      throw error;
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
      
      console.log('[OpencodePlugin] Plugin installed successfully');
      
      return {
        success: true,
        path: this.targetPath,
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
      
      if (await fs.pathExists(this.targetPath)) {
        await fs.remove(this.targetPath);
        console.log('[OpencodePlugin] Plugin uninstalled successfully');
      }
      
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
}

module.exports = OpencodePluginManager;
