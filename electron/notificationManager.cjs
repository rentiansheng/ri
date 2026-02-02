/**
 * 通知管理器
 * 负责协调系统通知、应用内通知和外部通知渠道
 */

const { Notification } = require('electron');
const { ChannelFactory } = require('./notificationChannels.cjs');

class NotificationManager {
  constructor(mainWindow, config) {
    this.mainWindow = mainWindow;
    this.config = config || {};
    this.channels = {};
    this.initializeChannels();
  }

  /**
   * 初始化所有启用的通知渠道
   */
  initializeChannels() {
    console.log('[NotificationManager] initializeChannels() called');
    
    if (!this.config.notification || !this.config.notification.channels) {
      console.log('[NotificationManager] No notification channels configured');
      return;
    }

    const channelConfigs = this.config.notification.channels;
    console.log('[NotificationManager] Channel configs:', JSON.stringify(channelConfigs, null, 2));

    // 初始化外部渠道
    const channelTypes = ['slack', 'discord', 'telegram', 'dingtalk', 'wecom'];
    channelTypes.forEach(type => {
      console.log(`[NotificationManager] Checking ${type} channel...`);
      if (channelConfigs[type] && channelConfigs[type].enabled) {
        console.log(`[NotificationManager] ${type} is enabled, creating channel...`);
        try {
          this.channels[type] = ChannelFactory.create(type, channelConfigs[type]);
          console.log(`[NotificationManager] Initialized ${type} channel successfully`);
        } catch (error) {
          console.error(`[NotificationManager] Failed to initialize ${type} channel:`, error.message);
        }
      } else {
        console.log(`[NotificationManager] ${type} is not enabled or not configured`);
      }
    });
    
    console.log('[NotificationManager] Final channels:', Object.keys(this.channels));
  }

  /**
   * 更新配置
   */
  updateConfig(config) {
    this.config = config;
    this.channels = {};
    this.initializeChannels();
  }

  /**
   * 发送通知到所有启用的渠道
   * @param {Object} payload - { sessionId, sessionName, title, body, type, icon }
   */
  async send(payload) {
    const { sessionId, sessionName, title, body, type, icon } = payload;

    if (!this.config.notification || !this.config.notification.enabled) {
      console.log('[NotificationManager] Notifications are disabled');
      return { success: false, error: 'Notifications disabled' };
    }

    // Generate unique notification ID
    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const results = {
      system: null,
      inApp: null,
      external: {}
    };

    const channels = this.config.notification.channels || {};

    // 1. 发送系统通知
    if (channels.system && channels.system.enabled) {
      try {
        await this.sendSystemNotification({ ...payload, notificationId });
        results.system = { success: true };
        console.log('[NotificationManager] System notification sent');
      } catch (error) {
        console.error('[NotificationManager] System notification failed:', error.message);
        results.system = { success: false, error: error.message };
      }
    }

    // 2. 发送应用内通知（通过渲染进程）
    if (channels.inApp && channels.inApp.enabled) {
      try {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('notification:received', {
            id: notificationId,
            sessionId,
            sessionName,
            title,
            body,
            type,
            icon,
            timestamp: Date.now()
          });
          results.inApp = { success: true, id: notificationId };
          console.log('[NotificationManager] In-app notification sent');
        }
      } catch (error) {
        console.error('[NotificationManager] In-app notification failed:', error.message);
        results.inApp = { success: false, error: error.message };
      }
    }

    // 3. 发送到外部渠道
    const externalPromises = Object.keys(this.channels).map(async (channelType) => {
      try {
        const channel = this.channels[channelType];
        if (channel && channel.isEnabled()) {
          const result = await channel.send(payload);
          results.external[channelType] = result;
          console.log(`[NotificationManager] ${channelType} notification sent`);
        }
      } catch (error) {
        console.error(`[NotificationManager] ${channelType} notification failed:`, error.message);
        results.external[channelType] = { success: false, error: error.message };
      }
    });

    await Promise.allSettled(externalPromises);

    return {
      success: true,
      results
    };
  }

  /**
   * 发送 macOS 系统通知
   */
  async sendSystemNotification(payload) {
    const { sessionId, sessionName, notificationId, title, body, type, icon } = payload;

    const notification = new Notification({
      title: sessionName || 'Terminal',
      body: `${title}: ${body}`,
      icon: icon || this.getIconByType(type),
      silent: false
    });

    // 监听点击事件
    notification.on('click', () => {
      this.handleNotificationClick(sessionId, notificationId);
    });

    notification.show();
    return { success: true };
  }

  /**
   * 处理通知点击
   */
  handleNotificationClick(sessionId, notificationId) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    // 激活窗口
    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }
    this.mainWindow.show();
    this.mainWindow.focus();

    // 通知渲染进程 - include notificationId for dismissal
    this.mainWindow.webContents.send('notification:clicked', { sessionId, notificationId });
  }

  /**
   * 根据类型获取图标
   */
  getIconByType(type) {
    // 可以后续添加自定义图标
    return null; // macOS 会使用应用图标
  }

  /**
   * 测试通知渠道
   */
  async testChannel(channelType) {
    console.log('[NotificationManager] testChannel called for:', channelType);
    console.log('[NotificationManager] Available channels:', Object.keys(this.channels));
    
    const channel = this.channels[channelType];
    
    if (!channel) {
      console.error('[NotificationManager] Channel not found or disabled:', channelType);
      return { success: false, error: `Channel ${channelType} not configured or disabled` };
    }

    console.log('[NotificationManager] Channel found, sending test notification...');
    
    try {
      const testNotification = {
        sessionId: 'test',
        sessionName: 'Test Session',
        title: '测试通知',
        body: `这是一条来自 Second Brain OS 的 ${channelType} 测试通知`,
        type: 'info'
      };

      console.log('[NotificationManager] Test payload:', testNotification);
      const result = await channel.send(testNotification);
      console.log('[NotificationManager] Send result:', result);
      return { success: true, result };
    } catch (error) {
      console.error('[NotificationManager] Send failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = NotificationManager;
