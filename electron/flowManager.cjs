const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');
const { spawn } = require('node-pty');

class FlowManager {
  constructor(terminalManager, configManager) {
    this.terminalManager = terminalManager;
    this.configManager = configManager;
    this.logsDir = path.join(app.getPath('userData'), 'flow-logs');
    this.ensureLogsDir();
    this.checkInterval = null;
    this.activeFlows = new Set();
    this.MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
  }

  ensureLogsDir() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  getLogPath(flowId) {
    return path.join(this.logsDir, `${flowId}.log`);
  }

  appendLog(flowId, data) {
    const logPath = this.getLogPath(flowId);
    try {
      if (fs.existsSync(logPath)) {
        const stats = fs.statSync(logPath);
        if (stats.size > this.MAX_LOG_SIZE) {
          // Keep last 5MB
          const content = fs.readFileSync(logPath);
          const keepSize = 5 * 1024 * 1024;
          fs.writeFileSync(logPath, content.slice(-keepSize));
        }
      }
      fs.appendFileSync(logPath, data);
    } catch (err) {
      console.error(`[FlowManager] Failed to write log for ${flowId}:`, err);
    }
  }

  parseCron(cronStr) {
    if (!cronStr) return null;
    const parts = cronStr.split(/\s+/);
    if (parts.length < 5) return null;
    return {
      minute: parts[0],
      hour: parts[1],
      dom: parts[2],
      month: parts[3],
      dow: parts[4]
    };
  }

  matchCronPart(part, value) {
    if (part === '*') return true;
    if (part.includes('/')) {
      const [range, step] = part.split('/');
      const start = range === '*' ? 0 : parseInt(range);
      return (value - start) % parseInt(step) === 0;
    }
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      return value >= start && value <= end;
    }
    if (part.includes(',')) {
      return part.split(',').map(Number).includes(value);
    }
    return parseInt(part) === value;
  }

  isTimeToRun(flow, now) {
    if (flow.mode !== 'cron' || !flow.enabled || !flow.cron) return false;
    const cron = this.parseCron(flow.cron);
    if (!cron) return false;

    const minute = now.getMinutes();
    const hour = now.getHours();
    const dom = now.getDate();
    const month = now.getMonth() + 1;
    const dow = now.getDay();

    return (
      this.matchCronPart(cron.minute, minute) &&
      this.matchCronPart(cron.hour, hour) &&
      this.matchCronPart(cron.dom, dom) &&
      this.matchCronPart(cron.month, month) &&
      this.matchCronPart(cron.dow, dow)
    );
  }

  async runFlow(flow) {
    if (this.activeFlows.has(flow.id)) {
      console.log(`[FlowManager] Flow ${flow.name} is already running, skipping...`);
      return;
    }

    console.log(`[FlowManager] Starting flow: ${flow.name} (${flow.id})`);
    this.activeFlows.add(flow.id);
    
    const startTime = new Date();
    this.appendLog(flow.id, `\n--- Execution Start: ${startTime.toLocaleString()} ---\n`);

    try {
      const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
      const pty = spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: flow.cwd || process.cwd(),
        env: process.env
      });

      pty.onData((data) => {
        this.appendLog(flow.id, data);
      });

      return new Promise((resolve) => {
        let commandIndex = 0;
        const commands = flow.commands || [];

        const nextCommand = () => {
          if (commandIndex < commands.length) {
            const cmd = commands[commandIndex++];
            this.appendLog(flow.id, `[Running]: ${cmd}\n`);
            pty.write(`${cmd}\n`);
            // Simple approach: wait a bit between commands or wait for prompt if we were more advanced
            // For now, we chain them with && in shell if they want strict sequence, 
            // or we can just pipe them all.
            // Better: write all commands joined by && and then exit
          } else {
            pty.write('exit\n');
          }
        };

        // Instead of manual stepping which is hard without prompt detection, 
        // we send the full chain
        const fullChain = commands.join(' && ') + ' && exit\n';
        pty.write(fullChain);

        pty.onExit(({ exitCode }) => {
          const endTime = new Date();
          const status = exitCode === 0 ? 'success' : 'error';
          this.appendLog(flow.id, `\n--- Execution Finished: ${status} (Code: ${exitCode}) at ${endTime.toLocaleString()} ---\n`);
          this.activeFlows.delete(flow.id);
          
          // Update flow status in config
          this.updateFlowStatus(flow.id, status, endTime.getTime());
          resolve();
        });
      });
    } catch (err) {
      this.appendLog(flow.id, `[Error]: ${err.message}\n`);
      this.activeFlows.delete(flow.id);
      resolve();
    }
  }

  updateFlowStatus(flowId, status, time) {
    const config = this.configManager.getConfig();
    if (!config.flows) return;
    
    const flowIndex = config.flows.findIndex(f => f.id === flowId);
    if (flowIndex !== -1) {
      config.flows[flowIndex].lastRunTime = time;
      config.flows[flowIndex].lastRunStatus = status;
      this.configManager.updateConfig({ flows: config.flows });
    }
  }

  startScheduler() {
    if (this.checkInterval) return;
    
    console.log('[FlowManager] Scheduler started (minute-level)');
    this.checkInterval = setInterval(() => {
      const now = new Date();
      if (now.getSeconds() !== 0) return; // Only run at the start of the minute

      const config = this.configManager.getConfig();
      const flows = config.flows || [];
      
      flows.forEach(flow => {
        if (this.isTimeToRun(flow, now)) {
          this.runFlow(flow);
        }
      });
    }, 1000); // Check every second to catch the 00 second
  }

  stopScheduler() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  setupIpc() {
    ipcMain.handle('flow:get-logs', async (_event, flowId) => {
      const logPath = this.getLogPath(flowId);
      if (fs.existsSync(logPath)) {
        return fs.readFileSync(logPath, 'utf8');
      }
      return '';
    });

    ipcMain.handle('flow:run-now', async (_event, flow) => {
      return this.runFlow(flow);
    });
    
    ipcMain.on('flow:clear-logs', (_event, flowId) => {
      const logPath = this.getLogPath(flowId);
      if (fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, '');
      }
    });
  }
}

module.exports = FlowManager;
