import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api',
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30_000,
  },
  plugins: [
    // NestJS necesita `emitDecoratorMetadata`, que esbuild no emite.
    swc.vite({ module: { type: 'es6' } }),
  ],
});
