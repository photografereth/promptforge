import { describe, it, expect } from 'vitest';
import { todaySaoPauloDateString, nextMidnightSaoPaulo } from './timezone.js';

describe('todaySaoPauloDateString', () => {
  it('17h UTC (14h em SP) é o mesmo dia em SP', () => {
    expect(todaySaoPauloDateString(new Date('2026-09-23T17:00:00.000Z'))).toBe('2026-09-23');
  });
  it('02h59 UTC ainda é o dia anterior em SP (23h59 SP)', () => {
    expect(todaySaoPauloDateString(new Date('2026-09-24T02:59:00.000Z'))).toBe('2026-09-23');
  });
  it('03h01 UTC já é o novo dia em SP (00h01 SP)', () => {
    expect(todaySaoPauloDateString(new Date('2026-09-24T03:01:00.000Z'))).toBe('2026-09-24');
  });
});

describe('nextMidnightSaoPaulo', () => {
  it('meio da tarde em SP: próxima meia-noite é amanhã 03:00 UTC', () => {
    const result = nextMidnightSaoPaulo(new Date('2026-09-23T17:00:00.000Z'));
    expect(result.toISOString()).toBe('2026-09-24T03:00:00.000Z');
  });
  it('logo antes da virada em SP: próxima meia-noite ainda é a mesma data UTC-alvo', () => {
    const result = nextMidnightSaoPaulo(new Date('2026-09-24T02:59:00.000Z'));
    expect(result.toISOString()).toBe('2026-09-24T03:00:00.000Z');
  });
  it('logo depois da virada em SP: próxima meia-noite pula pro dia seguinte', () => {
    const result = nextMidnightSaoPaulo(new Date('2026-09-24T03:01:00.000Z'));
    expect(result.toISOString()).toBe('2026-09-25T03:00:00.000Z');
  });
});
