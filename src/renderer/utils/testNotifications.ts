/**
 * Notification System Test Helper
 * 
 * Usage in DevTools Console:
 * 1. Open DevTools (already open in dev mode)
 * 2. Run: testNotifications.basic()
 * 3. Run: testNotifications.all()
 * 4. Run: testNotifications.spam()
 */

import { useTerminalStore } from '../store/terminalStore';
import { NotificationType } from '../types/global';

export const testNotifications = {
  /**
   * Get current session info
   */
  getSession() {
    const sessions = useTerminalStore.getState().sessions;
    if (sessions.length === 0) {
      console.warn('⚠️ No sessions found. Please create a session first.');
      return null;
    }
    const session = sessions[0];
    console.log('📱 Using session:', session.name, `(ID: ${session.id})`);
    return session;
  },

  /**
   * Send a single test notification
   */
  async basic(type: NotificationType = 'info') {
    const session = this.getSession();
    if (!session) return;

    const messages = {
      info: { title: 'Info Test', body: 'This is an informational notification' },
      success: { title: 'Success!', body: 'Operation completed successfully' },
      warning: { title: 'Warning', body: 'This action may have consequences' },
      error: { title: 'Error Occurred', body: 'Something went wrong' },
    };

    const msg = messages[type];
    console.log(`📬 Sending ${type} notification...`);

    const result = await window.notification.send({
      sessionId: session.id,
      sessionName: session.name,
      title: msg.title,
      body: msg.body,
      type: type,
    });

    console.log('✅ Result:', result);
    return result;
  },

  /**
   * Test all notification types
   */
  async all() {
    const session = this.getSession();
    if (!session) return;

    console.log('📬 Sending all notification types...');

    const types: NotificationType[] = ['info', 'success', 'warning', 'error'];
    const results = [];

    for (const type of types) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const result = await this.basic(type);
      results.push(result);
    }

    console.log('✅ All notifications sent:', results);
    return results;
  },

  /**
   * Test notification aggregation (max 3 per session)
   */
  async spam(count: number = 5) {
    const session = this.getSession();
    if (!session) return;

    console.log(`📬 Sending ${count} notifications to test aggregation...`);

    const results = [];
    for (let i = 1; i <= count; i++) {
      const result = await window.notification.send({
        sessionId: session.id,
        sessionName: session.name,
        title: `Test Notification ${i}`,
        body: `This is test message number ${i} of ${count}`,
        type: 'info',
      });
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`✅ Sent ${count} notifications. Check that only 3 are kept in NotifyView.`);
    return results;
  },

  /**
   * Test multiple sessions
   */
  async multiSession() {
    const sessions = useTerminalStore.getState().sessions;
    if (sessions.length < 2) {
      console.warn('⚠️ Need at least 2 sessions. Please create more sessions first.');
      return;
    }

    console.log(`📬 Sending notifications to ${sessions.length} sessions...`);

    const results = [];
    for (let i = 0; i < Math.min(3, sessions.length); i++) {
      const session = sessions[i];
      const result = await window.notification.send({
        sessionId: session.id,
        sessionName: session.name,
        title: `Notification for ${session.name}`,
        body: `This notification is for session ${i + 1}`,
        type: i % 2 === 0 ? 'info' : 'success',
      });
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('✅ Notifications sent to multiple sessions');
    return results;
  },

  /**
   * Test external channels (requires configuration)
   */
  async testChannel(channel: 'slack' | 'discord' | 'telegram' | 'dingtalk') {
    console.log(`🧪 Testing ${channel} channel...`);
    
    const result = await window.notification.testChannel(channel);
    
    if (result.success) {
      console.log(`✅ ${channel} test successful:`, result);
    } else {
      console.error(`❌ ${channel} test failed:`, result.error);
    }
    
    return result;
  },

  /**
   * Clear all notifications
   */
  async clearAll() {
    console.log('🧹 Clearing all notifications...');
    const result = await window.notification.clearAll();
    console.log('✅ Cleared:', result);
    return result;
  },

  /**
   * Show all available test commands
   */
  help() {
    console.log(`
🔔 Notification System Test Helper
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Basic Tests:
  testNotifications.basic()              - Send one info notification
  testNotifications.basic('success')     - Send one success notification
  testNotifications.basic('warning')     - Send one warning notification
  testNotifications.basic('error')       - Send one error notification
  testNotifications.all()                - Send all types

Advanced Tests:
  testNotifications.spam(5)              - Send 5 notifications (test aggregation)
  testNotifications.multiSession()       - Send to multiple sessions

External Channels:
  testNotifications.testChannel('slack')    - Test Slack integration
  testNotifications.testChannel('discord')  - Test Discord integration
  testNotifications.testChannel('telegram') - Test Telegram integration
  testNotifications.testChannel('dingtalk') - Test DingTalk integration

Utilities:
  testNotifications.clearAll()           - Clear all notifications
  testNotifications.help()               - Show this help

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  }
};

// Export to window for easy access in DevTools
if (typeof window !== 'undefined') {
  (window as any).testNotifications = testNotifications;
  console.log('✅ Test helper loaded! Run: testNotifications.help()');
}

export default testNotifications;
