import { describe, it, expect } from 'vitest';
import { memoryUrl } from './url';

describe('memoryUrl', () => {
  it('monta a rota sem query quando não há parâmetros', () => {
    expect(memoryUrl('brands')).toBe('/api/memory/brands');
  });
  it('codifica o "+" do cursor e omite parâmetros vazios', () => {
    const url = memoryUrl('prompts', { brandId: 'b1', cursor: '2026-09-24T12:00:00.1+00:00|x', q: '', favorite: undefined });
    expect(url).toBe('/api/memory/prompts?brandId=b1&cursor=2026-09-24T12%3A00%3A00.1%2B00%3A00%7Cx');
  });
  it('codifica espaços da busca', () => {
    expect(memoryUrl('prompts', { brandId: 'b1', q: 'teste busca' })).toBe('/api/memory/prompts?brandId=b1&q=teste+busca');
  });
});
