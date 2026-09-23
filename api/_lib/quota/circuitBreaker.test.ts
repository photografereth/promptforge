import { describe, it, expect } from 'vitest';
import { pickModelOrder } from './circuitBreaker.js';

const NOW = new Date('2026-09-23T17:00:00.000Z');

describe('pickModelOrder', () => {
  it('sem alta demanda registrada, usa a ordem padrão', () => {
    expect(pickModelOrder(null, NOW)).toEqual(['gemini-3.8-flash', 'gemini-3.1-flash-lite']);
  });
  it('alta demanda há menos de 3 minutos: prioriza o modelo mais leve', () => {
    const twoMinAgo = new Date(NOW.getTime() - 120_000).toISOString();
    expect(pickModelOrder(twoMinAgo, NOW)).toEqual(['gemini-3.1-flash-lite', 'gemini-3.8-flash']);
  });
  it('alta demanda há exatamente 3 minutos: já volta ao padrão', () => {
    const threeMinAgo = new Date(NOW.getTime() - 180_000).toISOString();
    expect(pickModelOrder(threeMinAgo, NOW)).toEqual(['gemini-3.8-flash', 'gemini-3.1-flash-lite']);
  });
  it('alta demanda há mais de 3 minutos: volta ao padrão', () => {
    const oneHourAgo = new Date(NOW.getTime() - 3_600_000).toISOString();
    expect(pickModelOrder(oneHourAgo, NOW)).toEqual(['gemini-3.8-flash', 'gemini-3.1-flash-lite']);
  });
});
