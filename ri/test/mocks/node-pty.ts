import { vi } from 'vitest';

/**
 * Mock for node-pty
 */
export const mockPtyProcess = {
  pid: 12345,
  onData: vi.fn((callback) => ({ dispose: vi.fn() })),
  onExit: vi.fn((callback) => ({ dispose: vi.fn() })),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
};

export const mockPty = {
  spawn: vi.fn().mockReturnValue(mockPtyProcess),
};

// Export for vitest.mock()
export default mockPty;
