/**
 * RI 环境检测器
 * 检测当前是否在 Second Brain OS (RI) 终端中运行
 */

export class RIDetector {
  private sessionId: string | undefined;
  private sessionName: string | undefined;
  private inRI: boolean;

  constructor() {
    this.sessionId = process.env.RI_SESSION_ID;
    this.sessionName = process.env.RI_SESSION_NAME;
    this.inRI = process.env.RI_TERMINAL === "true" && !!this.sessionId;
  }

  /**
   * 检查是否在 RI 终端中运行
   */
  isInRI(): boolean {
    return this.inRI;
  }

  /**
   * 获取当前会话 ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * 获取当前会话名称
   */
  getSessionName(): string {
    return this.sessionName || "OpenCode";
  }

  /**
   * 获取环境信息（用于调试）
   */
  getEnvInfo(): Record<string, any> {
    return {
      inRI: this.inRI,
      sessionId: this.sessionId,
      sessionName: this.sessionName,
      env: {
        RI_TERMINAL: process.env.RI_TERMINAL,
        RI_SESSION_ID: process.env.RI_SESSION_ID,
        RI_SESSION_NAME: process.env.RI_SESSION_NAME,
      },
    };
  }
}
