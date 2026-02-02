import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';
import path from 'path';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./test/setup/vitest.setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov', 'json'],
        include: ['src/renderer/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.d.ts',
          'src/**/*.config.ts',
          'src/**/index.ts',
          'src/**/__tests__/**',
          'src/**/types/**',
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
      },
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'test/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/*.old.*'],
      mockReset: true,
      restoreMocks: true,
      clearMocks: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src/renderer'),
        '@electron': path.resolve(__dirname, './electron'),
        '@test': path.resolve(__dirname, './test'),
      },
    },
  })
);

