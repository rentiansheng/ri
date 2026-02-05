/**
 * RI 通知发送器
 * 通过 __OM_NOTIFY 协议发送通知到 RI 终端
 */

import type { RIDetector } from "./detector.js";
import type { NotificationConfig } from "./config.js";

export interface NotificationPayload {
  type: "info" | "success" | "error" | "completed";
  message: string;
  duration?: number;
  tool?: string;
}

export class RINotifier {
  constructor(
    private $: any,
    private detector: RIDetector,
    private config: NotificationConfig
  ) {}

  /**
   * 发送通知到 RI
   * 使用 OSC 不可见序列，不干扰终端输出
   */
  async send(payload: NotificationPayload): Promise<void> {
    const { type, message } = payload;
    
    // 格式化消息模板
    const formattedMessage = this.formatMessage(message, payload);
    
    // 使用 OSC 不可见序列（推荐）
    // 格式: \x1b]__OM_NOTIFY:type:message__\x07
    const oscSequence = `\x1b]__OM_NOTIFY:${type}:${formattedMessage}__\x07`;
    
    try {
      // 输出到终端，RI 会自动捕获
      await this.$`printf ${oscSequence}`;
      
      console.log(`[RINotification] Sent: ${type} - ${formattedMessage}`);
    } catch (error) {
      console.error(`[RINotification] Failed to send notification:`, error);
      
      // Fallback: 使用可见文本格式
      try {
        const visibleFormat = `__OM_NOTIFY:${type}:${formattedMessage}__`;
        await this.$`echo ${visibleFormat}`;
      } catch (fallbackError) {
        console.error(`[RINotification] Fallback also failed:`, fallbackError);
      }
    }
  }

  /**
   * 格式化消息模板
   * 支持变量替换: {duration}, {tool}, {session}
   */
  private formatMessage(message: string, payload: NotificationPayload): string {
    let formatted = message;
    
    // 替换 {duration}
    if (payload.duration !== undefined) {
      const seconds = (payload.duration / 1000).toFixed(1);
      formatted = formatted.replace(/\{duration\}/g, seconds);
    }
    
    // 替换 {tool}
    if (payload.tool) {
      formatted = formatted.replace(/\{tool\}/g, payload.tool);
    }
    
    // 替换 {session}
    formatted = formatted.replace(/\{session\}/g, this.detector.getSessionName());
    
    return formatted;
  }

  /**
   * 快捷方法: 发送信息通知
   */
  async info(message: string, payload?: Partial<NotificationPayload>): Promise<void> {
    await this.send({ type: "info", message, ...payload });
  }

  /**
   * 快捷方法: 发送成功通知
   */
  async success(message: string, payload?: Partial<NotificationPayload>): Promise<void> {
    await this.send({ type: "success", message, ...payload });
  }

  /**
   * 快捷方法: 发送错误通知
   */
  async error(message: string, payload?: Partial<NotificationPayload>): Promise<void> {
    await this.send({ type: "error", message, ...payload });
  }

  /**
   * 快捷方法: 发送完成通知
   */
  async completed(message: string, payload?: Partial<NotificationPayload>): Promise<void> {
    await this.send({ type: "completed", message, ...payload });
  }
}
