import { describe, it, expect } from 'vitest';
import { windowStart } from './window.js';

describe('windowStart', () => {
  it('arredonda pra baixo pro múltiplo de 5 minutos mais próximo', () => {
    expect(windowStart(new Date('2026-09-23T17:03:00.000Z')).toISOString()).toBe('2026-09-23T17:00:00.000Z');
    expect(windowStart(new Date('2026-09-23T17:07:59.999Z')).toISOString()).toBe('2026-09-23T17:05:00.000Z');
  });
  it('instantes 1s antes e depois de uma borda caem em janelas diferentes', () => {
    const before = windowStart(new Date('2026-09-23T17:04:59.000Z'));
    const after = windowStart(new Date('2026-09-23T17:05:01.000Z'));
    expect(before.toISOString()).toBe('2026-09-23T17:00:00.000Z');
    expect(after.toISOString()).toBe('2026-09-23T17:05:00.000Z');
    expect(before.getTime()).not.toBe(after.getTime());
  });
  it('exatamente na borda já conta como a nova janela', () => {
    expect(windowStart(new Date('2026-09-23T17:05:00.000Z')).toISOString()).toBe('2026-09-23T17:05:00.000Z');
  });
});
