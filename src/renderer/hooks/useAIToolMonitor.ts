/**
 * AI 工具监控 Hook
 * 实现自适应轮询，检测终端中运行的 AI 工具状态
 */

import { useEffect, useRef } from 'react';
import { useTerminalStore, Session, AIToolState } from '../store/terminalStore';
import { 
  detectStatusFromOutput, 
  extractPrompt, 
  findAIToolProcess 
} from '../utils/aiToolDetector';
import { getRecentOutput } from '../components/Terminal';
import { sendNotification } from '../utils/notification';

/**
 * 获取检测间隔（自适应策略）
 * @param session 会话对象
 * @param isFocused 是否有焦点
 * @returns 检测间隔（毫秒）
 */
function getCheckInterval(session: Session, isFocused: boolean): number {
  const now = Date.now();
  const timeSinceLastActivity = now - (session.lastActivityTime || session.createdAt);
  
  // 基础间隔 15s
  const MIN_INTERVAL = 15000;
  // 最大间隔 120s (2m)
  const MAX_INTERVAL = 120000;
  
  // 如果正在等待输入（阻塞状态），保持相对敏感的检测，但也不低于 15s
  if (session.aiToolState?.status === 'waiting' && isFocused) {
    return MIN_INTERVAL;
  }

  // 自适应逻辑：根据最后活动时间增加间隔
  // 15s (活跃) -> 2m (长久无活动)
  // 线性增加：每 1 分钟不活动，增加 30s 间隔，直到 2m
  const idleMinutes = timeSinceLastActivity / 60000;
  let adaptiveInterval = MIN_INTERVAL + (idleMinutes * 30000);
  
  // 限制在 15s - 2m 之间
  return Math.min(Math.max(adaptiveInterval, MIN_INTERVAL), MAX_INTERVAL);
}

/**
 * 检测单个 session 的 AI 工具状态
 */
async function checkSession(
  session: Session, 
  isFocused: boolean,
  setAIToolState: (sessionId: string, state: AIToolState | null) => void
): Promise<void> {
  try {
    // 1. 获取进程信息
    const processInfo = await window.terminal.getProcessInfo({
      id: session.terminalId
    });
    
    if (!processInfo || !processInfo.processes) {
      // 无法获取进程信息，清除状态
      setAIToolState(session.id, null);
      return;
    }
    
    // 2. 检测是否有 AI 工具运行
    const aiToolInfo = findAIToolProcess(processInfo.processes);
    
    if (!aiToolInfo) {
      // 没有 AI 工具运行，清除状态
      setAIToolState(session.id, null);
      return;
    }
    
    // 3. 分析最近的输出
    const recentOutput = getRecentOutput(session.terminalId, 5000);
    
    // 如果没有输出，可能是刚启动，状态为 idle
    if (!recentOutput || recentOutput.trim().length === 0) {
      const newState: AIToolState = {
        status: 'idle',
        tool: aiToolInfo.tool,
        detectedAt: Date.now(),
        lastCheckTime: Date.now(),
      };
      setAIToolState(session.id, newState);
      return;
    }
    
    // 4. 检测状态
    const status = detectStatusFromOutput(recentOutput);
    const prompt = extractPrompt(recentOutput);
    
    // 5. 更新状态
    const newState: AIToolState = {
      status,
      tool: aiToolInfo.tool,
      prompt,
      detectedAt: Date.now(),
      lastCheckTime: Date.now(),
    };
    
    // 6. 检查是否需要发送通知
    const oldState = session.aiToolState;
    const shouldNotify = 
      !oldState &&                      // 之前没有状态
      status === 'waiting' &&           // 现在是等待输入
      !isFocused;                       // 当前不是焦点
    
    if (shouldNotify) {
      sendNotification(session, newState);
    }
    
    setAIToolState(session.id, newState);
    
  } catch (error) {
    console.error(`[AIToolMonitor] Error checking session ${session.id}:`, error);
  }
}

/**
 * AI 工具监控 Hook
 */
export function useAIToolMonitor() {
  const sessions = useTerminalStore(state => state.sessions);
  const activeSessionId = useTerminalStore(state => state.activeSessionId);
  const setAIToolState = useTerminalStore(state => state.setAIToolState);
  
  // 使用 ref 存储定时器和上次检查的会话列表
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const prevSessionIdsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    const currentSessionIds = new Set(sessions.map(s => s.id));
    
    // 移除已删除会话的定时器
    prevSessionIdsRef.current.forEach(sessionId => {
      if (!currentSessionIds.has(sessionId)) {
        const timer = timersRef.current.get(sessionId);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(sessionId);
        }
      }
    });
    
    // 为每个 session 安排检测
    const scheduleCheck = (session: Session) => {
      const isFocused = session.id === activeSessionId;
      const interval = getCheckInterval(session, isFocused);
      
      // 清除旧的定时器
      const oldTimer = timersRef.current.get(session.id);
      if (oldTimer) {
        clearTimeout(oldTimer);
      }
      
      // 设置新的定时器
      const timer = setTimeout(() => {
        checkSession(session, isFocused, setAIToolState).then(() => {
          // 递归调度下一次检测
          const updatedSession = useTerminalStore.getState().sessions.find(s => s.id === session.id);
          if (updatedSession) {
            scheduleCheck(updatedSession);
          }
        });
      }, interval);
      
      timersRef.current.set(session.id, timer);
    };
    
    // 只为新增的 session 启动调度
    sessions.forEach(session => {
      if (!prevSessionIdsRef.current.has(session.id)) {
        scheduleCheck(session);
      }
    });
    
    prevSessionIdsRef.current = currentSessionIds;
    
    // 清理函数
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
      prevSessionIdsRef.current.clear();
    };
  }, [sessions.length]); // 只在 session 数量变化时触发
  
  // 当焦点变化时，立即触发一次检测（防抖处理）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeSessionId) {
        const session = sessions.find(s => s.id === activeSessionId);
        if (session) {
          checkSession(session, true, setAIToolState);
        }
      }
    }, 500); // 500ms 防抖
    
    return () => clearTimeout(timer);
  }, [activeSessionId]);
}
