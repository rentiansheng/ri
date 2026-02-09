/**
 * AI 工具检测器
 * 用于识别终端中运行的 AI 助手工具及其状态
 */

// AI 工具进程名称映射
export const AI_TOOLS: Record<string, string[]> = {
  opencode: ['opencode', 'ocode', 'oc'],
  'gh-copilot': ['gh', 'copilot', 'github-copilot-cli'],
  aider: ['aider'],
  cursor: ['cursor'],
  cline: ['cline'],
};

// 输出模式定义
export const OUTPUT_PATTERNS = {
  // 思考中/处理中的模式
  thinking: [
    /●{3,}/,                                    // Loading dots: ●●●
    /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,                   // Spinner animation characters
    /Thinking\.\.\./i,
    /Processing\.\.\./i,
    /Analyzing\.\.\./i,
    /Generating\.\.\./i,
    /Loading\.\.\./i,
    /Working\.\.\./i,
    /\[━+\s*\]/,                                // Progress bar: [━━━   ]
  ],
  
  // 等待用户输入的模式
  waiting: [
    /\?\s+[^\n]+:/,                             // "? Select:"
    /\(Y\/n\)/i,                                // Yes/No prompt (Y/n)
    /\[y\/N\]/i,                                // Yes/No prompt [y/N]
    /\(y\/N\)/i,                                // Yes/No prompt (y/N)
    /Press\s+any\s+key/i,                       // "Press any key"
    /Enter\s+[^:]+:/i,                          // "Enter something:"
    /Choose\s+an\s+option/i,                    // "Choose an option"
    /Select\s+an?\s+/i,                         // "Select a/an ..."
    /Type\s+[^:]+:/i,                           // "Type something:"
    /Input\s+[^:]+:/i,                          // "Input something:"
    />\s*$/m,                                   // Prompt ending with ">"
  ],
  
  // 执行中的模式
  executing: [
    /Writing\s+to\s+file/i,
    /Editing\s+.*\.[a-z]+/i,                    // "Editing file.ext"
    /Running\s+command/i,
    /Executing\.\.\./i,
    /Applying\s+changes/i,
    /Creating\s+file/i,
    /Deleting\s+file/i,
    /Moving\s+file/i,
    /Copying\s+file/i,
  ],
  
  // 已完成的模式
  completed: [
    /Done\.?$/im,
    /Completed\.?$/im,
    /Success\.?$/im,
    /Finished\.?$/im,
    /✓|✔/,                                      // Check marks
    /^[\$%#>]\s*$/m,                            // Shell prompt (on its own line)
  ],
};

/**
 * 从进程名称检测 AI 工具
 */
export function detectAIToolFromProcess(processName: string): string | null {
  const lowerName = processName.toLowerCase();
  
  for (const [tool, patterns] of Object.entries(AI_TOOLS)) {
    if (patterns.some(pattern => lowerName.includes(pattern))) {
      return tool;
    }
  }
  
  return null;
}

/**
 * 从输出内容检测状态
 */
export function detectStatusFromOutput(output: string): 'thinking' | 'waiting' | 'executing' | 'idle' | 'completed' {
  // 按优先级检测（等待输入 > 思考中 > 执行中 > 已完成）
  // 因为某些工具可能同时有多种模式的输出
  
  // 1. 检测等待输入（最高优先级）
  for (const pattern of OUTPUT_PATTERNS.waiting) {
    if (pattern.test(output)) {
      return 'waiting';
    }
  }
  
  // 2. 检测思考中
  for (const pattern of OUTPUT_PATTERNS.thinking) {
    if (pattern.test(output)) {
      return 'thinking';
    }
  }
  
  // 3. 检测执行中
  for (const pattern of OUTPUT_PATTERNS.executing) {
    if (pattern.test(output)) {
      return 'executing';
    }
  }
  
  // 4. 检测已完成
  for (const pattern of OUTPUT_PATTERNS.completed) {
    if (pattern.test(output)) {
      return 'completed';
    }
  }
  
  return 'idle';
}

/**
 * 从输出中提取提示文本
 */
export function extractPrompt(output: string): string | undefined {
  // 尝试匹配常见的提示格式
  
  // "? Some question:" 格式
  const questionMatch = output.match(/\?\s*([^\n]+)/);
  if (questionMatch) {
    return questionMatch[1].trim();
  }
  
  // "Enter something:" 格式
  const enterMatch = output.match(/(?:Enter|Type|Input)\s+([^:]+):/i);
  if (enterMatch) {
    return enterMatch[0].trim();
  }
  
  // "(Y/n)" 或 "[y/N]" 格式
  const confirmMatch = output.match(/[^\n]*[\(\[](?:Y\/n|y\/N)[\)\]][^\n]*/i);
  if (confirmMatch) {
    return confirmMatch[0].trim();
  }
  
  return undefined;
}

/**
 * 检测进程列表中是否有 AI 工具运行
 */
export function findAIToolProcess(processes: Array<{ pid: number; ppid: number; comm: string; state: string }>): { tool: string; process: typeof processes[0] } | null {
  for (const proc of processes) {
    const tool = detectAIToolFromProcess(proc.comm);
    if (tool) {
      return { tool, process: proc };
    }
  }
  return null;
}
