/**
 * 外部通知渠道适配器
 * 支持: Slack, Discord, Telegram, DingTalk
 * 自动支持系统代理
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { HttpsProxyAgent } = require('https-proxy-agent');

/**
 * 获取代理配置
 * 自动检测环境变量中的代理设置
 */
function getProxyAgent() {
  const proxy = process.env.https_proxy || process.env.HTTPS_PROXY || 
                process.env.http_proxy || process.env.HTTP_PROXY;
  
  if (proxy) {
    console.log(`[NotificationChannels] Using proxy: ${proxy}`);
    return new HttpsProxyAgent(proxy);
  }
  
  return null;
}

/**
 * 基础通知渠道接口
 */
class NotificationChannel {
  constructor(config) {
    this.config = config;
    this.proxyAgent = getProxyAgent();
  }

  async send(notification) {
    throw new Error('send() must be implemented by subclass');
  }

  isEnabled() {
    return this.config && this.config.enabled === true;
  }
}

/**
 * Slack 通知渠道
 */
class SlackChannel extends NotificationChannel {
  async send(notification) {
    if (!this.config.webhookUrl) {
      throw new Error('Slack webhook URL is required');
    }

    const { sessionName, title, body, type } = notification;
    
    // 根据类型选择颜色
    const colorMap = {
      info: '#007acc',
      success: '#4ec9b0',
      warning: '#d4a259',
      error: '#f48771'
    };

    const payload = {
      username: this.config.username || 'Second Brain OS',
      icon_emoji: this.config.iconEmoji || ':robot_face:',
      channel: this.config.channel,
      attachments: [
        {
          color: colorMap[type] || '#007acc',
          title: `[${sessionName}] ${title}`,
          text: body,
          footer: 'Second Brain OS',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    return this._sendWebhook(this.config.webhookUrl, payload);
  }

  _sendWebhook(url, payload) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // 添加代理支持
      if (this.proxyAgent) {
        options.agent = this.proxyAgent;
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, response: data });
          } else {
            reject(new Error(`Slack API error: ${res.statusCode} ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Slack request failed: ${error.message}`));
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  }
}

/**
 * Discord 通知渠道
 */
class DiscordChannel extends NotificationChannel {
  async send(notification) {
    console.log('[DiscordChannel] send() called with:', notification);
    
    if (!this.config.webhookUrl) {
      console.error('[DiscordChannel] No webhook URL configured');
      throw new Error('Discord webhook URL is required');
    }

    console.log('[DiscordChannel] Webhook URL:', this.config.webhookUrl.substring(0, 50) + '...');
    console.log('[DiscordChannel] Proxy agent:', this.proxyAgent ? 'configured' : 'not configured');

    const { sessionName, title, body, type } = notification;
    
    // 根据类型选择颜色 (Discord uses decimal colors)
    const colorMap = {
      info: 0x007acc,
      success: 0x4ec9b0,
      warning: 0xd4a259,
      error: 0xf48771
    };

    const payload = {
      username: this.config.username || 'Second Brain OS',
      embeds: [
        {
          color: colorMap[type] || 0x007acc,
          title: `[${sessionName}] ${title}`,
          description: body,
          footer: {
            text: 'Second Brain OS'
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

    console.log('[DiscordChannel] Sending payload:', JSON.stringify(payload, null, 2));
    return this._sendWebhook(this.config.webhookUrl, payload);
  }

  _sendWebhook(url, payload) {
    console.log('[DiscordChannel] _sendWebhook() starting...');
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // 添加代理支持
      if (this.proxyAgent) {
        console.log('[DiscordChannel] Using proxy agent');
        options.agent = this.proxyAgent;
      }

      console.log('[DiscordChannel] Making HTTPS request to:', urlObj.hostname);

      const req = https.request(options, (res) => {
        console.log('[DiscordChannel] Response status:', res.statusCode);
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log('[DiscordChannel] Response data:', data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('[DiscordChannel] Request successful');
            resolve({ success: true, response: data });
          } else {
            console.error('[DiscordChannel] Request failed with status:', res.statusCode);
            reject(new Error(`Discord API error: ${res.statusCode} ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('[DiscordChannel] Request error:', error);
        reject(new Error(`Discord request failed: ${error.message}`));
      });

      req.write(JSON.stringify(payload));
      req.end();
      console.log('[DiscordChannel] Request sent, waiting for response...');
    });
  }
}

/**
 * Telegram 通知渠道
 */
class TelegramChannel extends NotificationChannel {
  async send(notification) {
    if (!this.config.botToken || !this.config.chatId) {
      throw new Error('Telegram bot token and chat ID are required');
    }

    const { sessionName, title, body, type } = notification;
    
    // 使用 emoji 表示类型
    const emojiMap = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    const text = `${emojiMap[type] || 'ℹ️'} *[${sessionName}] ${title}*\n\n${body}`;

    const payload = {
      chat_id: this.config.chatId,
      text: text,
      parse_mode: 'Markdown'
    };

    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
    return this._sendRequest(url, payload);
  }

  _sendRequest(url, payload) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // 添加代理支持
      if (this.proxyAgent) {
        options.agent = this.proxyAgent;
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, response: data });
          } else {
            reject(new Error(`Telegram API error: ${res.statusCode} ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Telegram request failed: ${error.message}`));
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  }
}

/**
 * 钉钉通知渠道
 */
class DingTalkChannel extends NotificationChannel {
  async send(notification) {
    if (!this.config.webhookUrl) {
      throw new Error('DingTalk webhook URL is required');
    }

    const { sessionName, title, body, type } = notification;
    
    // 使用 emoji 表示类型
    const emojiMap = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    const text = `${emojiMap[type] || 'ℹ️'} [${sessionName}] ${title}\n\n${body}`;

    const payload = {
      msgtype: 'text',
      text: {
        content: text
      }
    };

    // 如果配置了签名密钥，添加签名
    let url = this.config.webhookUrl;
    if (this.config.secret) {
      const timestamp = Date.now();
      const sign = this._generateSign(timestamp, this.config.secret);
      url = `${url}&timestamp=${timestamp}&sign=${sign}`;
    }

    return this._sendWebhook(url, payload);
  }

  _generateSign(timestamp, secret) {
    const stringToSign = `${timestamp}\n${secret}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(stringToSign);
    const sign = encodeURIComponent(hmac.digest('base64'));
    return sign;
  }

  _sendWebhook(url, payload) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // 添加代理支持
      if (this.proxyAgent) {
        options.agent = this.proxyAgent;
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const result = JSON.parse(data);
            if (result.errcode === 0) {
              resolve({ success: true, response: data });
            } else {
              reject(new Error(`DingTalk API error: ${result.errmsg}`));
            }
          } else {
            reject(new Error(`DingTalk HTTP error: ${res.statusCode} ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`DingTalk request failed: ${error.message}`));
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  }
}

/**
 * 企业微信通知渠道
 */
class WeComChannel extends NotificationChannel {
  async send(notification) {
    if (!this.config.webhookUrl) {
      throw new Error('WeCom webhook URL is required');
    }

    const { sessionName, title, body, type } = notification;
    
    // 使用 emoji 表示类型
    const emojiMap = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    // 企业微信支持 markdown 格式
    const markdown = `${emojiMap[type] || 'ℹ️'} **[${sessionName}] ${title}**\n\n${body}`;

    const payload = {
      msgtype: 'markdown',
      markdown: {
        content: markdown
      }
    };

    return this._sendWebhook(this.config.webhookUrl, payload);
  }

  _sendWebhook(url, payload) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // 添加代理支持
      if (this.proxyAgent) {
        options.agent = this.proxyAgent;
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const result = JSON.parse(data);
            if (result.errcode === 0) {
              resolve({ success: true, response: data });
            } else {
              reject(new Error(`WeCom API error: ${result.errmsg}`));
            }
          } else {
            reject(new Error(`WeCom HTTP error: ${res.statusCode} ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`WeCom request failed: ${error.message}`));
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  }
}

/**
 * 通知渠道工厂
 */
class ChannelFactory {
  static create(type, config) {
    switch (type) {
      case 'slack':
        return new SlackChannel(config);
      case 'discord':
        return new DiscordChannel(config);
      case 'telegram':
        return new TelegramChannel(config);
      case 'dingtalk':
        return new DingTalkChannel(config);
      case 'wecom':
        return new WeComChannel(config);
      default:
        throw new Error(`Unknown channel type: ${type}`);
    }
  }
}

module.exports = {
  NotificationChannel,
  SlackChannel,
  DiscordChannel,
  TelegramChannel,
  DingTalkChannel,
  WeComChannel,
  ChannelFactory
};
