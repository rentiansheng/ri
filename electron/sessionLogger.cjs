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
    
    console.log('[SessionLogger] Initialized with config:', {
      logsDir: this.logsDir,
      maxRecords: this.MAX_RECORDS,
      retentionDays: this.RETENTION_DAYS,
      trimDebounceMs: this.TRIM_DEBOUNCE_MS,
      enableFiltering: this.enableFiltering
    });
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
      // Check if filtering is enabled
      if (this.enableFiltering) {
        // Classify output
        const classifier = this.getClassifier(sessionId);
        const { type, shouldLog } = classifier.classify(data);
        
        if (!shouldLog) {
          return;  // Don't log prompts, interactive apps, noise
        }
        
        // Clean data
        const cleaned = classifier.stripBasicAnsi(data).trim();
        if (cleaned.length < 2) {
          return;  // Filter too short content
        }
        
        // Enhanced record format
        const record = {
          timestamp: Date.now(),
          type: type,  // 'command' or 'output'
          data: data,  // Keep raw data
          cleaned: cleaned,  // Cleaned text for display
        };

        const logFile = this.getLogFilePath(sessionId);
        const recordLine = JSON.stringify(record) + '\n';

        // Append to file (keep synchronous for data integrity)
        fs.appendFileSync(logFile, recordLine, 'utf8');
      } else {
        // Filtering disabled - log everything in simple format
        const record = {
          timestamp: Date.now(),
          data: data,
        };

        const logFile = this.getLogFilePath(sessionId);
        const recordLine = JSON.stringify(record) + '\n';

        // Append to file (keep synchronous for data integrity)
        fs.appendFileSync(logFile, recordLine, 'utf8');
      }

      // Increment count
      const currentCount = this.recordCounts.get(sessionId) || 0;
      this.recordCounts.set(sessionId, currentCount + 1);

      // Schedule debounced trim
      this.scheduleTrim(sessionId);
    } catch (error) {
      console.error(`[SessionLogger] Failed to log interaction for ${sessionId}:`, error);
    }
  }

  /**
   * Schedule a debounced trim operation
   * @param {string} sessionId - Session ID
   */
  scheduleTrim(sessionId) {
    // Clear existing timer
    const existingTimer = this.trimTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Only trim if we think we might be over limit
    const count = this.recordCounts.get(sessionId) || 0;
    if (count < this.MAX_RECORDS * 1.2) {
      // Not near limit, skip trim
      return;
    }

    // Schedule new trim
    const timer = setTimeout(() => {
      this.trimLogFile(sessionId);
      this.trimTimers.delete(sessionId);
    }, this.TRIM_DEBOUNCE_MS);

    this.trimTimers.set(sessionId, timer);
  }

  /**
   * Trim log file to keep only MAX_RECORDS most recent records
   * and remove records older than RETENTION_DAYS
   * @param {string} sessionId - Session ID
   */
  trimLogFile(sessionId) {
    try {
      const logFile = this.getLogFilePath(sessionId);
      
      if (!fs.existsSync(logFile)) {
        return;
      }

      // Read all records
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length <= this.MAX_RECORDS) {
        // Check if we need to remove old records
        const now = Date.now();
        const filteredLines = lines.filter(line => {
          try {
            const record = JSON.parse(line);
            return (now - record.timestamp) < this.RETENTION_MS;
          } catch (e) {
            return false; // Remove invalid records
          }
        });

        if (filteredLines.length < lines.length) {
          // Rewrite file with filtered records
          fs.writeFileSync(logFile, filteredLines.join('\n') + '\n', 'utf8');
          // Update count
          this.recordCounts.set(sessionId, filteredLines.length);
        }
        return;
      }

      // Parse records with timestamps
      const records = lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return null;
          }
        })
        .filter(record => record !== null);

      // Filter by retention period
      const now = Date.now();
      const recentRecords = records.filter(
        record => (now - record.timestamp) < this.RETENTION_MS
      );

      // Keep only the most recent MAX_RECORDS
      const trimmedRecords = recentRecords.slice(-this.MAX_RECORDS);

      // Rewrite file
      const newContent = trimmedRecords
        .map(record => JSON.stringify(record))
        .join('\n') + '\n';
      
      fs.writeFileSync(logFile, newContent, 'utf8');
      
      // Update count after trimming
      this.recordCounts.set(sessionId, trimmedRecords.length);
    } catch (error) {
      console.error(`[SessionLogger] Failed to trim log file for ${sessionId}:`, error);
    }
  }

  /**
   * Read session log records
   * @param {string} sessionId - Session ID
   * @param {number} limit - Maximum number of records to return (default: all)
   * @returns {Array} Array of interaction records
   */
  readLog(sessionId, limit = null) {
    try {
      const logFile = this.getLogFilePath(sessionId);
      
      if (!fs.existsSync(logFile)) {
        return [];
      }

      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      const records = lines
        .map(line => {
          try {
            const record = JSON.parse(line);
            
            // Backward compatibility for old format
            if (!record.type) {
              const classifier = new OutputClassifier();
              return {
                timestamp: record.timestamp,
                type: 'output',
                data: record.data,
                cleaned: classifier.stripBasicAnsi(record.data).trim(),
              };
            }
            
            return record;
          } catch (e) {
            return null;
          }
        })
        .filter(record => record !== null);

      if (limit && limit > 0) {
        return records.slice(-limit);
      }

      return records;
    } catch (error) {
      console.error(`[SessionLogger] Failed to read log for ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * Delete session log file
   * @param {string} sessionId - Session ID
   */
  deleteLog(sessionId) {
    try {
      const logFile = this.getLogFilePath(sessionId);
      
      if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
      }
      
      // Clean up classifier and other resources
      this.classifiers.delete(sessionId);
      this.recordCounts.delete(sessionId);
      this.trimTimers.delete(sessionId);
    } catch (error) {
      console.error(`[SessionLogger] Failed to delete log for ${sessionId}:`, error);
    }
  }

  /**
   * Clean up old log files (called periodically)
   */
  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logsDir);
      const now = Date.now();

      files.forEach(file => {
        if (!file.endsWith('.jsonl')) {
          return;
        }

        const filePath = path.join(this.logsDir, file);
        const stats = fs.statSync(filePath);
        
        // Delete files not modified in RETENTION_DAYS
        if (now - stats.mtimeMs > this.RETENTION_MS) {
          fs.unlinkSync(filePath);
          console.log(`[SessionLogger] Deleted old log file: ${file}`);
        }
      });
    } catch (error) {
      console.error('[SessionLogger] Failed to cleanup old logs:', error);
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
   * Clean up resources (timers, counts, classifiers)
   */
  cleanup() {
    // Clear all trim timers
    this.trimTimers.forEach(timer => clearTimeout(timer));
    this.trimTimers.clear();
    this.recordCounts.clear();
    this.classifiers.clear();
    console.log('[SessionLogger] Cleaned up resources');
  }
}

module.exports = SessionLogger;
