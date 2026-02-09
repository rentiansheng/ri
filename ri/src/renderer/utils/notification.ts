/**
 * 桌面通知工具
 */

import { Session, AIToolState } from '../store/terminalStore';

/**
 * 发送桌面通知
 * @param session 会话对象
 * @param state AI 工具状态
 */
export function sendNotification(session: Session, state: AIToolState): void {
  // 检查浏览器是否支持通知
  if (!('Notification' in window)) {
    console.warn('[Notification] Browser does not support notifications');
    return;
  }
  
  // 如果已授权，直接发送通知
  if (Notification.permission === 'granted') {
    createNotification(session, state);
  } 
  // 如果未拒绝，请求权限
  else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        createNotification(session, state);
      }
    });
  }
}

/**
 * 创建通知实例
 */
function createNotification(session: Session, state: AIToolState): void {
  const title = `${session.name} - ${state.tool || 'AI Tool'}`;
  
  let body = '';
  switch (state.status) {
    case 'waiting':
      body = state.prompt || '等待用户输入';
      break;
    case 'thinking':
      body = '正在思考中...';
      break;
    case 'executing':
      body = '正在执行操作...';
      break;
    case 'completed':
      body = '任务已完成';
      break;
    default:
      body = `状态: ${state.status}`;
  }
  
  new Notification(title, {
    body,
    icon: '/icon.png', // 可以添加应用图标
    tag: session.id,   // 使用 session ID 作为 tag，防止同一 session 重复通知
    requireInteraction: state.status === 'waiting', // 等待输入时需要用户交互
  });
}

/**
 * 请求通知权限
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  
  return await Notification.requestPermission();
}
