const EventEmitter = require('events');
const http = require('http');
const https = require('https');

class GatewayClient extends EventEmitter {
  constructor(terminalManager, config = {}) {
    super();
    this.terminalManager = terminalManager;
    this.config = config?.gateway || {};
    
    this.riID = this.config.riID || `ri-${Date.now()}`;
    this.gatewayURL = this.config.url || 'http://localhost:8080';
    this.version = '1.0.0';
    this.capabilities = [
      'slack.message', 
      'discord.message', 
      'slack.slash_command', 
      'discord.interaction',
      'gateway.message',
      'gateway.slash_command'
    ];
    this.maxConcurrency = 10;
    
    this.state = 'INIT';
    this.pollAbortController = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.inflight = 0;
    
    this.pollTimeout = this.config.pollTimeout || 30000;
    this.heartbeatInterval = this.config.heartbeatInterval || 10000;
    this.reconnectInterval = this.config.reconnectInterval || 1000;
    this.maxReconnectDelay = this.config.maxReconnectDelay || 30000;
    
    this.activeSession = null;
    this.outputBuffer = '';
    this.outputTimeout = null;
    this.OUTPUT_DEBOUNCE_MS = 500;
  }

  setConfig(config) {
    this.config = config?.gateway || {};
    this.gatewayURL = this.config.url || this.gatewayURL;
    this.riID = this.config.riID || this.riID;
  }

  async start() {
    if (!this.config.enabled) {
      console.log('[GatewayClient] Gateway disabled in config');
      return;
    }
    
    console.log(`[GatewayClient] Connecting to ${this.gatewayURL} as ${this.riID}`);
    this.setState('REGISTERING');
    
    try {
      await this.register();
      this.setupTerminalListener();
      this.startPolling();
      this.startHeartbeat();
      console.log('[GatewayClient] Connected successfully');
    } catch (error) {
      console.error('[GatewayClient] Failed to connect:', error.message);
      this.setState('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  async stop() {
    console.log('[GatewayClient] Stopping...');
    this.setState('DISCONNECTED');
    
    if (this.pollAbortController) {
      this.pollAbortController.abort();
      this.pollAbortController = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.outputTimeout) {
      clearTimeout(this.outputTimeout);
      this.outputTimeout = null;
    }
  }

  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    if (oldState !== newState) {
      this.emit('state-change', { oldState, newState });
      console.log(`[GatewayClient] State: ${oldState} -> ${newState}`);
    }
  }

  async register() {
    const registration = {
      ri_id: this.riID,
      version: this.version,
      capabilities: this.capabilities,
      max_concurrency: this.maxConcurrency,
      labels: {
        type: 'electron-app',
        platform: process.platform,
      },
    };

    const response = await this.request('POST', '/ri/register', registration);
    
    if (response.statusCode !== 200) {
      throw new Error(`Registration failed: ${response.statusCode} ${response.body}`);
    }

    this.setState('CONNECTED');
    this.emit('connected', JSON.parse(response.body));
  }

  startPolling() {
    this.pollLoop();
  }

  async pollLoop() {
    let reconnectDelay = this.reconnectInterval;
    
    while (this.state === 'CONNECTED' || this.state === 'DEGRADED') {
      try {
        this.pollAbortController = new AbortController();
        const response = await this.request('GET', '/ri/poll', null, {
          'X-RI-ID': this.riID,
        }, this.pollTimeout + 5000);
        
        if (response.statusCode === 404) {
          console.log('[GatewayClient] Not registered, re-registering...');
          await this.register();
          continue;
        }
        
        if (response.statusCode !== 200) {
          throw new Error(`Poll failed: ${response.statusCode}`);
        }
        
        const data = JSON.parse(response.body);
        const events = data.events || [];
        
        for (const event of events) {
          this.handleEvent(event);
        }
        
        reconnectDelay = this.reconnectInterval;
        if (this.state === 'DEGRADED') {
          this.setState('CONNECTED');
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          break;
        }
        
        console.error('[GatewayClient] Poll error:', error.message);
        this.setState('DEGRADED');
        this.emit('error', error);
        
        await this.sleep(reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, this.maxReconnectDelay);
      }
    }
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      if (this.state !== 'CONNECTED' && this.state !== 'DEGRADED') {
        return;
      }
      
      try {
        const heartbeat = {
          status: this.state === 'DEGRADED' ? 'degraded' : 'ok',
          load: this.inflight / this.maxConcurrency,
          inflight: this.inflight,
        };
        
        await this.request('POST', '/ri/heartbeat', heartbeat, {
          'X-RI-ID': this.riID,
        });
      } catch (error) {
        console.error('[GatewayClient] Heartbeat failed:', error.message);
      }
    }, this.heartbeatInterval);
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }
    
    console.log(`[GatewayClient] Reconnecting in ${this.reconnectInterval}ms...`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.start();
    }, this.reconnectInterval);
  }

  handleEvent(envelope) {
    if (envelope.type !== 'event') {
      return;
    }

    this.inflight++;
    
    const payload = JSON.parse(JSON.stringify(envelope.payload));
    console.log(`[GatewayClient] Received event: ${envelope.id}, type: ${payload.event_type}`);
    
    this.processEvent(envelope.id, payload)
      .catch(error => {
        console.error('[GatewayClient] Event processing error:', error);
        this.sendErrorResponse(envelope.id, payload, error.message);
      })
      .finally(() => {
        this.inflight--;
      });
  }

  async processEvent(eventID, payload) {
    const text = payload.data?.text || '';
    const platform = payload.platform;
    
    this.emit('message', {
      eventID,
      platform,
      text,
      data: payload.data,
    });

    if (text.startsWith('/ai ') || text.startsWith('!ai ')) {
      const prompt = text.slice(4).trim();
      await this.handleAICommand(eventID, payload, prompt);
    } else if (text.startsWith('/status')) {
      await this.handleStatusCommand(eventID, payload);
    } else if (text.startsWith('/sessions')) {
      await this.handleSessionsCommand(eventID, payload);
    } else if (text.startsWith('/select ')) {
      const sessionId = text.slice(8).trim();
      await this.handleSelectCommand(eventID, payload, sessionId);
    } else if (text.startsWith('/stop') || text.startsWith('/cancel')) {
      await this.handleStopCommand(eventID, payload);
    } else if (text.startsWith('/y') || text.startsWith('/yes')) {
      await this.handleConfirmCommand(eventID, payload, 'y');
    } else if (text.startsWith('/n') || text.startsWith('/no')) {
      await this.handleConfirmCommand(eventID, payload, 'n');
    } else if (text.startsWith('/help')) {
      await this.handleHelpCommand(eventID, payload);
    } else {
      await this.sendResponse(eventID, payload, `Unknown command. Use /help to see available commands.`);
    }
  }

  async handleAICommand(eventID, payload, prompt) {
    if (!this.activeSession) {
      const sessions = this.getAvailableSessions();
      if (sessions.length === 0) {
        await this.sendResponse(eventID, payload, '❌ No active terminal sessions. Please create one in RI first.');
        return;
      }
      
      const firstSession = sessions[0];
      this.activeSession = {
        sessionId: firstSession.sessionId,
        terminalId: firstSession.terminalIds[0],
      };
      await this.sendResponse(eventID, payload, `📡 Connected to session: ${firstSession.name}`);
    }

    await this.sendResponse(eventID, payload, `🤖 Sending to AI: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}`);
    this.terminalManager.write(this.activeSession.terminalId, prompt + '\n');
  }

  async handleStatusCommand(eventID, payload) {
    const sessions = this.getAvailableSessions();
    const status = {
      activeSession: this.activeSession ? 'Connected' : 'Not connected',
      totalSessions: sessions.length,
      gatewayState: this.state,
    };

    const statusMessage = `📊 **Status**
• Gateway: ${status.gatewayState}
• Active Session: ${status.activeSession}
• Total Sessions: ${status.totalSessions}`;

    await this.sendResponse(eventID, payload, statusMessage);
  }

  async handleSessionsCommand(eventID, payload) {
    const sessions = this.getAvailableSessions();
    
    if (sessions.length === 0) {
      await this.sendResponse(eventID, payload, '📋 No terminal sessions available.');
      return;
    }

    const sessionList = sessions.map((s, i) => {
      const isActive = this.activeSession?.sessionId === s.sessionId;
      return `${isActive ? '▶️' : '  '} ${i + 1}. ${s.name} (${s.sessionId.slice(0, 8)}...)`;
    }).join('\n');

    await this.sendResponse(eventID, payload, `📋 **Available Sessions**\n${sessionList}\n\nUse \`/select <number>\` to switch sessions.`);
  }

  async handleSelectCommand(eventID, payload, input) {
    const sessions = this.getAvailableSessions();
    
    let session;
    const index = parseInt(input, 10) - 1;
    if (!isNaN(index) && index >= 0 && index < sessions.length) {
      session = sessions[index];
    } else {
      session = sessions.find(s => s.sessionId.startsWith(input));
    }

    if (!session) {
      await this.sendResponse(eventID, payload, `❌ Session not found: ${input}`);
      return;
    }

    this.activeSession = {
      sessionId: session.sessionId,
      terminalId: session.terminalIds[0],
    };

    await this.sendResponse(eventID, payload, `✅ Switched to session: ${session.name}`);
  }

  async handleStopCommand(eventID, payload) {
    if (!this.activeSession) {
      await this.sendResponse(eventID, payload, '❌ No active session.');
      return;
    }

    this.terminalManager.write(this.activeSession.terminalId, '\x03');
    await this.sendResponse(eventID, payload, '🛑 Sent interrupt signal (Ctrl+C).');
  }

  async handleConfirmCommand(eventID, payload, response) {
    if (!this.activeSession) {
      await this.sendResponse(eventID, payload, '❌ No active session.');
      return;
    }

    this.terminalManager.write(this.activeSession.terminalId, response + '\n');
    await this.sendResponse(eventID, payload, `📤 Sent: ${response}`);
  }

  async handleHelpCommand(eventID, payload) {
    const helpMessage = `🤖 **RI Gateway Bot Commands**

**/ai <prompt>** - Send prompt to AI in terminal
**/sessions** - List available terminal sessions
**/select <n>** - Switch to session by number
**/status** - Show connection status
**/stop** - Send Ctrl+C to stop current process
**/y** or **/n** - Send yes/no confirmation
**/help** - Show this help message`;

    await this.sendResponse(eventID, payload, helpMessage);
  }

  async sendResponse(eventID, payload, text) {
    const response = {
      type: 'response',
      id: eventID,
      timestamp: Date.now(),
      payload: {
        platform: payload.platform,
        response_url: payload.data?.response_url || '',
        body: {
          text: text,
        },
      },
    };

    try {
      await this.request('POST', '/ri/response', response, {
        'X-RI-ID': this.riID,
      });
    } catch (error) {
      console.error('[GatewayClient] Failed to send response:', error.message);
    }
  }

  async sendErrorResponse(eventID, payload, errorMessage) {
    await this.sendResponse(eventID, payload, `❌ Error: ${errorMessage}`);
  }

  setupTerminalListener() {
    this.terminalManager.on('terminal-output', ({ terminalId, sessionId, data }) => {
      if (!this.activeSession || this.activeSession.sessionId !== sessionId) {
        return;
      }

      this.outputBuffer += data;
      
      if (this.outputTimeout) {
        clearTimeout(this.outputTimeout);
      }
      
      this.outputTimeout = setTimeout(() => {
        this.flushOutputBuffer();
      }, this.OUTPUT_DEBOUNCE_MS);
    });
  }

  async flushOutputBuffer() {
    if (!this.outputBuffer) return;
    
    const cleanedOutput = this.cleanTerminalOutput(this.outputBuffer);
    this.outputBuffer = '';
    
    if (!cleanedOutput.trim()) return;

    this.emit('terminal-output', { output: cleanedOutput });
  }

  cleanTerminalOutput(output) {
    return output
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\][^\x07]*\x07/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  getAvailableSessions() {
    const sessions = [];
    for (const [terminalId, entry] of this.terminalManager._terms) {
      if (entry.sessionId) {
        const existing = sessions.find(s => s.sessionId === entry.sessionId);
        if (existing) {
          existing.terminalIds.push(terminalId);
        } else {
          sessions.push({
            sessionId: entry.sessionId,
            name: entry.sessionName || 'Unnamed',
            terminalIds: [terminalId],
          });
        }
      }
    }
    return sessions;
  }

  getStatus() {
    return {
      connected: this.state === 'CONNECTED',
      state: this.state,
      gatewayURL: this.gatewayURL,
      riID: this.riID,
      activeSession: this.activeSession ? {
        sessionId: this.activeSession.sessionId,
      } : null,
    };
  }

  request(method, path, body, headers = {}, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.gatewayURL);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;
      
      const options = {
        method,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout,
      };
      
      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = GatewayClient;
