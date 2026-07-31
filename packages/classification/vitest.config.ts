import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'classification',
    include: ['test/**/*.spec.ts'],
    environment: 'node',
  },
});
