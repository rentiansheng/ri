const os = require('os');
const path = require('path');
const pty = require('node-pty');
const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const EventEmitter = require('events');
const SessionLogger = require('./sessionLogger.cjs');

class TerminalManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this._terms = new Map();
    this._nextId = 1;
    this._sessionLogger = new SessionLogger(config);
    
    // Run cleanup every 24 hours
    setInterval(() => {
      this._sessionLogger.cleanupOldLogs();
    }, 24 * 60 * 60 * 1000);
  }
  
  /**
   * Apply configuration changes (hot reload)
   * @param {Object} config - New configuration
   */
  applyConfig(config) {
    this._sessionLogger.applyConfig(config);
    console.log('[TerminalManager] Config applied');
  }

  create({ taskId, cwd, sessionName, sessionId } = {}) {
    const id = String(this._nextId++);

    // Use absolute path to shell
    const shell = '/bin/zsh';
    
    // Build minimal but complete environment
    const envVars = {
      HOME: os.homedir(),
      USER: process.env.USER || os.userInfo().username,
      SHELL: shell,
      PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin',
      LANG: 'zh_CN.UTF-8',
      LC_ALL: 'zh_CN.UTF-8',
      TERM: 'xterm-256color',
      TMPDIR: os.tmpdir(),
    };

    // Inject RI environment variables for OpenCode plugin detection
    envVars.RI_TERMINAL = 'true';
    envVars.RI_SESSION_ID = sessionId || id;  // Always set, with terminal id as fallback
    envVars.RI_SESSION_NAME = sessionName || 'Terminal';  // Always set, with fallback name
    
    // Also set legacy RISESSION variable for backward compatibility
    if (sessionId) {
      envVars.RISESSION = sessionId;
    }
    
    const workingDir = cwd || envVars.HOME;
    
    try {
      const term = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: workingDir,
        env: envVars,
      });
      
      const entry = {
        id,
        taskId: taskId || undefined,
        sessionId: sessionId || undefined,
        sessionName: sessionName || undefined,
        hidden: false,
        pty: term,
      };
      
      this._terms.set(id, entry);
      return entry;
    } catch (error) {
      // If zsh fails, try bash
      const bashShell = '/bin/bash';
      const bashEnvVars = { ...envVars, SHELL: bashShell };
      
      const term = pty.spawn(bashShell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: workingDir,
        env: bashEnvVars,
      });

      const entry = {
        id,
        taskId: taskId || undefined,
        sessionId: sessionId || undefined,
        sessionName: sessionName || undefined,
        hidden: false,
        pty: term,
      };

      this._terms.set(id, entry);
      return entry;
    }
  }

  get(id) {
    return this._terms.get(id);
  }

  write(id, data) {
    const t = this._terms.get(id);
    if (!t) return;
    t.pty.write(data);
    
    // Log user input if sessionId is available
    if (t.sessionId) {
      try {
        this._sessionLogger.logInteraction(t.sessionId, data);
      } catch (error) {
        console.error('[TerminalManager] Error logging input:', error);
      }
    }
  }
  
  /**
   * Write data to terminal and log the interaction (deprecated - use write instead)
   */
  writeAndLog(id, data) {
    this.write(id, data);
  }
  
  /**
   * Log terminal output (called when terminal emits data)
   */
  logOutput(id, data) {
    const t = this._terms.get(id);
    if (!t) return;
    
    this.parseForNotifications(id, data);
    this.parseForViewCommand(id, data);
    
    this.emit('terminal-output', {
      terminalId: id,
      sessionId: t.sessionId,
      sessionName: t.sessionName,
      data
    });

    if (!t.sessionId) return;
    
    try {
      this._sessionLogger.logInteraction(t.sessionId, data);
    } catch (error) {
      console.error('[TerminalManager] Error logging output:', error);
    }
  }

  /**
   * Parse terminal output for notification triggers
   * Format: __OM_NOTIFY:type:message__
   * Example: __OM_NOTIFY:completed:Task finished successfully__
   */
  parseForNotifications(id, data) {
    // Regex for both visible (old) and invisible (OSC) magic strings
    // 1. OSC (Invisible): \x1b]__OM_NOTIFY:type:message__\x07
    // 2. Visible: __OM_NOTIFY:type:message__
    
    const oscRegex = /\x1b\]__OM_NOTIFY:([a-zA-Z0-9_-]+):(.+?)__\x07/g;
    const visibleRegex = /__OM_NOTIFY:([a-zA-Z0-9_-]+):(.+?)__/g;

    const t = this._terms.get(id);
    const notifications = new Set(); // 用 Set 去重
    
    let match;
    
    // Check for OSC sequences (preferred)
    while ((match = oscRegex.exec(data)) !== null) {
      const key = `${match[1]}:${match[2]}`;
      notifications.add(key);
    }

    // Check for visible sequences (fallback/legacy)
    // 只有在没有找到 OSC 序列时才检查可见序列
    if (notifications.size === 0) {
      while ((match = visibleRegex.exec(data)) !== null) {
        const key = `${match[1]}:${match[2]}`;
        notifications.add(key);
      }
    }
    
    // 发送所有去重后的通知
    for (const key of notifications) {
      const [type, message] = key.split(':');
      this.emit('terminal-notification', {
        sessionId: t ? t.sessionId : undefined,
        sessionName: t ? t.sessionName : undefined,
        terminalId: id,
        type,
        message
      });
      console.log(`[TerminalManager] Detected notification signal: ${type} - ${message}`);
    }
  }

  /**
   * Parse terminal output for view file triggers
   * Format (OSC invisible): \x1b]__RI_VIEW:/path/to/file__\x07
   * Format (visible): __RI_VIEW:/path/to/file__
   * 
   * This allows AI CLIs (like OpenCode) and shell scripts to trigger
   * file viewing in RI by printing this magic string.
   */
  parseForViewCommand(id, data) {
    // Regex for both visible (old) and invisible (OSC) magic strings
    // 1. OSC (Invisible): \x1b]__RI_VIEW:/path__\x07
    // 2. Visible: __RI_VIEW:/path__
    
    const oscRegex = /\x1b\]__RI_VIEW:(.+?)__\x07/g;
    const visibleRegex = /__RI_VIEW:(.+?)__/g;

    const t = this._terms.get(id);
    const filePaths = new Set(); // Deduplicate file paths
    
    let match;
    
    // Check for OSC sequences (preferred - invisible to user)
    while ((match = oscRegex.exec(data)) !== null) {
      filePaths.add(match[1].trim());
    }

    // Check for visible sequences (fallback/legacy)
    // Only if no OSC sequences found
    if (filePaths.size === 0) {
      while ((match = visibleRegex.exec(data)) !== null) {
        filePaths.add(match[1].trim());
      }
    }
    
    // Emit events for each unique file path
    for (const filePath of filePaths) {
      this.emit('terminal-view-file', {
        sessionId: t ? t.sessionId : undefined,
        sessionName: t ? t.sessionName : undefined,
        terminalId: id,
        filePath
      });
      console.log(`[TerminalManager] Detected view file signal: ${filePath}`);
    }
  }

  /**
   * Get session name by terminal ID
   */
  getSessionName(id) {
    const t = this._terms.get(id);
    return t ? t.sessionName : null;
  }

  /**
   * Get session name by session ID
   */
  getSessionNameBySessionId(sessionId) {
    for (const [, entry] of this._terms) {
      if (entry.sessionId === sessionId) {
        return entry.sessionName;
      }
    }
    return null;
  }

  /**
   * Update session name for a terminal
   * @param {string} sessionId - The session ID
   * @param {string} sessionName - The new session name
   */
  updateSessionName(sessionId, sessionName) {
    for (const [, entry] of this._terms) {
      if (entry.sessionId === sessionId) {
        entry.sessionName = sessionName;
        console.log(`[TerminalManager] Updated session name for ${sessionId} to "${sessionName}"`);
        return true;
      }
    }
    console.warn(`[TerminalManager] Session ${sessionId} not found for name update`);
    return false;
  }

  resize(id, cols, rows) {
    const t = this._terms.get(id);
    if (!t) return;
    t.pty.resize(cols, rows);
  }

  hide(id) {
    const t = this._terms.get(id);
    if (!t) return;
    t.hidden = true;
  }

  show(id) {
    const t = this._terms.get(id);
    if (!t) return;
    t.hidden = false;
  }

  dispose(id) {
    const t = this._terms.get(id);
    if (!t) return;
    
    const pid = t.pty.pid;
    console.log(`[TerminalManager] Disposing terminal ${id} with PID ${pid}`);
    
    try {
      // Kill the entire process tree
      if (process.platform !== 'win32') {
        // On Unix-like systems (macOS, Linux)
        try {
          // Use pkill to kill all descendants
          // -P flag kills all children of the specified parent process
          try {
            execSync(`pkill -TERM -P ${pid}`, { stdio: 'ignore' });
            console.log(`[TerminalManager] Sent SIGTERM to children of PID ${pid}`);
          } catch (e) {
            // No children or already terminated, that's OK
          }
          
          // Try to kill the process group
          try {
            process.kill(-pid, 'SIGTERM');
            console.log(`[TerminalManager] Sent SIGTERM to process group -${pid}`);
          } catch (e) {
            // Process group may not exist
          }
          
          // Kill the main PTY process
          try {
            process.kill(pid, 'SIGTERM');
            console.log(`[TerminalManager] Sent SIGTERM to PID ${pid}`);
          } catch (e) {
            // Already dead
          }
          
          // Wait a bit, then force kill everything
          setTimeout(() => {
            try {
              execSync(`pkill -KILL -P ${pid}`, { stdio: 'ignore' });
            } catch (e) {}
            
            try {
              process.kill(-pid, 'SIGKILL');
            } catch (e) {}
            
            try {
              process.kill(pid, 'SIGKILL');
            } catch (e) {}
            
            console.log(`[TerminalManager] Sent SIGKILL to process tree ${pid}`);
          }, 500);
          
        } catch (error) {
          console.error(`[TerminalManager] Error killing process tree for terminal ${id}:`, error);
          // Fallback to killing just the PTY process
          t.pty.kill();
        }
      } else {
        // On Windows, use taskkill to kill the process tree
        try {
          execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
          console.log(`[TerminalManager] Killed Windows process tree ${pid}`);
        } catch (error) {
          console.error(`[TerminalManager] Error killing process tree for terminal ${id}:`, error);
          // Fallback to killing just the PTY process
          t.pty.kill();
        }
      }
      
      // Also call PTY's kill method as a final cleanup
      try {
        t.pty.kill();
      } catch (e) {
        // Already killed
      }
      
    } catch (error) {
      console.error(`[TerminalManager] Error in dispose for terminal ${id}:`, error);
    } finally {
      this._terms.delete(id);
      // Note: We don't delete the log file here, so it persists after session deletion
      // Use deleteSessionLog() explicitly if you want to remove logs
    }
  }
  
  /**
   * Delete session log file
   */
  deleteSessionLog(sessionId) {
    this._sessionLogger.deleteLog(sessionId);
  }
  
  /**
   * Read session log
   */
  readSessionLog(sessionId, limit = null) {
    return this._sessionLogger.readLog(sessionId, limit);
  }
  
  /**
   * Get session log statistics
   */
  getSessionLogStats(sessionId) {
    return this._sessionLogger.getLogStats(sessionId);
  }

  disposeAll() {
    console.log('[TerminalManager] Disposing all terminals...');
    const ids = Array.from(this._terms.keys());
    
    for (const id of ids) {
      try {
        this.dispose(id);
      } catch (error) {
        console.error(`[TerminalManager] Error disposing terminal ${id}:`, error);
      }
    }
    
    // Clean up session logger resources
    this._sessionLogger.cleanup();
    
    console.log(`[TerminalManager] Disposed ${ids.length} terminals`);
  }

  async getProcessInfo(id) {
    const term = this._terms.get(id);
    if (!term) return null;
    
    const shellPid = term.pty.pid;
    
    try {
      // 获取进程组的所有子进程
      // -o: 指定输出格式 (pid, ppid, comm, state)
      // -g: 进程组 ID
      const cmd = `ps -o pid,ppid,comm,state -g ${shellPid}`;
      const { stdout: output } = await execAsync(cmd);
      
      // 解析输出
      const lines = output.trim().split('\n').slice(1); // 跳过标题行
      const processes = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parseInt(parts[0]),
          ppid: parseInt(parts[1]),
          comm: parts[2],
          state: parts[3],
        };
      });
      
      // 获取当前工作目录
      let cwd = null;
      try {
        if (process.platform === 'darwin') {
          // macOS: lsof outputs 'fcwd' on one line and path on next line starting with 'n'
          const { stdout: cwdOutput } = await execAsync(`lsof -p ${shellPid} -Fn 2>/dev/null | awk '/^fcwd/{getline; print substr($0,2)}'`);
          cwd = cwdOutput.trim() || null;
        } else if (process.platform === 'linux') {
          // Linux: use /proc filesystem
          const { stdout: linuxCwd } = await execAsync(`readlink -f /proc/${shellPid}/cwd`);
          cwd = linuxCwd.trim() || null;
        } else {
          // Fallback for other platforms
          const { stdout: cwdOutput } = await execAsync(`lsof -p ${shellPid} -Fn 2>/dev/null | awk '/^fcwd/{getline; print substr($0,2)}'`);
          cwd = cwdOutput.trim() || null;
        }
      } catch (e) {
        console.error(`[TerminalManager] Error getting cwd for PID ${shellPid}:`, e.message);
      }
      
      return {
        shellPid,
        processes,
        cwd,
      };
    } catch (error) {
      console.error(`[TerminalManager] Error getting process info for ${id}:`, error);
      return {
        shellPid,
        processes: [],
        cwd: null,
      };
    }
  }
}

module.exports = { TerminalManager };
