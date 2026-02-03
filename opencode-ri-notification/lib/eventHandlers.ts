/**
 * OpenCode 事件处理器
 * 监听各种 OpenCode 事件并触发通知
 */

import type { RINotifier } from "./notifier";
import type { NotificationConfig } from "./config";

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
    if (!this.config.events.sessionIdle) return;

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
    if (!this.config.events.sessionError) return;

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

    // 检查是否是构建命令
    if (this.config.events.buildComplete && this.isBuildCommand(command)) {
      await this.notifier.send({
        type: success ? "success" : "error",
        message: success 
          ? this.config.messageTemplates.buildSuccess 
          : this.config.messageTemplates.buildError,
        duration,
      });
      return;
    }

    // 检查是否是测试命令
    if (this.config.events.testComplete && this.isTestCommand(command)) {
      await this.notifier.send({
        type: success ? "success" : "error",
        message: success 
          ? this.config.messageTemplates.testSuccess 
          : this.config.messageTemplates.testError,
        duration,
      });
      return;
    }

    // 检查是否是长时间运行命令
    if (this.config.events.longRunningCommand && duration >= this.config.minDuration) {
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
    if (!this.config.events.permissionAsked) return;

    const tool = input.tool || input.permission?.tool || "操作";
    const message = this.config.messageTemplates.permissionAsked.replace("{tool}", tool);
    
    await this.notifier.send({
      type: "info",
      message,
      tool,
    });
  }

  /**
   * 检查是否是构建命令
   */
  private isBuildCommand(command: string): boolean {
    const lowerCommand = command.toLowerCase();
    return this.config.buildCommands.some(cmd => lowerCommand.includes(cmd.toLowerCase()));
  }

  /**
   * 检查是否是测试命令
   */
  private isTestCommand(command: string): boolean {
    const lowerCommand = command.toLowerCase();
    return this.config.testCommands.some(cmd => lowerCommand.includes(cmd.toLowerCase()));
  }
}
