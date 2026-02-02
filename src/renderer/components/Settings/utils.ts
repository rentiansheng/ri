/**
 * 配置系统工具函数
 */

import { Config } from '../../types/global';
import { ConfigTreeNode } from './configTreeData';

/**
 * 从配置树中查找节点
 */
export function findNodeById(
  tree: ConfigTreeNode[],
  nodeId: string | null
): ConfigTreeNode | null {
  if (!nodeId) return null;
  
  for (const node of tree) {
    if (node.id === nodeId) {
      return node;
    }
    if (node.children) {
      const found = findNodeById(node.children, nodeId);
      if (found) return found;
    }
  }
  
  return null;
}

/**
 * 获取面包屑导航路径
 */
export function getBreadcrumb(
  tree: ConfigTreeNode[],
  nodeId: string
): string[] {
  const path: string[] = [];
  
  function findPath(nodes: ConfigTreeNode[], target: string, currentPath: string[]): boolean {
    for (const node of nodes) {
      const newPath = [...currentPath, node.label];
      
      if (node.id === target) {
        path.push(...newPath);
        return true;
      }
      
      if (node.children && findPath(node.children, target, newPath)) {
        return true;
      }
    }
    return false;
  }
  
  findPath(tree, nodeId, []);
  return path;
}

/**
 * 从配置对象中根据路径获取值
 */
export function getValueByPath(config: Config, path: string): any {
  const keys = path.split('.');
  let value: any = config;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

/**
 * 根据配置路径构建部分配置对象
 * 例如: buildPartialConfig('history.maxRecordsPerFile', 500)
 * 返回: { history: { maxRecordsPerFile: 500 } }
 */
export function buildPartialConfig(path: string, value: any): Partial<Config> {
  const keys = path.split('.');
  const result: any = {};
  
  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = {};
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
  
  return result as Partial<Config>;
}

/**
 * 获取数字输入框的约束
 */
export function getNumberConstraints(path: string): { min: number; max: number; step: number } {
  const constraints: Record<string, { min: number; max: number; step: number }> = {
    'history.maxRecordsPerFile': { min: 100, max: 10000, step: 100 },
    'history.retentionDays': { min: 1, max: 365, step: 1 },
    'history.trimDebounceMs': { min: 1000, max: 60000, step: 1000 },
    'terminal.fontSize': { min: 8, max: 32, step: 1 },
    'terminal.scrollback': { min: 100, max: 10000, step: 100 },
    'window.width': { min: 800, max: 3840, step: 10 },
    'window.height': { min: 600, max: 2160, step: 10 },
  };
  
  return constraints[path] || { min: 0, max: 100, step: 1 };
}

/**
 * 验证配置值是否有效
 */
export function validateConfigValue(path: string, value: any): { valid: boolean; error?: string } {
  // 数字类型验证
  if (typeof value === 'number') {
    const { min, max } = getNumberConstraints(path);
    if (value < min || value > max) {
      return { valid: false, error: `值必须在 ${min} 到 ${max} 之间` };
    }
  }
  
  // 颜色值验证
  if (path.includes('theme.')) {
    const colorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (typeof value === 'string' && !colorRegex.test(value)) {
      return { valid: false, error: '颜色格式无效，请使用 #RRGGBB 格式' };
    }
  }
  
  return { valid: true };
}
