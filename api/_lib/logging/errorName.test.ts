import { describe, it, expect } from 'vitest';
import { errorName } from './errorName.js';

describe('errorName', () => {
  it('devolve o name de um Error real', () => {
    expect(errorName(new TypeError('oops'))).toBe('TypeError');
  });
  it('devolve "unknown" pra valores que não são Error', () => {
    expect(errorName('string qualquer')).toBe('unknown');
    expect(errorName(null)).toBe('unknown');
    expect(errorName(undefined)).toBe('unknown');
    expect(errorName(42)).toBe('unknown');
  });
});
