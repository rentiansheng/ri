import React, { useState, useEffect } from 'react';
import { useConfigStore } from '../../store/configStore';
import { useXTermStore } from '../../store/xtermStore';
import './TerminalSettings.css';

// 预设主题
const THEME_PRESETS = {
  'Gruvbox Dark': {
    background: '#282828',
    foreground: '#ebdbb2',
    cursor: '#ebdbb2',
    cursorAccent: '#282828',
    selectionBackground: 'rgba(235, 219, 178, 0.25)',
    black: '#282828',
    red: '#cc241d',
    green: '#98971a',
    yellow: '#d79921',
    blue: '#458588',
    magenta: '#b16286',
    cyan: '#689d6a',
    white: '#a89984',
    brightBlack: '#928374',
    brightRed: '#fb4934',
    brightGreen: '#b8bb26',
    brightYellow: '#fabd2f',
    brightBlue: '#83a598',
    brightMagenta: '#d3869b',
    brightCyan: '#8ec07c',
    brightWhite: '#ebdbb2',
  },
  'Dracula': {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#282a36',
    selectionBackground: 'rgba(68, 71, 90, 0.5)',
    black: '#000000',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#bfbfbf',
    brightBlack: '#4d4d4d',
    brightRed: '#ff6e67',
    brightGreen: '#5af78e',
    brightYellow: '#f4f99d',
    brightBlue: '#caa9fa',
    brightMagenta: '#ff92d0',
    brightCyan: '#9aedfe',
    brightWhite: '#e6e6e6',
  },
  'One Dark': {
    background: '#282c34',
    foreground: '#abb2bf',
    cursor: '#528bff',
    cursorAccent: '#ffffff',
    selectionBackground: 'rgba(67, 76, 94, 0.5)',
    black: '#282c34',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#e5c07b',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#e5c07b',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
  },
  'Solarized Dark': {
    background: '#002b36',
    foreground: '#839496',
    cursor: '#839496',
    cursorAccent: '#002b36',
    selectionBackground: 'rgba(7, 54, 66, 0.5)',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#002b36',
    brightRed: '#cb4b16',
    brightGreen: '#586e75',
    brightYellow: '#657b83',
    brightBlue: '#839496',
    brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1',
    brightWhite: '#fdf6e3',
  },
  'Nord': {
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#d8dee9',
    cursorAccent: '#2e3440',
    selectionBackground: 'rgba(76, 86, 106, 0.5)',
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#bf616a',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4',
  },
};

const TerminalSettings: React.FC = () => {
  const configStore = useConfigStore();
  const [config, setConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // 终端配置状态
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState('Menlo, Monaco, "Courier New", monospace');
  const [lineHeight, setLineHeight] = useState(1.0);
  const [cursorStyle, setCursorStyle] = useState<'block' | 'underline' | 'bar'>('block');
  const [cursorBlink, setCursorBlink] = useState(true);
  const [scrollback, setScrollback] = useState(1000);
  const [selectedTheme, setSelectedTheme] = useState('Gruvbox Dark');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const loadedConfig = await window.config.get();
      setConfig(loadedConfig);
      
      if (loadedConfig.terminal) {
        setFontSize(loadedConfig.terminal.fontSize || 14);
        setFontFamily(loadedConfig.terminal.fontFamily || 'Menlo, Monaco, "Courier New", monospace');
        setLineHeight(loadedConfig.terminal.lineHeight || 1.0);
        setCursorStyle(loadedConfig.terminal.cursorStyle || 'block');
        setCursorBlink(loadedConfig.terminal.cursorBlink !== false);
        setScrollback(loadedConfig.terminal.scrollback || 1000);
        setSelectedTheme(loadedConfig.terminal.theme?.name || 'Gruvbox Dark');
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const selectedThemeConfig = THEME_PRESETS[selectedTheme as keyof typeof THEME_PRESETS];
      
      const updatedConfig = {
        ...config,
        terminal: {
          ...config.terminal,
          fontSize: fontSize || 14,
          fontFamily,
          lineHeight: lineHeight || 1.0,
          cursorStyle,
          cursorBlink,
          scrollback,
          theme: {
            name: selectedTheme,
            ...selectedThemeConfig,
          },
        },
      };
      
      const result = await window.config.update(updatedConfig);
      if (result.success && result.config) {
        setConfig(result.config);
        showMessage('success', '终端设置已保存并应用');
        
        // 应用配置到现有终端
        applyConfigToTerminals(result.config.terminal);
      } else {
        showMessage('error', result.error || '保存失败');
      }
    } catch (error: any) {
      showMessage('error', error.message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 应用配置到所有现有终端
  const applyConfigToTerminals = (terminalConfig: any) => {
    const instances = useXTermStore.getState().instances;
    
    instances.forEach((instance) => {
      const { xterm } = instance;
      
      // 更新字体设置
      xterm.options.fontSize = terminalConfig.fontSize;
      xterm.options.fontFamily = terminalConfig.fontFamily;
      xterm.options.lineHeight = terminalConfig.lineHeight;
      xterm.options.cursorStyle = terminalConfig.cursorStyle;
      xterm.options.cursorBlink = terminalConfig.cursorBlink;
      xterm.options.scrollback = terminalConfig.scrollback;
      
      // 更新主题
      if (terminalConfig.theme) {
        xterm.options.theme = {
          background: terminalConfig.theme.background,
          foreground: terminalConfig.theme.foreground,
          cursor: terminalConfig.theme.cursor,
          cursorAccent: terminalConfig.theme.cursorAccent,
          selectionBackground: terminalConfig.theme.selectionBackground,
          black: terminalConfig.theme.black,
          red: terminalConfig.theme.red,
          green: terminalConfig.theme.green,
          yellow: terminalConfig.theme.yellow,
          blue: terminalConfig.theme.blue,
          magenta: terminalConfig.theme.magenta,
          cyan: terminalConfig.theme.cyan,
          white: terminalConfig.theme.white,
          brightBlack: terminalConfig.theme.brightBlack,
          brightRed: terminalConfig.theme.brightRed,
          brightGreen: terminalConfig.theme.brightGreen,
          brightYellow: terminalConfig.theme.brightYellow,
          brightBlue: terminalConfig.theme.brightBlue,
          brightMagenta: terminalConfig.theme.brightMagenta,
          brightCyan: terminalConfig.theme.brightCyan,
          brightWhite: terminalConfig.theme.brightWhite,
        };
      }
      
      // 触发刷新
      try {
        instance.fitAddon.fit();
      } catch (e) {
        console.error('Failed to fit terminal:', e);
      }
    });
  };

  const handleThemeSelect = (themeName: string) => {
    setSelectedTheme(themeName);
  };

  if (!config) {
    return (
      <div className="terminal-settings">
        <div className="loading-message">加载中...</div>
      </div>
    );
  }

  return (
    <div className="terminal-settings" data-testid="terminal-settings">
      {saveMessage && (
        <div 
          className={`terminal-settings-message terminal-settings-message-${saveMessage.type}`}
          data-testid={`settings-message-${saveMessage.type}`}
        >
          {saveMessage.text}
        </div>
      )}

      <div className="settings-group">
        <h3>字体设置</h3>

        <div className="settings-item">
          <div className="settings-item-label">
            <label>字体大小</label>
            <span className="settings-item-description">终端字体大小 (8-32)</span>
          </div>
          <div className="settings-item-control">
            <input
              type="number"
              min="8"
              max="32"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="settings-input-number"
            />
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">
            <label>字体族</label>
            <span className="settings-item-description">等宽字体，多个用逗号分隔</span>
          </div>
          <div className="settings-item-control">
            <input
              type="text"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="settings-input"
              placeholder='Menlo, Monaco, "Courier New", monospace'
            />
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">
            <label>行高</label>
            <span className="settings-item-description">终端行高倍数 (0.8-2.0)</span>
          </div>
          <div className="settings-item-control">
            <input
              type="number"
              min="0.8"
              max="2.0"
              step="0.1"
              value={lineHeight}
              onChange={(e) => setLineHeight(parseFloat(e.target.value))}
              className="settings-input-number"
            />
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h3>光标设置</h3>
        
        <div className="settings-item">
          <div className="settings-item-label">
            <label>光标样式</label>
            <span className="settings-item-description">光标显示形状</span>
          </div>
          <div className="settings-item-control">
            <select
              value={cursorStyle}
              onChange={(e) => setCursorStyle(e.target.value as 'block' | 'underline' | 'bar')}
              className="settings-select"
            >
              <option value="block">方块 (Block)</option>
              <option value="underline">下划线 (Underline)</option>
              <option value="bar">竖线 (Bar)</option>
            </select>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-label">
            <label>光标闪烁</label>
            <span className="settings-item-description">光标是否闪烁</span>
          </div>
          <div className="settings-item-control">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={cursorBlink}
                onChange={(e) => setCursorBlink(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h3>滚动设置</h3>
        
        <div className="settings-item">
          <div className="settings-item-label">
            <label>回滚缓冲区</label>
            <span className="settings-item-description">保留的历史行数</span>
          </div>
          <div className="settings-item-control">
            <input
              type="number"
              min="100"
              max="50000"
              step="100"
              value={scrollback}
              onChange={(e) => setScrollback(parseInt(e.target.value))}
              className="settings-input-number"
            />
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h3>配色主题</h3>
        
        <div className="theme-grid">
          {Object.keys(THEME_PRESETS).map((themeName) => {
            const theme = THEME_PRESETS[themeName as keyof typeof THEME_PRESETS];
            return (
              <div
                key={themeName}
                className={`theme-card ${selectedTheme === themeName ? 'selected' : ''}`}
                onClick={() => handleThemeSelect(themeName)}
                data-testid={`theme-${themeName.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="theme-preview" style={{ background: theme.background }}>
                  <div className="theme-preview-text" style={{ color: theme.foreground }}>
                    <span style={{ color: theme.red }}>$</span>
                    <span style={{ color: theme.green }}> ls</span>
                    <span style={{ color: theme.blue }}> -la</span>
                  </div>
                  <div className="theme-color-palette">
                    <span style={{ background: theme.black }} />
                    <span style={{ background: theme.red }} />
                    <span style={{ background: theme.green }} />
                    <span style={{ background: theme.yellow }} />
                    <span style={{ background: theme.blue }} />
                    <span style={{ background: theme.magenta }} />
                    <span style={{ background: theme.cyan }} />
                    <span style={{ background: theme.white }} />
                  </div>
                </div>
                <div className="theme-name">{themeName}</div>
                {selectedTheme === themeName && (
                  <div className="theme-selected-badge">✓</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="settings-actions">
        <button
          className="settings-btn-primary"
          onClick={handleSave}
          disabled={isSaving}
          data-testid="save-settings-btn"
        >
          {isSaving ? '保存中...' : '保存并应用'}
        </button>
      </div>
    </div>
  );
};

export default TerminalSettings;
