import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 10000, // 10 second timeout to prevent hanging
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './'),
    },
  },
});

