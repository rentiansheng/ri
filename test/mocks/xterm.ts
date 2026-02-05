import { vi } from 'vitest';

/**
 * Mock for xterm.js Terminal
 */
export class MockTerminal {
  options: any = {};
  
  loadAddon = vi.fn();
  open = vi.fn();
  write = vi.fn();
  writeln = vi.fn();
  resize = vi.fn();
  dispose = vi.fn();
  clear = vi.fn();
  reset = vi.fn();
  focus = vi.fn();
  blur = vi.fn();
  
  onData = vi.fn((callback) => ({ dispose: vi.fn() }));
  onResize = vi.fn((callback) => ({ dispose: vi.fn() }));
  onTitleChange = vi.fn((callback) => ({ dispose: vi.fn() }));
  
  // Unicode addon
  unicode = {
    activeVersion: '11',
  };
}

/**
 * Mock for xterm-addon-fit
 */
export class MockFitAddon {
  fit = vi.fn();
  proposeDimensions = vi.fn().mockReturnValue({ cols: 80, rows: 24 });
}

/**
 * Mock for xterm-addon-search
 */
export class MockSearchAddon {
  findNext = vi.fn();
  findPrevious = vi.fn();
}

/**
 * Mock for xterm-addon-web-links
 */
export class MockWebLinksAddon {}

/**
 * Mock for xterm-addon-unicode11
 */
export class MockUnicode11Addon {}

// Export mocks for vitest.mock()
export const xtermMocks = {
  Terminal: MockTerminal,
  FitAddon: MockFitAddon,
  SearchAddon: MockSearchAddon,
  WebLinksAddon: MockWebLinksAddon,
  Unicode11Addon: MockUnicode11Addon,
};
