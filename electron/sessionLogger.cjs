const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Output classifier - detects and categorizes terminal output
 */
class OutputClassifier {
  constructor() {
    this.interactiveMode = false;
    this.lastCommandTime = 0;
  }
  
  /**
   * Strip basic ANSI codes for classification
   */
  stripBasicAnsi(text) {
    return text
      .replace(/\x1b\[[^m]*m/g, '')
      .replace(/\x1b\[[\d;?]*[A-Za-z]/g, '')
      .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\r/g, '');
  }
  
  /**
   * Check if output is a command prompt
   */
  isPrompt(data) {
    const cleaned = this.stripBasicAnsi(data).trim();
    if (cleaned.length === 0 || cleaned.length > 200) return false;
    
    const patterns = [
      /^[\w-]+@[\w-]+:[~\w/.-]*[$#%>]\s*$/,  // user@host:path$
      /^[➜❯λ►▶]\s*$/,  // Modern prompts
      /^\(\w+\)\s*[$#%]\s*$/,  // (venv) $
      /^.*[$#%>]\s*$/,  // Generic ending with $ # % >
    ];
    return patterns.some(p => p.test(cleaned));
  }
  
  /**
   * Check if interactive application is starting
   */
  isInteractiveStart(data) {
    return (
      /\x1b\[\?1049h/.test(data) ||  // Alternate screen mode
      /\x1b\[2J\x1b\[H/.test(data) ||  // Clear screen and home
      /\x1b\[\?25l/.test(data) && /\x1b\[\d+;\d+H/.test(data)  // Hide cursor + positioning
    );
  }
  
  /**
   * Check if interactive application is ending
   */
  isInteractiveEnd(data) {
    return /\x1b\[\?1049l/.test(data);
  }
  
  /**
   * Check if output is a command
   */
  isCommand(data) {
    const cleaned = this.stripBasicAnsi(data).trim();
    
    // Length checks
    if (cleaned.length === 0 || cleaned.length > 500) return false;
    if (/^\s*$/.test(cleaned)) return false;
    
    // Common command patterns
    const commonCommands = [
      'ls', 'cd', 'pwd', 'echo', 'cat', 'grep', 'find', 'vim', 'vi', 'nano',
      'git', 'npm', 'yarn', 'pnpm', 'node', 'python', 'python3', 'pip', 
      'cargo', 'go', 'rustc', 'gcc', 'make', 'cmake',
      'docker', 'kubectl', 'curl', 'wget', 'ssh', 'scp', 'rsync',
      'mkdir', 'touch', 'rm', 'cp', 'mv', 'chmod', 'chown', 'ln',
      'tar', 'gzip', 'zip', 'unzip', 'sudo', 'su', 'exit'
    ];
    
    const firstWord = cleaned.split(/\s+/)[0];
    return commonCommands.includes(firstWord) || /^[./~]/.test(cleaned);
  }
  
  /**
   * Classify terminal output
   */
  classify(data) {
    // Interactive mode detection
    if (this.isInteractiveStart(data)) {
      this.interactiveMode = true;
      return { type: 'interactive', shouldLog: false };
    }
    
    if (this.interactiveMode) {
      if (this.isInteractiveEnd(data)) {
        this.interactiveMode = false;
      }
      return { type: 'interactive', shouldLog: false };
    }
    
    // Prompt detection
    if (this.isPrompt(data)) {
      return { type: 'prompt', shouldLog: false };
    }
    
    // Command detection
    if (this.isCommand(data)) {
      this.lastCommandTime = Date.now();
      return { type: 'command', shouldLog: true };
    }
    
    // Output detection
    const cleaned = this.stripBasicAnsi(data).trim();
    if (cleaned.length > 0) {
      // Output within 10 seconds after command is considered command output
      const timeSinceCommand = Date.now() - this.lastCommandTime;
      if (timeSinceCommand < 10000) {
        return { type: 'output', shouldLog: true };
      }
    }
    
    // Default: noise, don't log
    return { type: 'noise', shouldLog: false };
  }
}

class SessionLogger {
  constructor(config = {}) {
    // Store logs in app's user data directory
    const logsDirectory = config.history?.logsDirectory || 'session-logs';
    this.logsDir = path.join(app.getPath('userData'), logsDirectory);
    this.ensureLogsDirectory();
    
    // Configuration (can be updated via applyConfig)
    this.MAX_RECORDS = config.history?.maxRecordsPerFile || 1000;
    this.RETENTION_DAYS = config.history?.retentionDays || 30;
    this.RETENTION_MS = this.RETENTION_DAYS * 24 * 60 * 60 * 1000;
    this.TRIM_DEBOUNCE_MS = config.history?.trimDebounceMs || 30000;
    this.enableFiltering = config.history?.enableFiltering !== false;
    
    // Track record counts to avoid reading files frequently
    this.recordCounts = new Map();
    
    // Debounce trim operations
    this.trimTimers = new Map();
    
    // Maintain classifier per session
    this.classifiers = new Map();

    // Tier 3 Optimization: Async Memory Buffers
    this.logBuffers = new Map(); // sessionId -> record[]
    this.MAX_BUFFER_SIZE = 1000; // Drop records if buffer exceeds this
    this.FLUSH_INTERVAL_MS = 5000; // Flush to disk every 5s
    
    // Start periodic flush
    this.flushTimer = setInterval(() => this.flushAllBuffers(), this.FLUSH_INTERVAL_MS);
    
    console.log('[SessionLogger] Initialized with Tier 3 Optimization (Lossy Async Buffering)');
  }
  
  /**
   * Flush all session buffers to disk
   */
  flushAllBuffers() {
    for (const sessionId of this.logBuffers.keys()) {
      this.flushSessionBuffer(sessionId);
    }
  }

  /**
   * Flush specific session buffer to disk asynchronously
   */
  async flushSessionBuffer(sessionId) {
    const buffer = this.logBuffers.get(sessionId);
    if (!buffer || buffer.length === 0) return;

    this.logBuffers.delete(sessionId);
    const logFile = this.getLogFilePath(sessionId);
    
    // Tier 4: 批量处理分类和 ANSI 清理，将正则运算移出实时路径
    const classifier = this.enableFiltering ? this.getClassifier(sessionId) : null;
    const lines = [];
    
    for (const record of buffer) {
      if (this.enableFiltering && classifier) {
        const { type, shouldLog } = classifier.classify(record.data);
        if (!shouldLog) continue;
        
        const cleaned = classifier.stripBasicAnsi(record.data).trim();
        if (cleaned.length < 2) continue;
        
        lines.push(JSON.stringify({
          timestamp: record.timestamp,
          type: type,
          data: record.data,
          cleaned: cleaned
        }) + '\n');
      } else {
        lines.push(JSON.stringify({
          timestamp: record.timestamp,
          data: record.data
        }) + '\n');
      }
    }

    if (lines.length === 0) return;

    fs.appendFile(logFile, lines.join(''), 'utf8', (err) => {
      if (err) console.error(`[SessionLogger] Async flush failed for ${sessionId}:`, err);
    });

    // 更新计数并调度清理
    const currentCount = this.recordCounts.get(sessionId) || 0;
    this.recordCounts.set(sessionId, currentCount + lines.length);
    this.scheduleTrim(sessionId);
  }

  /**
   * Apply configuration changes (hot reload)
   * @param {Object} config - New configuration
   */
  applyConfig(config) {
    // Update configurable settings
    this.MAX_RECORDS = config.history?.maxRecordsPerFile || 1000;
    this.RETENTION_DAYS = config.history?.retentionDays || 30;
    this.RETENTION_MS = this.RETENTION_DAYS * 24 * 60 * 60 * 1000;
    this.TRIM_DEBOUNCE_MS = config.history?.trimDebounceMs || 30000;
    this.enableFiltering = config.history?.enableFiltering !== false;
    
    console.log('[SessionLogger] Config applied:', {
      maxRecords: this.MAX_RECORDS,
      retentionDays: this.RETENTION_DAYS,
      trimDebounceMs: this.TRIM_DEBOUNCE_MS,
      enableFiltering: this.enableFiltering
    });
  }
  
  /**
   * Schedule trim operation for a session (debounced)
   * @param {string} sessionId - Session ID
   */
  scheduleTrim(sessionId) {
    // Clear existing timer if any
    if (this.trimTimers && this.trimTimers.has(sessionId)) {
      clearTimeout(this.trimTimers.get(sessionId));
    }
    
    // Initialize trimTimers map if not exists
    if (!this.trimTimers) {
      this.trimTimers = new Map();
    }
    
    // Schedule new trim operation
    const timer = setTimeout(() => {
      this.trimLogFile(sessionId);
      this.trimTimers.delete(sessionId);
    }, this.TRIM_DEBOUNCE_MS || 30000);
    
    this.trimTimers.set(sessionId, timer);
  }
  
  /**
   * Trim log file to max records
   * @param {string} sessionId - Session ID
   */
  trimLogFile(sessionId) {
    try {
      const logPath = this.getLogFilePath(sessionId);
      if (!fs.existsSync(logPath)) return;
      
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      
      if (lines.length <= this.MAX_RECORDS) return;
      
      // Keep only the most recent MAX_RECORDS
      const trimmed = lines.slice(-this.MAX_RECORDS);
      fs.writeFileSync(logPath, trimmed.join('\n') + '\n', 'utf8');
      
      console.log(`[SessionLogger] Trimmed ${sessionId} from ${lines.length} to ${trimmed.length} records`);
    } catch (error) {
      console.error(`[SessionLogger] Failed to trim ${sessionId}:`, error);
    }
  }
  
  /**
   * Get or create classifier for session
   * @param {string} sessionId - Session ID
   * @returns {OutputClassifier} Classifier instance
   */
  getClassifier(sessionId) {
    if (!this.classifiers.has(sessionId)) {
      this.classifiers.set(sessionId, new OutputClassifier());
    }
    return this.classifiers.get(sessionId);
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  getLogFilePath(sessionId) {
    return path.join(this.logsDir, `${sessionId}.jsonl`);
  }

  /**
   * Append interaction record to session log
   * @param {string} sessionId - Session ID
   * @param {string} data - Terminal output data
   */
  logInteraction(sessionId, data) {
    try {
      const record = {
        timestamp: Date.now(),
        data: data
      };

      // Tier 4: 直接存入原始数据缓冲，不做实时正则分类
      let buffer = this.logBuffers.get(sessionId) || [];
      
      if (buffer.length < this.MAX_BUFFER_SIZE) {
        buffer.push(record);
        this.logBuffers.set(sessionId, buffer);
      } else {
        // Lossy service: Drop oldest record to make room for new one
        buffer.shift();
        buffer.push(record);
        this.logBuffers.set(sessionId, buffer);
      }
    } catch (error) {
      console.error(`[SessionLogger] Failed to buffer interaction for ${sessionId}:`, error);
    }
  }

  /**
   * Read log file for a session
   * @param {string} sessionId - Session ID
   * @returns {Array} Array of log records
   */
  readLog(sessionId) {
    try {
      const logFile = this.getLogFilePath(sessionId);
      
      if (!fs.existsSync(logFile)) {
        return [];
      }

      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      
      return lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          console.warn(`[SessionLogger] Failed to parse log line:`, e);
          return null;
        }
      }).filter(record => record !== null);
    } catch (error) {
      console.error(`[SessionLogger] Failed to read log for ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * Delete log file for a session
   * @param {string} sessionId - Session ID
   */
  deleteLog(sessionId) {
    try {
      // Flush any pending buffer first
      this.flushSessionBuffer(sessionId);
      
      // Clear cached data
      this.logBuffers.delete(sessionId);
      this.recordCounts.delete(sessionId);
      this.classifiers.delete(sessionId);
      
      // Clear any pending trim timer
      if (this.trimTimers && this.trimTimers.has(sessionId)) {
        clearTimeout(this.trimTimers.get(sessionId));
        this.trimTimers.delete(sessionId);
      }
      
      // Delete the log file
      const logFile = this.getLogFilePath(sessionId);
      if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
        console.log(`[SessionLogger] Deleted log for session ${sessionId}`);
      }
    } catch (error) {
      console.error(`[SessionLogger] Failed to delete log for ${sessionId}:`, error);
    }
  }

  /**
   * Get log statistics
   * @param {string} sessionId - Session ID
   * @returns {Object} Statistics object
   */
  getLogStats(sessionId) {

    try {
      const logFile = this.getLogFilePath(sessionId);
      
      if (!fs.existsSync(logFile)) {
        return {
          exists: false,
          recordCount: 0,
          fileSize: 0,
          oldestRecord: null,
          newestRecord: null,
        };
      }

      const stats = fs.statSync(logFile);
      const records = this.readLog(sessionId);
      
      return {
        exists: true,
        recordCount: records.length,
        fileSize: stats.size,
        oldestRecord: records.length > 0 ? records[0].timestamp : null,
        newestRecord: records.length > 0 ? records[records.length - 1].timestamp : null,
      };
    } catch (error) {
      console.error(`[SessionLogger] Failed to get stats for ${sessionId}:`, error);
      return {
        exists: false,
        recordCount: 0,
        fileSize: 0,
        oldestRecord: null,
        newestRecord: null,
      };
    }
  }

  /**
   * Clean up old log files based on retention policy
   */
  cleanupOldLogs() {
    try {
      if (!fs.existsSync(this.logsDir)) return;

      const files = fs.readdirSync(this.logsDir);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;

        const filePath = path.join(this.logsDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > this.RETENTION_MS) {
          fs.unlinkSync(filePath);
          deletedCount++;
          
          // Clean up in-memory data for this session
          const sessionId = file.replace('.jsonl', '');
          this.logBuffers.delete(sessionId);
          this.recordCounts.delete(sessionId);
          this.classifiers.delete(sessionId);
        }
      }

      if (deletedCount > 0) {
        console.log(`[SessionLogger] Cleaned up ${deletedCount} old log files`);
      }
    } catch (error) {
      console.error('[SessionLogger] Failed to cleanup old logs:', error);
    }
  }

  /**
   * Clean up resources (timers, counts, classifiers)
   */
  cleanup() {
    // Flush remaining buffers before cleaning up
    this.flushAllBuffers();
    
    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Clear all trim timers
    this.trimTimers.forEach(timer => clearTimeout(timer));
    this.trimTimers.clear();
    this.recordCounts.clear();
    this.classifiers.clear();
    console.log('[SessionLogger] Cleaned up resources');
  }
}

module.exports = SessionLogger;
