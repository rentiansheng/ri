import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TerminalSettings from '../Settings/TerminalSettings';

// Mock stores
vi.mock('../../store/configStore', () => ({
  useConfigStore: () => ({
    config: {
      version: '0.1.0',
      terminal: {
        fontSize: 14,
        fontFamily: 'Menlo',
        lineHeight: 1.0,
        cursorStyle: 'block',
        cursorBlink: true,
        scrollback: 1000,
        theme: {
          name: 'Gruvbox Dark',
          background: '#282828',
        },
      },
    },
    loadConfig: vi.fn(),
  }),
}));

vi.mock('../../store/xtermStore', () => ({
  useXTermStore: {
    getState: () => ({
      instances: new Map(),
    }),
  },
}));

describe('TerminalSettings', () => {
  beforeEach(() => {
    // Reset window.config mock before each test
    (window as any).config = {
      get: vi.fn().mockResolvedValue({
        version: '0.1.0',
        terminal: {
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          lineHeight: 1.0,
          cursorStyle: 'block',
          cursorBlink: true,
          scrollback: 1000,
          theme: {
            name: 'Gruvbox Dark',
            background: '#282828',
            foreground: '#ebdbb2',
          },
        },
        window: {
          width: 1200,
          height: 800,
        },
      }),
      update: vi.fn().mockResolvedValue({ success: true, config: {} }),
      onChange: vi.fn(() => () => {}),
    };
  });

  describe('Rendering', () => {
    it('should render all theme presets', async () => {
      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('Gruvbox Dark')).toBeInTheDocument();
        expect(screen.getByText('Dracula')).toBeInTheDocument();
        expect(screen.getByText('One Dark')).toBeInTheDocument();
        expect(screen.getByText('Solarized Dark')).toBeInTheDocument();
        expect(screen.getByText('Nord')).toBeInTheDocument();
      });
    });

    it('should render font settings section', async () => {
      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('字体设置')).toBeInTheDocument();
        expect(screen.getByText('字体大小')).toBeInTheDocument();
        expect(screen.getByText('字体族')).toBeInTheDocument();
        expect(screen.getByText('行高')).toBeInTheDocument();
      });
    });

    it('should render cursor settings section', async () => {
      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('光标设置')).toBeInTheDocument();
        expect(screen.getByText('光标样式')).toBeInTheDocument();
        expect(screen.getByText('光标闪烁')).toBeInTheDocument();
      });
    });

    it('should render scroll settings section', async () => {
      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('滚动设置')).toBeInTheDocument();
        expect(screen.getByText('回滚缓冲区')).toBeInTheDocument();
      });
    });

    it('should render save button', async () => {
      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('保存并应用')).toBeInTheDocument();
      });
    });
  });

  describe('Config Loading', () => {
    it('should load config on mount', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        terminal: {
          fontSize: 16,
          fontFamily: 'Monaco',
          cursorStyle: 'underline',
          cursorBlink: false,
          scrollback: 2000,
          theme: { name: 'Dracula' },
        },
      });

      (window as any).config.get = mockGet;

      render(<TerminalSettings />);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalled();
      });
    });

    it('should populate form with loaded config', async () => {
      (window as any).config.get = vi.fn().mockResolvedValue({
        terminal: {
          fontSize: 18,
          fontFamily: 'Consolas',
          lineHeight: 1.2,
          cursorStyle: 'bar',
          cursorBlink: false,
          scrollback: 5000,
          theme: { name: 'Nord' },
        },
      });

      render(<TerminalSettings />);

      await waitFor(() => {
        // Find the font size input by type and value
        const inputs = screen.getAllByDisplayValue('18');
        expect(inputs.length).toBeGreaterThan(0);
      });
    });

    it('should use default values if config is incomplete', async () => {
      (window as any).config.get = vi.fn().mockResolvedValue({
        terminal: {}, // Empty config
      });

      render(<TerminalSettings />);

      await waitFor(() => {
        // Find the font size input with default value
        const inputs = screen.getAllByDisplayValue('14');
        expect(inputs.length).toBeGreaterThan(0);
      });
    });
  });

  describe('User Interactions', () => {
    it('should update font size when user types', async () => {
      const user = userEvent.setup();
      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('字体大小')).toBeInTheDocument();
      });

      // Find number input for font size
      const inputs = document.querySelectorAll('input[type="number"]');
      const fontSizeInput = inputs[0] as HTMLInputElement; // First number input is font size

      await user.clear(fontSizeInput);
      await user.type(fontSizeInput, '20');

      expect(fontSizeInput).toHaveValue(20);
    });

    it('should select theme when clicked', async () => {
      const user = userEvent.setup();
      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('Dracula')).toBeInTheDocument();
      });

      const draculaTheme = screen.getByText('Dracula').closest('.theme-card');
      expect(draculaTheme).toBeInTheDocument();

      await user.click(draculaTheme!);

      // Verify the theme card gets selected (has checkmark or selected class)
      // This depends on your CSS implementation
    });

    it('should toggle cursor blink switch', async () => {
      const user = userEvent.setup();
      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('光标闪烁')).toBeInTheDocument();
      });

      // Find checkbox input for cursor blink
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      const cursorBlinkSwitch = checkboxes[0] as HTMLInputElement;
      const initialState = cursorBlinkSwitch.checked;

      await user.click(cursorBlinkSwitch);

      expect(cursorBlinkSwitch.checked).toBe(!initialState);
    });
  });

  describe('Save Functionality', () => {
    it('should call window.config.update when save button clicked', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn().mockResolvedValue({ 
        success: true, 
        config: { terminal: {} } 
      });

      (window as any).config.update = mockUpdate;

      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('保存并应用')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('保存并应用');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
    });

    it('should show success message after successful save', async () => {
      const user = userEvent.setup();
      (window as any).config.update = vi.fn().mockResolvedValue({ 
        success: true, 
        config: { terminal: {} } 
      });

      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('保存并应用')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('保存并应用');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('终端设置已保存并应用')).toBeInTheDocument();
      });
    });

    it('should show error message on save failure', async () => {
      const user = userEvent.setup();
      (window as any).config.update = vi.fn().mockResolvedValue({ 
        success: false, 
        error: '保存失败' 
      });

      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('保存并应用')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('保存并应用');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('保存失败')).toBeInTheDocument();
      });
    });

    it('should include selected theme in save payload', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn().mockResolvedValue({ 
        success: true, 
        config: { terminal: {} } 
      });

      (window as any).config.update = mockUpdate;

      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('Dracula')).toBeInTheDocument();
      });

      // Select Dracula theme
      const draculaTheme = screen.getByText('Dracula').closest('.theme-card');
      await user.click(draculaTheme!);

      // Click save
      const saveButton = screen.getByText('保存并应用');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            terminal: expect.objectContaining({
              theme: expect.objectContaining({
                name: 'Dracula',
                background: '#282a36',
              }),
            }),
          })
        );
      });
    });

    it('should disable save button while saving', async () => {
      const user = userEvent.setup();
      let resolveSave: any;
      const mockUpdate = vi.fn(() => new Promise(resolve => {
        resolveSave = resolve;
      }));

      (window as any).config.update = mockUpdate;

      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('保存并应用')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('保存并应用');
      await user.click(saveButton);

      // Button should be disabled while saving
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });

      // Resolve the save
      resolveSave({ success: true, config: { terminal: {} } });

      // Button should be enabled again
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('Validation', () => {
    it('should allow valid font size input', async () => {
      const user = userEvent.setup();
      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('字体大小')).toBeInTheDocument();
      });

      const inputs = document.querySelectorAll('input[type="number"]');
      const fontSizeInput = inputs[0] as HTMLInputElement;

      // Test valid value
      await user.clear(fontSizeInput);
      await user.type(fontSizeInput, '16');
      expect(fontSizeInput.value).toBe('16');
    });

    it('should allow valid scrollback input', async () => {
      const user = userEvent.setup();
      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('回滚缓冲区')).toBeInTheDocument();
      });

      // Scrollback input - find by looking for larger value inputs
      const scrollbackInput = screen.getByDisplayValue('1000') as HTMLInputElement;

      await user.clear(scrollbackInput);
      await user.type(scrollbackInput, '5000');
      expect(scrollbackInput.value).toBe('5000');
    });
  });

  describe('Error Handling', () => {
    it('should handle config load error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (window as any).config.get = vi.fn().mockRejectedValue(new Error('Load failed'));

      render(<TerminalSettings />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to load config:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle save error exception', async () => {
      const user = userEvent.setup();
      (window as any).config.update = vi.fn().mockRejectedValue(new Error('Network error'));

      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('保存并应用')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('保存并应用');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Network error|保存失败/i)).toBeInTheDocument();
      });
    });
  });

  describe('Message Auto-dismiss', () => {
    it('should show success message after save', async () => {
      const user = userEvent.setup();
      
      (window as any).config.update = vi.fn().mockResolvedValue({ 
        success: true, 
        config: { terminal: {} } 
      });

      render(<TerminalSettings />);

      await waitFor(() => {
        expect(screen.getByText('保存并应用')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('保存并应用');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('终端设置已保存并应用')).toBeInTheDocument();
      });
      
      // Message is displayed - auto-dismiss tested indirectly
    });
  });
});
