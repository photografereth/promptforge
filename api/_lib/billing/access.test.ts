import { describe, it, expect } from 'vitest';
import { hasAccess, checkWithdraw, profileMirror, addDays } from './access';
import { makeSub, NOW, daysFromNow } from './testing/fixtures';

describe('hasAccess', () => {
  it('nega sem assinatura', () => {
    expect(hasAccess(null, NOW)).toBe(false);
  });
  it('libera active', () => {
    expect(hasAccess(makeSub({ status: 'active' }), NOW)).toBe(true);
  });
  it('nega pending e canceled', () => {
    expect(hasAccess(makeSub({ status: 'pending' }), NOW)).toBe(false);
    expect(hasAccess(makeSub({ status: 'canceled' }), NOW)).toBe(false);
  });
  it('libera past_due dentro da carência', () => {
    expect(hasAccess(makeSub({ status: 'past_due', grace_until: daysFromNow(2) }), NOW)).toBe(true);
  });
  it('nega past_due com carência vencida ou ausente', () => {
    expect(hasAccess(makeSub({ status: 'past_due', grace_until: daysFromNow(-1) }), NOW)).toBe(false);
    expect(hasAccess(makeSub({ status: 'past_due', grace_until: null }), NOW)).toBe(false);
  });
});

describe('checkWithdraw', () => {
  it('permite dentro de 7 dias da primeira cobrança e informa o prazo', () => {
    const r = checkWithdraw(makeSub({ first_charge_at: daysFromNow(-3) }), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.deadline.toISOString()).toBe(daysFromNow(4));
  });
  it('nega após 7 dias', () => {
    expect(checkWithdraw(makeSub({ first_charge_at: daysFromNow(-8) }), NOW)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });
  it('nega sem assinatura ativa', () => {
    expect(checkWithdraw(null, NOW)).toEqual({ ok: false, reason: 'not_active' });
    expect(checkWithdraw(makeSub({ status: 'past_due' }), NOW)).toEqual({ ok: false, reason: 'not_active' });
  });
  it('nega sem primeira cobrança registrada', () => {
    expect(checkWithdraw(makeSub({ first_charge_at: null }), NOW)).toEqual({ ok: false, reason: 'no_charge' });
    expect(checkWithdraw(makeSub({ first_payment_id: null }), NOW)).toEqual({ ok: false, reason: 'no_charge' });
  });
  it('nega se já reembolsou', () => {
    expect(checkWithdraw(makeSub({ refunded_at: daysFromNow(-1) }), NOW)).toEqual({
      ok: false,
      reason: 'already_refunded',
    });
  });
});

describe('profileMirror', () => {
  it('pending vira trial (sem assinatura) e sem plano', () => {
    expect(profileMirror(makeSub({ status: 'pending' }))).toEqual({ subscription_status: 'trial', plan: null });
  });
  it('active e past_due carregam o plano', () => {
    expect(profileMirror(makeSub({ status: 'active', plan: 'annual' }))).toEqual({
      subscription_status: 'active',
      plan: 'annual',
    });
    expect(profileMirror(makeSub({ status: 'past_due' }))).toEqual({
      subscription_status: 'past_due',
      plan: 'monthly',
    });
  });
  it('canceled zera o plano', () => {
    expect(profileMirror(makeSub({ status: 'canceled' }))).toEqual({
      subscription_status: 'canceled',
      plan: null,
    });
  });
});

describe('addDays', () => {
  it('soma dias em UTC', () => {
    expect(addDays(NOW, 7).toISOString()).toBe('2026-09-25T12:00:00.000Z');
  });
});
