const { spawn } = require('child_process');
const EventEmitter = require('events');

/**
 * OpenCode Manager
 * Manages OpenCode server and web processes
 */
class OpencodeManager extends EventEmitter {
  constructor() {
    super();
    
    // Process instances
    this.serverProcess = null;
    this.webProcess = null;
    
    // Process status
    this.status = {
      serverRunning: false,
      webRunning: false,
      serverPid: null,
      webPid: null,
      serverPort: null,
      webPort: null,
      lastError: null
    };
    
    // Log storage (keep last 100 entries)
    this.logs = [];
    this.MAX_LOGS = 100;
    
    // Config
    this.config = null;
    
    // Port detection timeouts
    this.serverPortTimeout = null;
    this.webPortTimeout = null;
    this.PORT_DETECTION_TIMEOUT = 10000; // 10 seconds
  }
  
  /**
   * Set configuration
   */
  setConfig(config) {
    this.config = config;
  }
  
  /**
   * Add log entry
   */
  addLog(service, level, message) {
    const logEntry = {
      timestamp: Date.now(),
      service,
      level,
      message: message.trim()
    };
    
    this.logs.push(logEntry);
    
    // Rotate logs if exceeding max
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }
    
    // Emit log event
    this.emit('log', logEntry);
    
    console.log(`[OpenCode ${service.toUpperCase()}] ${message}`);
  }
  
  /**
   * Update status and emit change event
   */
  updateStatus(updates) {
    const oldStatus = { ...this.status };
    this.status = { ...this.status, ...updates };
    
    // Only emit if status actually changed
    if (JSON.stringify(oldStatus) !== JSON.stringify(this.status)) {
      this.emit('status-change', this.status);
      console.log('[OpencodeManager] Status updated:', this.status);
    }
  }
  
  /**
   * Parse OpenCode output to detect port
   */
  parsePortFromOutput(output) {
    // Look for common port patterns in OpenCode output
    // Examples: "Server listening on port 3000", "localhost:3000", "http://localhost:3000"
    const patterns = [
      /(?:port|Port|PORT)\s+(\d+)/,
      /localhost:(\d+)/,
      /127\.0\.0\.1:(\d+)/,
      /0\.0\.0\.0:(\d+)/,
      /:\s*(\d+)/
    ];
    
    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match && match[1]) {
        const port = parseInt(match[1], 10);
        if (port > 1000 && port < 65536) {
          return port;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Start OpenCode server
   */
  async startServer() {
    if (this.serverProcess) {
      this.addLog('server', 'info', 'Server already running');
      return { success: false, error: 'Server already running' };
    }
    
    try {
      this.addLog('server', 'info', 'Starting OpenCode server...');
      
      const logLevel = (this.config?.opencode?.logLevel || 'INFO').toUpperCase();
      const args = ['serve', '--port', '0', '--print-logs', '--log-level', logLevel];
      
      this.serverProcess = spawn('opencode', args, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      const pid = this.serverProcess.pid;
      
      this.updateStatus({
        serverRunning: true,
        serverPid: pid,
        lastError: null
      });
      
      this.addLog('server', 'info', `Server process started (PID: ${pid})`);
      
      // Set up port detection timeout
      this.serverPortTimeout = setTimeout(() => {
        if (!this.status.serverPort) {
          this.addLog('server', 'info', 'Port detection timeout - server may be running but port unknown');
        }
      }, this.PORT_DETECTION_TIMEOUT);
      
      // Handle stdout (logs and port detection)
      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        const lines = output.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          this.addLog('server', 'info', line);
          
          // Try to detect port
          if (!this.status.serverPort) {
            const port = this.parsePortFromOutput(line);
            if (port) {
              this.updateStatus({ serverPort: port });
              this.addLog('server', 'info', `Detected server port: ${port}`);
              
              // Clear timeout
              if (this.serverPortTimeout) {
                clearTimeout(this.serverPortTimeout);
                this.serverPortTimeout = null;
              }
            }
          }
        });
      });
      
      // Handle stderr (errors)
      this.serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        const lines = output.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          this.addLog('server', 'error', line);
        });
      });
      
      // Handle process exit
      this.serverProcess.on('exit', (code, signal) => {
        const message = signal 
          ? `Server stopped (signal: ${signal})`
          : `Server exited (code: ${code})`;
        
        this.addLog('server', code === 0 ? 'info' : 'error', message);
        
        this.updateStatus({
          serverRunning: false,
          serverPid: null,
          serverPort: null,
          lastError: code !== 0 ? message : null
        });
        
        this.serverProcess = null;
        
        // Clear timeout
        if (this.serverPortTimeout) {
          clearTimeout(this.serverPortTimeout);
          this.serverPortTimeout = null;
        }
        
        // Auto-restart if enabled
        if (this.config?.opencode?.autoRestart && code !== 0) {
          this.addLog('server', 'info', 'Auto-restarting server in 5 seconds...');
          setTimeout(() => this.startServer(), 5000);
        }
      });
      
      // Handle process error
      this.serverProcess.on('error', (error) => {
        this.addLog('server', 'error', `Failed to start server: ${error.message}`);
        this.updateStatus({
          serverRunning: false,
          serverPid: null,
          serverPort: null,
          lastError: error.message
        });
        this.serverProcess = null;
      });
      
      return { success: true };
    } catch (error) {
      this.addLog('server', 'error', `Failed to start server: ${error.message}`);
      this.updateStatus({
        serverRunning: false,
        serverPid: null,
        serverPort: null,
        lastError: error.message
      });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Start OpenCode web
   */
  async startWeb() {
    if (this.webProcess) {
      this.addLog('web', 'info', 'Web already running');
      return { success: false, error: 'Web already running' };
    }
    
    try {
      this.addLog('web', 'info', 'Starting OpenCode web...');
      
      const logLevel = (this.config?.opencode?.logLevel || 'INFO').toUpperCase();
      const args = ['web', '--port', '0', '--print-logs', '--log-level', logLevel];
      
      this.webProcess = spawn('opencode', args, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      const pid = this.webProcess.pid;
      
      this.updateStatus({
        webRunning: true,
        webPid: pid,
        lastError: null
      });
      
      this.addLog('web', 'info', `Web process started (PID: ${pid})`);
      
      // Set up port detection timeout
      this.webPortTimeout = setTimeout(() => {
        if (!this.status.webPort) {
          this.addLog('web', 'info', 'Port detection timeout - web may be running but port unknown');
        }
      }, this.PORT_DETECTION_TIMEOUT);
      
      // Handle stdout (logs and port detection)
      this.webProcess.stdout.on('data', (data) => {
        const output = data.toString();
        const lines = output.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          this.addLog('web', 'info', line);
          
          // Try to detect port
          if (!this.status.webPort) {
            const port = this.parsePortFromOutput(line);
            if (port) {
              this.updateStatus({ webPort: port });
              this.addLog('web', 'info', `Detected web port: ${port}`);
              
              // Clear timeout
              if (this.webPortTimeout) {
                clearTimeout(this.webPortTimeout);
                this.webPortTimeout = null;
              }
            }
          }
        });
      });
      
      // Handle stderr (errors)
      this.webProcess.stderr.on('data', (data) => {
        const output = data.toString();
        const lines = output.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          this.addLog('web', 'error', line);
        });
      });
      
      // Handle process exit
      this.webProcess.on('exit', (code, signal) => {
        const message = signal 
          ? `Web stopped (signal: ${signal})`
          : `Web exited (code: ${code})`;
        
        this.addLog('web', code === 0 ? 'info' : 'error', message);
        
        this.updateStatus({
          webRunning: false,
          webPid: null,
          webPort: null,
          lastError: code !== 0 ? message : null
        });
        
        this.webProcess = null;
        
        // Clear timeout
        if (this.webPortTimeout) {
          clearTimeout(this.webPortTimeout);
          this.webPortTimeout = null;
        }
        
        // Auto-restart if enabled
        if (this.config?.opencode?.autoRestart && code !== 0) {
          this.addLog('web', 'info', 'Auto-restarting web in 5 seconds...');
          setTimeout(() => this.startWeb(), 5000);
        }
      });
      
      // Handle process error
      this.webProcess.on('error', (error) => {
        this.addLog('web', 'error', `Failed to start web: ${error.message}`);
        this.updateStatus({
          webRunning: false,
          webPid: null,
          webPort: null,
          lastError: error.message
        });
        this.webProcess = null;
      });
      
      return { success: true };
    } catch (error) {
      this.addLog('web', 'error', `Failed to start web: ${error.message}`);
      this.updateStatus({
        webRunning: false,
        webPid: null,
        webPort: null,
        lastError: error.message
      });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Stop OpenCode server
   */
  async stopServer() {
    if (!this.serverProcess) {
      this.addLog('server', 'info', 'Server not running');
      return;
    }
    
    try {
      this.addLog('server', 'info', 'Stopping server...');
      this.serverProcess.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (this.serverProcess) {
          this.addLog('server', 'info', 'Force killing server...');
          this.serverProcess.kill('SIGKILL');
        }
      }, 5000);
    } catch (error) {
      this.addLog('server', 'error', `Failed to stop server: ${error.message}`);
    }
  }
  
  /**
   * Stop OpenCode web
   */
  async stopWeb() {
    if (!this.webProcess) {
      this.addLog('web', 'info', 'Web not running');
      return;
    }
    
    try {
      this.addLog('web', 'info', 'Stopping web...');
      this.webProcess.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (this.webProcess) {
          this.addLog('web', 'info', 'Force killing web...');
          this.webProcess.kill('SIGKILL');
        }
      }, 5000);
    } catch (error) {
      this.addLog('web', 'error', `Failed to stop web: ${error.message}`);
    }
  }
  
  /**
   * Stop all OpenCode processes
   */
  async stopAll() {
    this.addLog('system', 'info', 'Stopping all OpenCode processes...');
    await Promise.all([
      this.stopServer(),
      this.stopWeb()
    ]);
  }
  
  /**
   * Get current status
   */
  getStatus() {
    return { ...this.status };
  }
  
  /**
   * Get logs
   */
  getLogs() {
    return [...this.logs];
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    this.stopAll();
    
    // Clear timeouts
    if (this.serverPortTimeout) {
      clearTimeout(this.serverPortTimeout);
    }
    if (this.webPortTimeout) {
      clearTimeout(this.webPortTimeout);
    }
    
    this.removeAllListeners();
    console.log('[OpencodeManager] Cleaned up resources');
  }
}

module.exports = OpencodeManager;
