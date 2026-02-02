/**
 * OpenCode RI Notification Plugin
 * 
 * 自动检测 Second Brain OS (RI) 终端环境，
 * 在 OpenCode 完成任务、构建、测试或需要授权时发送通知。
 * 
 * @author Your Name
 * @license MIT
 */

import type { Plugin } from "@opencode-ai/plugin";
import { RIDetector } from "./lib/detector.js";
import { RINotifier } from "./lib/notifier.js";
import { EventHandlers } from "./lib/eventHandlers.js";
import { ConfigManager } from "./lib/config.js";
import { appendFileSync } from "fs";

export const RINotificationPlugin: Plugin = async (ctx) => {
  const { $, client, directory } = ctx;
  
  // 立即写入日志，证明插件被调用了
  try {
    const timestamp = new Date().toISOString();
   } catch (e) {
    // 忽略写入错误
  }
  
  // 1. 检测是否在 RI 终端中
  const detector = new RIDetector();
  
  try {
    const isInRI = detector.isInRI();
    appendFileSync("/tmp/ri.log", `[${new Date().toISOString()}] RI detection: ${isInRI}\n`);
    
    if (!isInRI) {
      appendFileSync("/tmp/ri.log", `[${new Date().toISOString()}] Not in RI terminal, plugin disabled\n`);
      await client.app.log({
        service: "ri-notification",
        level: "info",
        message: "Not running in RI terminal, plugin disabled",
        extra: detector.getEnvInfo(),
      });
      return {}; // 插件不执行任何操作
    }
    
    appendFileSync("/tmp/ri.log", `[${new Date().toISOString()}] ✅ In RI terminal, continuing\n`);
  } catch (error) {
    appendFileSync("/tmp/ri.log", `[${new Date().toISOString()}] ❌ Error in RI detection: ${error}\n`);
    throw error;
  }

  // 2. 加载配置
  let config;
  try {
    config = await ConfigManager.load(directory);
    appendFileSync("/tmp/ri.log", `[${new Date().toISOString()}] ✅ Config loaded: enabled=${config.enabled}\n`);
  } catch (error) {
    appendFileSync("/tmp/ri.log", `[${new Date().toISOString()}] ⚠️ Failed to load config: ${error}\n`);
    await client.app.log({
      service: "ri-notification",
      level: "error",
      message: "Failed to load config, using defaults",
      extra: { error: (error as Error).message },
    });
    // 使用默认配置继续
    config = await ConfigManager.load("");
  }

  // 检查插件是否被禁用
  if (!config.enabled) {
    appendFileSync("/tmp/ri.log", `[${new Date().toISOString()}] Plugin disabled in config\n`);
    await client.app.log({
      service: "ri-notification",
      level: "info",
      message: "Plugin is disabled in config",
    });
    return {};
  }
  
  appendFileSync("/tmp/ri.log", `[${new Date().toISOString()}] ✅ Plugin enabled, initializing handlers\n`);

  // 3. 初始化通知器
  const notifier = new RINotifier($, detector, config);
  
  // 4. 初始化事件处理器
  const handlers = new EventHandlers(notifier, config);
  
  appendFileSync("/tmp/ri.log", `[${new Date().toISOString()}] ✅ Notifier and handlers initialized\n`);
  
  // 5. 劫持stdout来捕获plan模式的输出
  const originalWrite = process.stdout.write.bind(process.stdout);
  let outputBuffer = '';
  let lastOutputTime = Date.now();
  
  (process.stdout.write as any) = function(chunk: any, ...args: any[]): boolean {
    const result = originalWrite(chunk, ...args);
    
    // 记录输出到日志
    if (typeof chunk === 'string') {
      outputBuffer += chunk;
      lastOutputTime = Date.now();
      
      // 检测plan模式的特征输出
      if (chunk.includes('## Summary') || 
          chunk.includes('## Changes') || 
          chunk.includes('## Implementation Plan') ||
          chunk.includes('## Next Steps')) {
        appendFileSync("/tmp/ri.log", `[${new Date().toISOString()}] 📝 Detected plan output\n`);
        
        // 延迟发送通知，避免在输出过程中打断
        setTimeout(async () => {
          const now = Date.now();
          // 如果已经0.5秒没有新输出，认为plan已经完成
          if (now - lastOutputTime >= 500) {
            appendFileSync("/tmp/ri.log", `[${new Date().toISOString()}] 📤 Sending plan completion notification\n`);
            await notifier.send({
              type: "completed",
              message: "OpenCode 规划完成",
            });
            outputBuffer = ''; // 清空缓冲区
          }
        }, 600);
      }
    }
    
    return result;
  };

  // 6. 记录插件激活
  await client.app.log({
    service: "ri-notification",
    level: "info",
    message: `Plugin activated in session: ${detector.getSessionName()}`,
    extra: {
      sessionId: detector.getSessionId(),
      sessionName: detector.getSessionName(),
      enabledEvents: Object.entries(config.events)
        .filter(([_, enabled]) => enabled)
        .map(([event, _]) => event),
    },
  });

  // 发送激活通知（仅用于调试，生产环境可注释）
  // await notifier.info("OpenCode 通知插件已激活");

  // 7. 返回事件钩子
  return {
    // 任务完成
    "session.idle": handlers.onSessionIdle.bind(handlers),
    
    // 错误发生
    "session.error": handlers.onSessionError.bind(handlers),
    
    // 工具执行前（记录开始时间）
    "tool.execute.before": handlers.onToolExecuteBefore.bind(handlers),
    
    // 工具执行后（构建/测试/长时间命令）
    "tool.execute.after": handlers.onToolExecuteAfter.bind(handlers),
    
    // 权限请求
    "permission.asked": handlers.onPermissionAsked.bind(handlers),
    "permission.replied": handlers.onPermissionReplied.bind(handlers),
    "message.received": handlers.onMessageReceived.bind(handlers),
    "message.updated": handlers.onMessageUpdated.bind(handlers),
  };
};

// 默认导出
export default RINotificationPlugin;
