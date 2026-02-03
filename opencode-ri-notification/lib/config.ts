/**
 * 配置管理器
 * 负责加载和合并全局配置、项目配置
 */

import * as fs from "fs/promises";
import * as path from "path";

export interface NotificationConfig {
  enabled: boolean;
  minDuration: number; // 长时间命令阈值（毫秒）
  events: {
    sessionIdle: boolean;
    buildComplete: boolean;
    testComplete: boolean;
    sessionError: boolean;
    permissionAsked: boolean;
    longRunningCommand: boolean;
  };
  buildCommands: string[];
  testCommands: string[];
  messageTemplates: Record<string, string>;
}

const DEFAULT_CONFIG: NotificationConfig = {
  enabled: true,
  minDuration: 30000, // 30 seconds
  events: {
    sessionIdle: true,
    buildComplete: true,
    testComplete: true,
    sessionError: true,
    permissionAsked: true,
    longRunningCommand: true,
  },
  buildCommands: [
    "npm run build",
    "yarn build",
    "pnpm build",
    "bun run build",
    "make",
    "make build",
    "cargo build",
    "go build",
    "mvn package",
    "gradle build",
  ],
  testCommands: [
    "npm test",
    "npm run test",
    "yarn test",
    "pnpm test",
    "bun test",
    "pytest",
    "cargo test",
    "go test",
    "mvn test",
    "gradle test",
  ],
  messageTemplates: {
    sessionIdle: "任务已完成",
    buildSuccess: "构建成功 ✓",
    buildError: "构建失败 ✗",
    testSuccess: "测试通过 ✓",
    testError: "测试失败 ✗",
    permissionAsked: "需要授权: {tool}",
    longCommand: "命令执行完成 ({duration}s)",
  },
};

export class ConfigManager {
  /**
   * 加载配置（全局 + 项目级）
   */
  static async load(directory: string): Promise<NotificationConfig> {
    const config = { ...DEFAULT_CONFIG };

    // 1. 加载全局配置
    const globalConfig = await this.loadGlobalConfig();
    if (globalConfig) {
      this.mergeConfig(config, globalConfig);
    }

    // 2. 加载项目配置（优先级更高）
    const projectConfig = await this.loadProjectConfig(directory);
    if (projectConfig) {
      this.mergeConfig(config, projectConfig);
    }

    return config;
  }

  /**
   * 加载全局配置
   */
  private static async loadGlobalConfig(): Promise<Partial<NotificationConfig> | null> {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      if (!homeDir) return null;

      const configPath = path.join(homeDir, ".config", "opencode", "opencode.json");
      const content = await fs.readFile(configPath, "utf-8");
      const json = JSON.parse(content);
      return json.riNotification || null;
    } catch (error) {
      // 配置文件不存在或解析失败，使用默认配置
      return null;
    }
  }

  /**
   * 加载项目配置
   */
  private static async loadProjectConfig(directory: string): Promise<Partial<NotificationConfig> | null> {
    try {
      const configPath = path.join(directory, ".opencode", "opencode.json");
      const content = await fs.readFile(configPath, "utf-8");
      const json = JSON.parse(content);
      return json.riNotification || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 深度合并配置
   */
  private static mergeConfig(target: NotificationConfig, source: Partial<NotificationConfig>): void {
    for (const key in source) {
      const value = source[key as keyof NotificationConfig];
      if (value === undefined) continue;

      if (typeof value === "object" && !Array.isArray(value) && value !== null) {
        // 递归合并对象
        const targetValue = target[key as keyof NotificationConfig];
        if (typeof targetValue === "object" && !Array.isArray(targetValue)) {
          Object.assign(targetValue, value);
        } else {
          (target as any)[key] = value;
        }
      } else {
        // 直接覆盖
        (target as any)[key] = value;
      }
    }
  }
}
