// Notification theme system
export type NotificationTheme = 'vscode' | 'slack' | 'material' | 'minimal';

export interface ThemeColors {
  info: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeConfig {
  name: string;
  colors: ThemeColors;
  borderRadius: string;
  shadow: string;
  animation: 'slide' | 'fade' | 'bounce';
  iconStyle: 'emoji' | 'symbol';
}

// VSCode Dark Theme
const vscodeTheme: ThemeConfig = {
  name: 'VSCode Dark',
  colors: {
    info: '#007acc',
    success: '#4ec9b0',
    warning: '#d4a259',
    error: '#f48771',
  },
  borderRadius: '6px',
  shadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  animation: 'slide',
  iconStyle: 'emoji',
};

// Slack Theme
const slackTheme: ThemeConfig = {
  name: 'Slack',
  colors: {
    info: '#1264a3',
    success: '#007a5a',
    warning: '#e8912d',
    error: '#e01e5a',
  },
  borderRadius: '8px',
  shadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
  animation: 'fade',
  iconStyle: 'emoji',
};

// Material Design Theme
const materialTheme: ThemeConfig = {
  name: 'Material',
  colors: {
    info: '#2196f3',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
  },
  borderRadius: '4px',
  shadow: '0 2px 4px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.08)',
  animation: 'slide',
  iconStyle: 'symbol',
};

// Minimal Theme
const minimalTheme: ThemeConfig = {
  name: 'Minimal',
  colors: {
    info: '#6b7280',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  borderRadius: '12px',
  shadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
  animation: 'fade',
  iconStyle: 'symbol',
};

export const themes: Record<NotificationTheme, ThemeConfig> = {
  vscode: vscodeTheme,
  slack: slackTheme,
  material: materialTheme,
  minimal: minimalTheme,
};

// Get theme icons
export const getThemeIcon = (type: 'info' | 'success' | 'warning' | 'error', theme: NotificationTheme): string => {
  const themeConfig = themes[theme];
  
  if (themeConfig.iconStyle === 'emoji') {
    return {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    }[type];
  }
  
  // Symbol icons
  return {
    info: '●',
    success: '✓',
    warning: '!',
    error: '✕',
  }[type];
};

// Generate CSS variables for a theme
export const generateThemeStyles = (theme: NotificationTheme): Record<string, string> => {
  const config = themes[theme];
  return {
    '--notify-color-info': config.colors.info,
    '--notify-color-success': config.colors.success,
    '--notify-color-warning': config.colors.warning,
    '--notify-color-error': config.colors.error,
    '--notify-border-radius': config.borderRadius,
    '--notify-shadow': config.shadow,
  };
};
