import { defineConfig } from 'vitest/config';

// Config separada de vite.config.ts para não carregar o plugin de mídia do AI Studio.
export default defineConfig({
  test: {
    environment: 'node',
    // src/ só tem testes de funções puras (sem DOM); componentes são verificados no navegador.
    include: ['api/**/*.test.ts', 'src/**/*.test.ts'],
    // supabaseAdmin.ts lança na hora do import se essas variáveis faltarem — não
    // são usadas de verdade (todo teste injeta seu próprio fake/memory repo), só
    // existem pra permitir importar módulos que criam o client no escopo do módulo.
    env: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    },
  },
});
