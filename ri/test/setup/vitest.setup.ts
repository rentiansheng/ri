/// <reference types="vitest" />
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Electron APIs
(window as any).config = {
  get: vi.fn().mockResolvedValue({
    version: '0.1.0',
    terminal: {
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontWeight: '400',
      fontWeightBold: '700',
      lineHeight: 1.0,
      letterSpacing: 0,
      cursorStyle: 'block',
      cursorBlink: true,
      scrollback: 1000,
      theme: {
        name: 'Gruvbox Dark',
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
    },
    window: {
      width: 1200,
      height: 800,
      alwaysOnTop: false,
      sidebarCollapsed: false,
      navigationWidth: 250,
    },
  }),
  update: vi.fn().mockResolvedValue({ success: true }),
  onChange: vi.fn((callback: any) => () => {}), // Return cleanup function
};

(window as any).terminal = {
  create: vi.fn().mockResolvedValue({ success: true, terminalId: 'test-terminal-id' }),
  write: vi.fn().mockResolvedValue({ success: true }),
  resize: vi.fn().mockResolvedValue({ success: true }),
  destroy: vi.fn().mockResolvedValue({ success: true }),
  onData: vi.fn((callback: any) => () => {}),
  onExit: vi.fn((callback: any) => () => {}),
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Suppress console errors during tests (optional)
// global.console.error = vi.fn();
// global.console.warn = vi.fn();
