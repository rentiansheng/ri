/**
 * 将时间戳转换为人类可读的相对时间
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化的相对时间字符串
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  // 超过 7 天显示具体日期
  return new Date(timestamp).toLocaleDateString();
};

/**
 * 根据时间戳判断活动状态
 * @param timestamp 时间戳（毫秒）
 * @returns 活动状态：active | recent | idle | stale
 */
export const getActivityStatus = (timestamp: number): 'active' | 'recent' | 'idle' | 'stale' => {
  const diff = Date.now() - timestamp;
  const minutes = diff / 1000 / 60;
  
  if (minutes < 5) return 'active';      // 5 分钟内：活跃（绿色）
  if (minutes < 30) return 'recent';     // 30 分钟内：最近（浅灰）
  if (minutes < 60 * 24) return 'idle';  // 1 天内：空闲（深灰）
  return 'stale';                        // 超过 1 天：过期（红色，可能需要处理）
};
