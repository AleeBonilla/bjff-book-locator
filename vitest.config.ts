import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts', 'apps/api/vitest.config.ts'],
    // Las pruebas de integración comparten una única base de datos y cada caso la
    // vacía antes de empezar. Ejecutarlas en paralelo haría que unas borraran los
    // datos de otras. Es una opción de raíz: por proyecto se ignora.
    fileParallelism: false,
    maxWorkers: 1,
  },
});
