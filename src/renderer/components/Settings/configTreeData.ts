/**
 * 配置树结构定义
 */

export interface ConfigTreeNode {
  id: string;
  label: string;
  icon?: string;
  type: 'category' | 'group' | 'item';
  children?: ConfigTreeNode[];
  configPath?: string;
  description?: string;
  requiresRestart?: boolean;
}

export const CONFIG_TREE: ConfigTreeNode[] = [
  {
    id: 'history',
    label: '历史记录',
    icon: '📜',
    type: 'category',
    children: [
      {
        id: 'history-storage',
        label: '存储设置',
        type: 'group',
        children: [
          {
            id: 'history-logs-directory',
            label: '日志目录',
            type: 'item',
            configPath: 'history.logsDirectory',
            description: '会话日志的存储路径（相对于应用数据目录）',
            requiresRestart: true
          },
          {
            id: 'history-max-records',
            label: '每文件最大记录数',
            type: 'item',
            configPath: 'history.maxRecordsPerFile',
            description: '单个日志文件的最大记录条数 (100 - 10000)'
          }
        ]
      },
      {
        id: 'history-cleanup',
        label: '清理设置',
        type: 'group',
        children: [
          {
            id: 'history-retention-days',
            label: '日志保留天数',
            type: 'item',
            configPath: 'history.retentionDays',
            description: '自动清理多少天前的历史记录 (1 - 365)'
          },
          {
            id: 'history-auto-trim',
            label: '自动清理',
            type: 'item',
            configPath: 'history.autoTrim',
            description: '启用日志文件的自动清理功能'
          },
          {
            id: 'history-trim-debounce',
            label: '清理防抖延迟',
            type: 'item',
            configPath: 'history.trimDebounceMs',
            description: '日志清理操作的防抖时间（毫秒，1000 - 60000）'
          }
        ]
      },
      {
        id: 'history-filtering',
        label: '过滤设置',
        type: 'group',
        children: [
          {
            id: 'history-enable-filtering',
            label: '智能过滤',
            type: 'item',
            configPath: 'history.enableFiltering',
            description: '过滤命令提示符、交互式输入和噪音输出'
          }
        ]
      }
    ]
  },
  
  {
    id: 'terminal',
    label: '终端',
    icon: '💻',
    type: 'category',
    children: [
      {
        id: 'terminal-shell',
        label: 'Shell 设置',
        type: 'group',
        children: [
          {
            id: 'terminal-default-shell',
            label: '默认 Shell',
            type: 'item',
            configPath: 'terminal.defaultShell',
            description: '指定默认使用的 Shell（留空自动检测）',
            requiresRestart: true
          }
        ]
      },
      {
        id: 'terminal-appearance',
        label: '外观',
        type: 'group',
        children: [
          {
            id: 'terminal-font-family',
            label: '字体族',
            type: 'item',
            configPath: 'terminal.fontFamily',
            description: '终端使用的字体（逗号分隔的后备字体）'
          }
        ]
      },
      {
        id: 'terminal-cursor',
        label: '光标',
        type: 'group',
        children: [
          {
            id: 'terminal-cursor-style',
            label: '光标样式',
            type: 'item',
            configPath: 'terminal.cursorStyle',
            description: '终端光标的形状'
          },
          {
            id: 'terminal-cursor-blink',
            label: '光标闪烁',
            type: 'item',
            configPath: 'terminal.cursorBlink',
            description: '启用光标闪烁动画'
          }
        ]
      },
      {
        id: 'terminal-behavior',
        label: '行为',
        type: 'group',
        children: [
          {
            id: 'terminal-scrollback',
            label: '回滚缓冲区',
            type: 'item',
            configPath: 'terminal.scrollback',
            description: '终端保留的历史行数 (100 - 10000)'
          }
        ]
      },
      {
        id: 'terminal-theme',
        label: '颜色主题',
        type: 'group',
        children: [
          {
            id: 'terminal-theme-background',
            label: '背景色',
            type: 'item',
            configPath: 'terminal.theme.background',
            description: '终端背景颜色'
          },
          {
            id: 'terminal-theme-foreground',
            label: '前景色',
            type: 'item',
            configPath: 'terminal.theme.foreground',
            description: '终端文字颜色'
          },
          {
            id: 'terminal-theme-cursor',
            label: '光标色',
            type: 'item',
            configPath: 'terminal.theme.cursor',
            description: '终端光标颜色'
          },
          {
            id: 'terminal-theme-selection',
            label: '选区色',
            type: 'item',
            configPath: 'terminal.theme.selection',
            description: '终端选中文本的背景色'
          }
        ]
      }
    ]
  },
  
  {
    id: 'window',
    label: '窗口',
    icon: '🪟',
    type: 'category',
    children: [
      {
        id: 'window-size',
        label: '尺寸',
        type: 'group',
        children: [
          {
            id: 'window-width',
            label: '窗口宽度',
            type: 'item',
            configPath: 'window.width',
            description: '应用窗口的默认宽度（像素，800 - 3840）',
            requiresRestart: true
          },
          {
            id: 'window-height',
            label: '窗口高度',
            type: 'item',
            configPath: 'window.height',
            description: '应用窗口的默认高度（像素，600 - 2160）',
            requiresRestart: true
          }
        ]
      },
      {
        id: 'window-behavior',
        label: '行为',
        type: 'group',
        children: [
          {
            id: 'window-always-on-top',
            label: '始终置顶',
            type: 'item',
            configPath: 'window.alwaysOnTop',
            description: '窗口始终显示在其他应用之上'
          },
          {
            id: 'window-sidebar-collapsed',
            label: '侧边栏折叠',
            type: 'item',
            configPath: 'window.sidebarCollapsed',
            description: '启动时侧边栏是否折叠'
          }
        ]
      }
    ]
  },
  
  {
    id: 'ai',
    label: 'AI 设置',
    icon: '🤖',
    type: 'category',
    children: [
      {
        id: 'ai-general',
        label: '常规',
        type: 'group',
        children: [
          {
            id: 'ai-enabled',
            label: '启用 AI',
            type: 'item',
            configPath: 'ai.enabled',
            description: 'AI 功能总开关'
          }
        ]
      },
      {
        id: 'ai-provider',
        label: '提供商',
        type: 'group',
        children: [
          {
            id: 'ai-provider-name',
            label: '提供商名称',
            type: 'item',
            configPath: 'ai.provider',
            description: 'AI 服务提供商（如 openai, anthropic）'
          },
          {
            id: 'ai-api-key',
            label: 'API 密钥',
            type: 'item',
            configPath: 'ai.apiKey',
            description: 'API 访问密钥'
          },
          {
            id: 'ai-model',
            label: '模型',
            type: 'item',
            configPath: 'ai.model',
            description: '使用的模型名称'
          }
        ]
      }
    ]
  },
  
  {
    id: 'advanced',
    label: '高级',
    icon: '⚡',
    type: 'category',
    children: [
      {
        id: 'advanced-development',
        label: '开发',
        type: 'group',
        children: [
          {
            id: 'advanced-devtools',
            label: '启动时打开开发者工具',
            type: 'item',
            configPath: 'advanced.devToolsOnStartup',
            requiresRestart: true
          }
        ]
      },
      {
        id: 'advanced-monitoring',
        label: '监控',
        type: 'group',
        children: [
          {
            id: 'advanced-performance',
            label: '性能监控',
            type: 'item',
            configPath: 'advanced.enablePerformanceMonitoring',
            description: '启用性能监控功能'
          }
        ]
      },
      {
        id: 'advanced-logging',
        label: '日志',
        type: 'group',
        children: [
          {
            id: 'advanced-log-level',
            label: '日志级别',
            type: 'item',
            configPath: 'advanced.logLevel',
            description: '应用日志的详细程度'
          }
        ]
      }
    ]
  }
];
