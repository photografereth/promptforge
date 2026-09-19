import { defineConfig } from 'vitest/config';

// Config separada de vite.config.ts para não carregar o plugin de mídia do AI Studio.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['api/**/*.test.ts'],
  },
});
