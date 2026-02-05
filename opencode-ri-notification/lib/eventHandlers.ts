/**
 * RI 通知发送器
 * 通过 __OM_NOTIFY 协议发送通知到 RI 终端
 */

import type { RINotifier } from "./notifier.js";
import type { NotificationConfig } from "./config.js";
import { appendFileSync } from "fs";

export class EventHandlers {
  // 记录命令开始时间，用于计算执行时长
  private commandStartTimes = new Map<string, number>();

  constructor(
    private notifier: RINotifier,
    private config: NotificationConfig
  ) {}

  /**
   * 会话空闲事件（任务完成）
   * 触发时机: OpenCode 完成响应并等待下一个输入
   */
  async onSessionIdle(input: any, output: any): Promise<void> {
    appendFileSync('/tmp/ri.log', `[${new Date().toISOString()}] 📥 Event: session.idle\ninput: ${JSON.stringify(input).slice(0, 200)}\noutput: ${JSON.stringify(output).slice(0, 2000)}\n`);
    //if (!this.config.events.sessionIdle) return;

    await this.notifier.send({
      type: "completed",
      message: this.config.messageTemplates.sessionIdle,
    });
  }

  /**
   * 会话错误事件
   * 触发时机: OpenCode 执行过程中发生错误
   */
  async onSessionError(input: any, output: any): Promise<void> {
    appendFileSync('/tmp/ri.log', `[${new Date().toISOString()}] 📥 Event: session.error\ninput: ${JSON.stringify(input).slice(0, 200)}\noutput: ${JSON.stringify(output).slice(0, 2000)}\n`);
    //if (!this.config.events.sessionError) return;

    const errorMsg = input.error?.message || input.message || "未知错误";
    await this.notifier.send({
      type: "error",
      message: `错误: ${errorMsg}`,
    });
  }

  /**
   * 工具执行前事件
   * 用于记录命令开始时间
   */
  async onToolExecuteBefore(input: any, output: any): Promise<void> {
    appendFileSync('/tmp/ri.log', `[${new Date().toISOString()}] 📥 Event: tool.execute.before - tool=${input.tool}\ninput: ${JSON.stringify(input).slice(0, 200)}\noutput: ${JSON.stringify(output).slice(0, 2000)}\n`);
    if (input.tool === "bash" && output.args?.command) {
      const command = output.args.command;
      this.commandStartTimes.set(command, Date.now());
    }
  }

  /**
   * 工具执行完成事件（构建/测试/长时间命令）
   * 触发时机: bash、npm、cargo 等工具执行完成
   */
  async onToolExecuteAfter(input: any, output: any): Promise<void> {
    appendFileSync('/tmp/ri.log', `[${new Date().toISOString()}] 📥 Event: tool.execute.after - tool=${input.tool}\ninput: ${JSON.stringify(input).slice(0, 200)}\noutput: ${JSON.stringify(output).slice(0, 2000)}\n`);
    // 只处理 bash 工具
    if (input.tool !== "bash") return;

    const command = input.args?.command || output.args?.command || "";
    if (!command) return;

    // 计算命令执行时长
    const startTime = this.commandStartTimes.get(command);
    const duration = startTime ? Date.now() - startTime : 0;
    
    // 清理缓存
    this.commandStartTimes.delete(command);

    const exitCode = output.exitCode ?? 0;
    const success = exitCode === 0;

    // 检查是否是长时间运行命令
    if (/*this.config.events.longRunningCommand &&*/ duration >= this.config.minDuration) {
      await this.notifier.send({
        type: "completed",
        message: this.config.messageTemplates.longCommand,
        duration,
      });
    }
  }

  /**
   * 权限请求事件
   * 触发时机: OpenCode 需要用户授权某个操作
   */
  async onPermissionAsked(input: any, output: any): Promise<void> {
    appendFileSync('/tmp/ri.log', `[${new Date().toISOString()}] 📥 Event: permission.asked\ninput: ${JSON.stringify(input).slice(0, 200)}\noutput: ${JSON.stringify(output).slice(0, 2000)}\n`);
    //if (!this.config.events.permissionAsked) return;

    const tool = input.tool || input.permission?.tool || "操作";
    const message = this.config.messageTemplates.permissionAsked.replace("{tool}", tool);
    
    await this.notifier.send({
      type: "info",
      message,
      tool,
    });
  }

  async onPermissionReplied(input: any, output: any): Promise<void> {
    appendFileSync('/tmp/ri.log', `[${new Date().toISOString()}] 📥 Event: permission.replied\ninput: ${JSON.stringify(input).slice(0, 200)}\noutput: ${JSON.stringify(output).slice(0, 2000)}\n`);
    //if (!this.config.events.permissionAsked) return;

    const tool = input.tool || input.permission?.tool || "操作";
    const granted = input.permission?.granted ?? false;
    const message = granted 
      ? `已授权: ${tool}` 
      : `已拒绝授权: ${tool}`;
    
    await this.notifier.send({
      type: granted ? "success" : "error",
      message,
      tool,
    });
  } 

  async onMessageReceived(input: any, output: any): Promise<void> {
    appendFileSync('/tmp/ri.log', `[${new Date().toISOString()}] 📥 Event: message.received\ninput: ${JSON.stringify(input).slice(0, 200)}\noutput: ${JSON.stringify(output).slice(0, 2000)}\n`);
    // 可根据需要实现消息接收通知
  }

  async onMessageUpdated(input: any, output: any): Promise<void> {
    appendFileSync('/tmp/ri.log', `[${new Date().toISOString()}] 📥 Event: message.updated\ninput: ${JSON.stringify(input).slice(0, 200)}\noutput: ${JSON.stringify(output).slice(0, 2000)}\n`);
    // 可根据需要实现消息更新通知
  }

  async onTuiToastShow(input: any, output: any): Promise<void> {
    appendFileSync('/tmp/ri.log', `[${new Date().toISOString()}] 📥 Event: tui.toast.show\ninput: ${JSON.stringify(input).slice(0, 200)}\noutput: ${JSON.stringify(output).slice(0, 2000)}\n`);
  }

  async onMessagePartUpdated(input: any, output: any): Promise<void> {
    appendFileSync('/tmp/ri.log', `[${new Date().toISOString()}] 📥 Event: message.part.updated\ninput: ${JSON.stringify(input).slice(0, 200)}\noutput: ${JSON.stringify(output).slice(0, 2000)}\n`);
    // 可根据需要实现消息部分更新通知
  }

 
}
