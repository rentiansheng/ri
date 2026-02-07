const EventEmitter = require('events');

class RemoteControlManager extends EventEmitter {
  constructor(terminalManager, config = {}) {
    super();
    this.terminalManager = terminalManager;
    this.config = config;
    
    this.discordBot = null;
    this.slackBot = null;
    
    this.activeSession = null;
    this.outputBuffer = '';
    this.outputTimeout = null;
    this.OUTPUT_DEBOUNCE_MS = 500;
    this.MAX_MESSAGE_LENGTH = 1900;
    
    this.allowedUsers = new Set();
    this.allowedChannels = new Set();
    
    this.pendingResponses = new Map();
  }

  setConfig(config) {
    this.config = config?.remoteControl || {};
    
    if (this.config.allowedUsers) {
      this.allowedUsers = new Set(this.config.allowedUsers);
    }
    if (this.config.allowedChannels) {
      this.allowedChannels = new Set(this.config.allowedChannels);
    }
  }

  async initialize() {
    const discordConfig = this.config?.discord;
    const slackConfig = this.config?.slack;

    if (discordConfig?.enabled && discordConfig?.botToken) {
      await this.initializeDiscord(discordConfig);
    }

    if (slackConfig?.enabled && slackConfig?.botToken && slackConfig?.appToken) {
      await this.initializeSlack(slackConfig);
    }

    this.setupTerminalListener();
    console.log('[RemoteControl] Initialized');
  }

  async initializeDiscord(config) {
    try {
      const { Client, GatewayIntentBits, Partials } = require('discord.js');
      
      this.discordBot = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages,
        ],
        partials: [Partials.Channel, Partials.Message],
      });

      this.discordBot.on('ready', () => {
        console.log(`[RemoteControl] Discord bot logged in as ${this.discordBot.user.tag}`);
        this.emit('discord-ready', { username: this.discordBot.user.tag });
      });

      this.discordBot.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        if (!this.isAuthorized('discord', message.author.id, message.channelId)) {
          return;
        }

        const content = message.content.trim();
        
        if (content.startsWith('/ai ') || content.startsWith('!ai ')) {
          const prompt = content.slice(4).trim();
          await this.handleAICommand(prompt, 'discord', message);
        } else if (content.startsWith('/status')) {
          await this.handleStatusCommand('discord', message);
        } else if (content.startsWith('/sessions')) {
          await this.handleSessionsCommand('discord', message);
        } else if (content.startsWith('/select ')) {
          const sessionId = content.slice(8).trim();
          await this.handleSelectCommand(sessionId, 'discord', message);
        } else if (content.startsWith('/stop') || content.startsWith('/cancel')) {
          await this.handleStopCommand('discord', message);
        } else if (content.startsWith('/y') || content.startsWith('/yes')) {
          await this.handleConfirmCommand('y', 'discord', message);
        } else if (content.startsWith('/n') || content.startsWith('/no')) {
          await this.handleConfirmCommand('n', 'discord', message);
        }
      });

      await this.discordBot.login(config.botToken);
      console.log('[RemoteControl] Discord bot initialized');
    } catch (error) {
      console.error('[RemoteControl] Failed to initialize Discord bot:', error.message);
      this.emit('discord-error', { error: error.message });
    }
  }

  async initializeSlack(config) {
    try {
      const { App } = require('@slack/bolt');
      
      this.slackBot = new App({
        token: config.botToken,
        appToken: config.appToken,
        socketMode: true,
      });

      this.slackBot.message(async ({ message, say }) => {
        if (message.subtype) return;
        
        if (!this.isAuthorized('slack', message.user, message.channel)) {
          return;
        }

        const content = message.text?.trim() || '';
        
        if (content.startsWith('/ai ') || content.startsWith('!ai ')) {
          const prompt = content.slice(4).trim();
          await this.handleAICommand(prompt, 'slack', { say, channel: message.channel, user: message.user });
        } else if (content.startsWith('/status')) {
          await this.handleStatusCommand('slack', { say });
        } else if (content.startsWith('/sessions')) {
          await this.handleSessionsCommand('slack', { say });
        } else if (content.startsWith('/select ')) {
          const sessionId = content.slice(8).trim();
          await this.handleSelectCommand(sessionId, 'slack', { say });
        } else if (content.startsWith('/stop') || content.startsWith('/cancel')) {
          await this.handleStopCommand('slack', { say });
        } else if (content.startsWith('/y') || content.startsWith('/yes')) {
          await this.handleConfirmCommand('y', 'slack', { say });
        } else if (content.startsWith('/n') || content.startsWith('/no')) {
          await this.handleConfirmCommand('n', 'slack', { say });
        }
      });

      await this.slackBot.start();
      console.log('[RemoteControl] Slack bot initialized');
      this.emit('slack-ready', {});
    } catch (error) {
      console.error('[RemoteControl] Failed to initialize Slack bot:', error.message);
      this.emit('slack-error', { error: error.message });
    }
  }

  isAuthorized(platform, userId, channelId) {
    if (this.allowedUsers.size === 0 && this.allowedChannels.size === 0) {
      return true;
    }
    
    if (this.allowedUsers.has(userId)) return true;
    if (this.allowedChannels.has(channelId)) return true;
    
    return false;
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
    if (!this.outputBuffer || !this.activeSession) return;
    
    const cleanedOutput = this.cleanTerminalOutput(this.outputBuffer);
    this.outputBuffer = '';
    
    if (!cleanedOutput.trim()) return;

    const chunks = this.splitMessage(cleanedOutput);
    
    for (const chunk of chunks) {
      await this.sendResponse(this.activeSession.platform, this.activeSession.context, chunk);
    }
  }

  cleanTerminalOutput(output) {
    return output
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\][^\x07]*\x07/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  splitMessage(text) {
    const chunks = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      if (remaining.length <= this.MAX_MESSAGE_LENGTH) {
        chunks.push(remaining);
        break;
      }
      
      let splitIndex = remaining.lastIndexOf('\n', this.MAX_MESSAGE_LENGTH);
      if (splitIndex === -1 || splitIndex < this.MAX_MESSAGE_LENGTH / 2) {
        splitIndex = this.MAX_MESSAGE_LENGTH;
      }
      
      chunks.push(remaining.slice(0, splitIndex));
      remaining = remaining.slice(splitIndex);
    }
    
    return chunks;
  }

  async handleAICommand(prompt, platform, context) {
    if (!this.activeSession) {
      const sessions = this.getAvailableSessions();
      if (sessions.length === 0) {
        await this.sendResponse(platform, context, '❌ No active terminal sessions. Please create one in RI first.');
        return;
      }
      
      const firstSession = sessions[0];
      this.activeSession = {
        sessionId: firstSession.sessionId,
        terminalId: firstSession.terminalIds[0],
        platform,
        context,
      };
      await this.sendResponse(platform, context, `📡 Connected to session: ${firstSession.name}`);
    } else {
      this.activeSession.platform = platform;
      this.activeSession.context = context;
    }

    await this.sendResponse(platform, context, `🤖 Sending to AI: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}`);
    
    this.terminalManager.write(this.activeSession.terminalId, prompt + '\n');
  }

  async handleStatusCommand(platform, context) {
    const status = {
      activeSession: this.activeSession ? 'Connected' : 'Not connected',
      discordStatus: this.discordBot ? 'Online' : 'Offline',
      slackStatus: this.slackBot ? 'Online' : 'Offline',
    };

    const statusMessage = `📊 **Status**
• Active Session: ${status.activeSession}
• Discord: ${status.discordStatus}
• Slack: ${status.slackStatus}`;

    await this.sendResponse(platform, context, statusMessage);
  }

  async handleSessionsCommand(platform, context) {
    const sessions = this.getAvailableSessions();
    
    if (sessions.length === 0) {
      await this.sendResponse(platform, context, '📋 No terminal sessions available.');
      return;
    }

    const sessionList = sessions.map((s, i) => {
      const isActive = this.activeSession?.sessionId === s.sessionId;
      return `${isActive ? '▶️' : '  '} ${i + 1}. ${s.name} (${s.sessionId.slice(0, 8)}...)`;
    }).join('\n');

    await this.sendResponse(platform, context, `📋 **Available Sessions**\n${sessionList}\n\nUse \`/select <number>\` to switch sessions.`);
  }

  async handleSelectCommand(input, platform, context) {
    const sessions = this.getAvailableSessions();
    
    let session;
    const index = parseInt(input, 10) - 1;
    if (!isNaN(index) && index >= 0 && index < sessions.length) {
      session = sessions[index];
    } else {
      session = sessions.find(s => s.sessionId.startsWith(input));
    }

    if (!session) {
      await this.sendResponse(platform, context, `❌ Session not found: ${input}`);
      return;
    }

    this.activeSession = {
      sessionId: session.sessionId,
      terminalId: session.terminalIds[0],
      platform,
      context,
    };

    await this.sendResponse(platform, context, `✅ Switched to session: ${session.name}`);
  }

  async handleStopCommand(platform, context) {
    if (!this.activeSession) {
      await this.sendResponse(platform, context, '❌ No active session.');
      return;
    }

    this.terminalManager.write(this.activeSession.terminalId, '\x03');
    await this.sendResponse(platform, context, '🛑 Sent interrupt signal (Ctrl+C).');
  }

  async handleConfirmCommand(response, platform, context) {
    if (!this.activeSession) {
      await this.sendResponse(platform, context, '❌ No active session.');
      return;
    }

    this.terminalManager.write(this.activeSession.terminalId, response + '\n');
    await this.sendResponse(platform, context, `📤 Sent: ${response}`);
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

  async sendResponse(platform, context, message) {
    try {
      if (platform === 'discord' && context.reply) {
        await context.reply(message);
      } else if (platform === 'slack' && context.say) {
        await context.say(message);
      }
    } catch (error) {
      console.error('[RemoteControl] Failed to send response:', error.message);
    }
  }

  getStatus() {
    return {
      discordConnected: !!this.discordBot?.isReady(),
      slackConnected: !!this.slackBot,
      activeSession: this.activeSession ? {
        sessionId: this.activeSession.sessionId,
        platform: this.activeSession.platform,
      } : null,
    };
  }

  async cleanup() {
    if (this.discordBot) {
      await this.discordBot.destroy();
      this.discordBot = null;
    }
    
    if (this.slackBot) {
      await this.slackBot.stop();
      this.slackBot = null;
    }
    
    if (this.outputTimeout) {
      clearTimeout(this.outputTimeout);
    }
    
    this.removeAllListeners();
    console.log('[RemoteControl] Cleaned up');
  }
}

module.exports = RemoteControlManager;
