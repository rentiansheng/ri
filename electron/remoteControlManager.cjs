const EventEmitter = require('events');

class RemoteControlManager extends EventEmitter {
  constructor(terminalManager, config = {}) {
    super();
    this.terminalManager = terminalManager;
    this.config = config?.remoteControl || {};
    
    this.discordBot = null;
    this.slackBot = null;
    
    this.activeSession = null;
    this.outputBuffer = '';
    this.outputTimeout = null;
    this.OUTPUT_DEBOUNCE_MS = 500;
    this.MAX_MESSAGE_LENGTH = 1900;
    
    this.allowedUsers = new Set(this.config.allowedUsers || []);
    this.allowedChannels = new Set(this.config.allowedChannels || []);
    
    this.pendingResponses = new Map();
    
    this.messageLog = [];
    this.maxLogSize = 500;
    this.pendingApprovals = new Map();
    this.requireApproval = this.config.requireApproval || false;
  }

  setConfig(config) {
    this.config = config?.remoteControl || {};
    
    if (this.config.allowedUsers) {
      this.allowedUsers = new Set(this.config.allowedUsers);
    }
    if (this.config.allowedChannels) {
      this.allowedChannels = new Set(this.config.allowedChannels);
    }
    this.requireApproval = this.config.requireApproval || false;
  }

  logMessage(type, platform, user, content, extra = {}) {
    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      platform,
      user,
      content,
      timestamp: new Date().toISOString(),
      ...extra,
    };
    this.messageLog.unshift(msg);
    if (this.messageLog.length > this.maxLogSize) {
      this.messageLog.pop();
    }
    this.emit('message', msg);
    return msg;
  }

  getMessageLog(limit = 100) {
    return this.messageLog.slice(0, limit);
  }

  clearMessageLog() {
    this.messageLog = [];
  }

  getPendingApprovals() {
    return Array.from(this.pendingApprovals.values());
  }

  async approveCommand(approvalId) {
    const approval = this.pendingApprovals.get(approvalId);
    if (!approval) {
      return { success: false, error: 'Approval not found or expired' };
    }
    
    this.pendingApprovals.delete(approvalId);
    
    this.logMessage('approved', approval.platform, 'system', `Approved: ${approval.command}`, {
      originalId: approvalId,
    });

    await this.executeApprovedCommand(approval);
    
    return { success: true };
  }

  async rejectCommand(approvalId, reason = '') {
    const approval = this.pendingApprovals.get(approvalId);
    if (!approval) {
      return { success: false, error: 'Approval not found or expired' };
    }
    
    this.pendingApprovals.delete(approvalId);
    
    this.logMessage('rejected', approval.platform, 'system', `Rejected: ${approval.command}${reason ? ` (${reason})` : ''}`, {
      originalId: approvalId,
    });

    await this.sendResponse(approval.platform, approval.context, `❌ Command rejected${reason ? `: ${reason}` : ''}`);
    
    return { success: true };
  }

  async executeApprovedCommand(approval) {
    const { command, platform, context, commandType, args } = approval;
    
    switch (commandType) {
      case 'ai':
        await this.doHandleAICommand(args.prompt, platform, context);
        break;
      case 'stop':
        await this.doHandleStopCommand(platform, context);
        break;
      case 'confirm':
        await this.doHandleConfirmCommand(args.response, platform, context);
        break;
      default:
        await this.sendResponse(platform, context, `✅ Command approved but no action defined`);
    }
  }

  async sendMessageToRemote(platform, message, channelId) {
    this.logMessage('outgoing', platform, 'app', message);
    
    if (platform === 'discord') {
      if (!this.discordBot?.isReady()) {
        return { success: false, error: 'Discord not connected' };
      }
      try {
        let channel;
        if (channelId) {
          channel = await this.discordBot.channels.fetch(channelId);
        } else if (this.activeSession?.platform === 'discord' && this.activeSession?.context?.channelId) {
          channel = await this.discordBot.channels.fetch(this.activeSession.context.channelId);
        }
        if (!channel) {
          return { success: false, error: 'No channel specified' };
        }
        await channel.send(message);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    } else if (platform === 'slack') {
      if (!this.slackBot) {
        return { success: false, error: 'Slack not connected' };
      }
      try {
        const targetChannel = channelId || this.activeSession?.context?.channel;
        if (!targetChannel) {
          return { success: false, error: 'No channel specified' };
        }
        await this.slackBot.client.chat.postMessage({
          channel: targetChannel,
          text: message,
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Unknown platform' };
  }

  validateConfig() {
    const errors = [];
    const warnings = [];
    const discordConfig = this.config?.discord;
    const slackConfig = this.config?.slack;

    if (discordConfig?.enabled) {
      if (!discordConfig.botToken) {
        errors.push({
          field: 'discord.botToken',
          message: 'Discord Bot Token is required when Discord is enabled',
        });
      } else if (!discordConfig.botToken.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)) {
        errors.push({
          field: 'discord.botToken',
          message: 'Discord Bot Token format is invalid. Should be like: XXX.YYY.ZZZ',
        });
      }
    }

    if (slackConfig?.enabled) {
      if (!slackConfig.botToken) {
        errors.push({
          field: 'slack.botToken',
          message: 'Slack Bot Token is required when Slack is enabled',
        });
      } else if (!slackConfig.botToken.startsWith('xoxb-')) {
        errors.push({
          field: 'slack.botToken',
          message: 'Slack Bot Token should start with "xoxb-"',
        });
      }

      if (!slackConfig.appToken) {
        errors.push({
          field: 'slack.appToken',
          message: 'Slack App Token is required for Socket Mode',
        });
      } else if (!slackConfig.appToken.startsWith('xapp-')) {
        errors.push({
          field: 'slack.appToken',
          message: 'Slack App Token should start with "xapp-"',
        });
      }
    }

    if (!this.config.allowedUsers?.length && !this.config.allowedChannels?.length) {
      warnings.push({
        field: 'security',
        message: 'No user or channel restrictions set. Anyone can control your terminal!',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateAndTestConfig() {
    const result = {
      discord: { valid: false, errors: [], details: null },
      slack: { valid: false, errors: [], details: null },
      warnings: [],
    };

    const validation = this.validateConfig();
    result.warnings = validation.warnings;

    const discordConfig = this.config?.discord;
    if (discordConfig?.enabled) {
      const discordErrors = validation.errors.filter(e => e.field.startsWith('discord.'));
      if (discordErrors.length > 0) {
        result.discord.errors = discordErrors;
      } else {
        try {
          const { Client, GatewayIntentBits } = require('discord.js');
          const testClient = new Client({
            intents: [GatewayIntentBits.Guilds],
          });

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              testClient.destroy();
              reject(new Error('Connection timeout (10s)'));
            }, 10000);

            testClient.once('ready', () => {
              clearTimeout(timeout);
              result.discord.valid = true;
              result.discord.details = {
                username: testClient.user.username,
                tag: testClient.user.tag,
                id: testClient.user.id,
                guilds: testClient.guilds.cache.size,
                guildNames: testClient.guilds.cache.map(g => g.name),
              };
              testClient.destroy();
              resolve();
            });

            testClient.once('error', (err) => {
              clearTimeout(timeout);
              testClient.destroy();
              reject(err);
            });

            testClient.login(discordConfig.botToken).catch((err) => {
              clearTimeout(timeout);
              testClient.destroy();
              reject(err);
            });
          });
        } catch (error) {
          let errorMessage = error.message;
          if (errorMessage.includes('TOKEN_INVALID') || errorMessage.includes('invalid token')) {
            errorMessage = 'Invalid bot token. Please check your token in Discord Developer Portal.';
          } else if (errorMessage.includes('disallowed intents')) {
            errorMessage = 'Bot lacks required intents. Enable "Message Content Intent" in Discord Developer Portal → Bot → Privileged Gateway Intents.';
          } else if (errorMessage.includes('timeout')) {
            errorMessage = 'Connection timeout. Check your network or Discord service status.';
          }
          result.discord.errors.push({
            field: 'discord.connection',
            message: errorMessage,
          });
        }
      }
    } else {
      result.discord.valid = true;
      result.discord.skipped = true;
    }

    const slackConfig = this.config?.slack;
    if (slackConfig?.enabled) {
      const slackErrors = validation.errors.filter(e => e.field.startsWith('slack.'));
      if (slackErrors.length > 0) {
        result.slack.errors = slackErrors;
      } else {
        try {
          const { App } = require('@slack/bolt');
          const testApp = new App({
            token: slackConfig.botToken,
            appToken: slackConfig.appToken,
            socketMode: true,
          });

          const authResult = await testApp.client.auth.test();
          result.slack.valid = true;
          result.slack.details = {
            user: authResult.user,
            userId: authResult.user_id,
            team: authResult.team,
            teamId: authResult.team_id,
            botId: authResult.bot_id,
          };
        } catch (error) {
          let errorMessage = error.message;
          if (errorMessage.includes('invalid_auth')) {
            errorMessage = 'Invalid Bot Token. Check your token in Slack App settings → OAuth & Permissions.';
          } else if (errorMessage.includes('not_authed')) {
            errorMessage = 'Authentication failed. Make sure the bot is installed to your workspace.';
          } else if (errorMessage.includes('missing_scope')) {
            errorMessage = `Missing required scope: ${error.data?.needed || 'unknown'}. Add it in Slack App → OAuth & Permissions → Scopes.`;
          } else if (errorMessage.includes('invalid_app_token')) {
            errorMessage = 'Invalid App Token. Generate a new one in Slack App → Basic Information → App-Level Tokens.';
          }
          result.slack.errors.push({
            field: 'slack.connection',
            message: errorMessage,
          });
        }
      }
    } else {
      result.slack.valid = true;
      result.slack.skipped = true;
    }

    return result;
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
        const userInfo = `${message.author.username}#${message.author.discriminator}`;
        
        this.logMessage('incoming', 'discord', userInfo, content, {
          userId: message.author.id,
          channelId: message.channelId,
          guildId: message.guildId,
        });
        
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
        
        this.logMessage('incoming', 'slack', message.user, content, {
          userId: message.user,
          channelId: message.channel,
          ts: message.ts,
        });
        
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

    if (this.requireApproval) {
      const approvalId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.pendingApprovals.set(approvalId, {
        id: approvalId,
        command: `/ai ${prompt}`,
        commandType: 'ai',
        args: { prompt },
        platform,
        context,
        timestamp: new Date().toISOString(),
        user: context.author?.username || context.user || 'unknown',
      });
      
      this.emit('approval-required', this.pendingApprovals.get(approvalId));
      await this.sendResponse(platform, context, `⏳ Command pending approval in RI app...`);
      return;
    }

    await this.doHandleAICommand(prompt, platform, context);
  }

  async doHandleAICommand(prompt, platform, context) {
    this.logMessage('executed', platform, 'system', `Executing: /ai ${prompt.slice(0, 50)}...`);
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

    if (this.requireApproval) {
      const approvalId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.pendingApprovals.set(approvalId, {
        id: approvalId,
        command: '/stop',
        commandType: 'stop',
        args: {},
        platform,
        context,
        timestamp: new Date().toISOString(),
        user: context.author?.username || context.user || 'unknown',
      });
      this.emit('approval-required', this.pendingApprovals.get(approvalId));
      await this.sendResponse(platform, context, `⏳ Stop command pending approval...`);
      return;
    }

    await this.doHandleStopCommand(platform, context);
  }

  async doHandleStopCommand(platform, context) {
    this.logMessage('executed', platform, 'system', 'Executing: /stop (Ctrl+C)');
    this.terminalManager.write(this.activeSession.terminalId, '\x03');
    await this.sendResponse(platform, context, '🛑 Sent interrupt signal (Ctrl+C).');
  }

  async handleConfirmCommand(response, platform, context) {
    if (!this.activeSession) {
      await this.sendResponse(platform, context, '❌ No active session.');
      return;
    }

    if (this.requireApproval) {
      const approvalId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.pendingApprovals.set(approvalId, {
        id: approvalId,
        command: `/${response}`,
        commandType: 'confirm',
        args: { response },
        platform,
        context,
        timestamp: new Date().toISOString(),
        user: context.author?.username || context.user || 'unknown',
      });
      this.emit('approval-required', this.pendingApprovals.get(approvalId));
      await this.sendResponse(platform, context, `⏳ Confirm command pending approval...`);
      return;
    }

    await this.doHandleConfirmCommand(response, platform, context);
  }

  async doHandleConfirmCommand(response, platform, context) {
    this.logMessage('executed', platform, 'system', `Executing: /${response}`);
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

  // ================== 测试功能 ==================
  
  /**
   * 本地测试 - 不需要 Discord/Slack 连接
   * 返回测试结果对象
   */
  async runTest(testType = 'all') {
    const results = {
      timestamp: new Date().toISOString(),
      tests: [],
    };

    // 测试 1: 获取可用 sessions
    if (testType === 'all' || testType === 'sessions') {
      const sessions = this.getAvailableSessions();
      results.tests.push({
        name: 'getSessions',
        success: true,
        data: {
          count: sessions.length,
          sessions: sessions.map(s => ({ name: s.name, id: s.sessionId.slice(0, 8) })),
        },
      });
    }

    // 测试 2: 选择第一个 session
    if (testType === 'all' || testType === 'select') {
      const sessions = this.getAvailableSessions();
      if (sessions.length > 0) {
        const firstSession = sessions[0];
        this.activeSession = {
          sessionId: firstSession.sessionId,
          terminalId: firstSession.terminalIds[0],
          platform: 'test',
          context: null,
        };
        results.tests.push({
          name: 'selectSession',
          success: true,
          data: {
            selected: firstSession.name,
            sessionId: firstSession.sessionId.slice(0, 8),
          },
        });
      } else {
        results.tests.push({
          name: 'selectSession',
          success: false,
          error: 'No sessions available',
        });
      }
    }

    // 测试 3: 向 terminal 发送测试命令 (echo)
    if (testType === 'all' || testType === 'send') {
      if (this.activeSession) {
        try {
          const testCommand = 'echo "🧪 Remote Control Test: $(date)"';
          this.terminalManager.write(this.activeSession.terminalId, testCommand + '\n');
          results.tests.push({
            name: 'sendCommand',
            success: true,
            data: {
              command: testCommand,
              terminalId: this.activeSession.terminalId,
            },
          });
        } catch (error) {
          results.tests.push({
            name: 'sendCommand',
            success: false,
            error: error.message,
          });
        }
      } else {
        results.tests.push({
          name: 'sendCommand',
          success: false,
          error: 'No active session - run selectSession first',
        });
      }
    }

    // 测试 4: 检查 Discord/Slack 连接状态
    if (testType === 'all' || testType === 'connections') {
      results.tests.push({
        name: 'connections',
        success: true,
        data: {
          discord: this.discordBot?.isReady() ? 'online' : 'offline',
          slack: this.slackBot ? 'online' : 'offline',
          discordUser: this.discordBot?.user?.tag || null,
        },
      });
    }

    // 测试 5: 发送 Ctrl+C 测试
    if (testType === 'ctrlc') {
      if (this.activeSession) {
        this.terminalManager.write(this.activeSession.terminalId, '\x03');
        results.tests.push({
          name: 'sendCtrlC',
          success: true,
          data: { sent: 'Ctrl+C (\\x03)' },
        });
      } else {
        results.tests.push({
          name: 'sendCtrlC',
          success: false,
          error: 'No active session',
        });
      }
    }

    return results;
  }

  /**
   * 模拟处理命令 (用于测试，不需要真实的 Discord/Slack 消息)
   * @param {string} command - 命令字符串，如 "/sessions", "/ai hello", "/select 1"
   * @returns {Promise<{response: string, success: boolean}>}
   */
  async simulateCommand(command) {
    const responses = [];
    const mockContext = {
      reply: async (msg) => responses.push(msg),
      say: async (msg) => responses.push(msg),
    };

    const content = command.trim();

    try {
      if (content.startsWith('/ai ') || content.startsWith('!ai ')) {
        const prompt = content.slice(4).trim();
        await this.handleAICommand(prompt, 'test', mockContext);
      } else if (content.startsWith('/status')) {
        await this.handleStatusCommand('test', mockContext);
      } else if (content.startsWith('/sessions')) {
        await this.handleSessionsCommand('test', mockContext);
      } else if (content.startsWith('/select ')) {
        const sessionId = content.slice(8).trim();
        await this.handleSelectCommand(sessionId, 'test', mockContext);
      } else if (content.startsWith('/stop') || content.startsWith('/cancel')) {
        await this.handleStopCommand('test', mockContext);
      } else if (content.startsWith('/y') || content.startsWith('/yes')) {
        await this.handleConfirmCommand('y', 'test', mockContext);
      } else if (content.startsWith('/n') || content.startsWith('/no')) {
        await this.handleConfirmCommand('n', 'test', mockContext);
      } else {
        return { success: false, response: `Unknown command: ${content}` };
      }

      return { success: true, response: responses.join('\n') };
    } catch (error) {
      return { success: false, response: error.message };
    }
  }

  async testConnection(platform) {
    const result = {
      platform,
      success: false,
      message: '',
      details: {},
    };

    if (platform === 'discord') {
      if (!this.discordBot) {
        result.message = 'Discord bot not initialized';
        return result;
      }

      if (!this.discordBot.isReady()) {
        result.message = 'Discord bot not ready';
        return result;
      }

      try {
        const user = this.discordBot.user;
        result.success = true;
        result.message = `Connected as ${user.tag}`;
        result.details = {
          username: user.username,
          tag: user.tag,
          id: user.id,
          guilds: this.discordBot.guilds.cache.size,
          guildNames: this.discordBot.guilds.cache.map(g => g.name),
        };
      } catch (error) {
        result.message = error.message;
      }
    } else if (platform === 'slack') {
      if (!this.slackBot) {
        result.message = 'Slack bot not initialized';
        return result;
      }

      try {
        const authResult = await this.slackBot.client.auth.test();
        result.success = true;
        result.message = `Connected as ${authResult.user}`;
        result.details = {
          user: authResult.user,
          userId: authResult.user_id,
          team: authResult.team,
          teamId: authResult.team_id,
          botId: authResult.bot_id,
        };
      } catch (error) {
        result.message = error.message;
      }
    } else {
      result.message = `Unknown platform: ${platform}`;
    }

    return result;
  }

  async sendTestNotification(platform, channelId) {
    const result = {
      platform,
      success: false,
      message: '',
    };

    const testMessage = `🧪 **RI Remote Control Test**\n` +
      `Time: ${new Date().toLocaleString()}\n` +
      `Platform: ${platform}\n` +
      `This is a test notification from RI app.`;

    if (platform === 'discord') {
      if (!this.discordBot?.isReady()) {
        result.message = 'Discord bot not connected';
        return result;
      }

      try {
        let channel;
        if (channelId) {
          channel = await this.discordBot.channels.fetch(channelId);
        } else {
          const firstGuild = this.discordBot.guilds.cache.first();
          if (firstGuild) {
            channel = firstGuild.systemChannel || 
                      firstGuild.channels.cache.find(c => c.type === 0 && c.permissionsFor(this.discordBot.user)?.has('SendMessages'));
          }
        }

        if (!channel) {
          result.message = 'No available channel found. Please provide a channel ID.';
          return result;
        }

        await channel.send(testMessage);
        result.success = true;
        result.message = `Test notification sent to #${channel.name}`;
        result.channelId = channel.id;
        result.channelName = channel.name;
      } catch (error) {
        result.message = error.message;
      }
    } else if (platform === 'slack') {
      if (!this.slackBot) {
        result.message = 'Slack bot not connected';
        return result;
      }

      try {
        let targetChannel = channelId;
        
        if (!targetChannel) {
          const channelsResult = await this.slackBot.client.conversations.list({
            types: 'public_channel,private_channel',
            limit: 10,
          });
          const channel = channelsResult.channels?.find(c => c.is_member);
          if (channel) {
            targetChannel = channel.id;
          }
        }

        if (!targetChannel) {
          result.message = 'No available channel found. Please provide a channel ID or invite the bot to a channel.';
          return result;
        }

        const postResult = await this.slackBot.client.chat.postMessage({
          channel: targetChannel,
          text: testMessage,
          mrkdwn: true,
        });

        result.success = true;
        result.message = `Test notification sent to channel`;
        result.channelId = postResult.channel;
        result.ts = postResult.ts;
      } catch (error) {
        result.message = error.message;
      }
    } else {
      result.message = `Unknown platform: ${platform}`;
    }

    return result;
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
