import { describe, it, expect } from 'vitest';
import { cancelSubscription, changePlan, resumeSubscription, undoPlanChange, updateCard } from './manage.js';
import { makeDeps, USER } from '../testing/fakes.js';
import { daysFromNow, makeSub } from '../testing/fixtures.js';

const ANNUAL = { frequency: 1, frequency_type: 'years', transaction_amount: 948, currency_id: 'BRL' };
const MONTHLY = { frequency: 1, frequency_type: 'months', transaction_amount: 119, currency_id: 'BRL' };

describe('changePlan', () => {
  it('agenda a troca para o fim do período sem mudar plano nem acesso', async () => {
    const sub = makeSub();
    const { deps, mp, repo, mailer } = makeDeps({ subs: [sub] });
    const res = await changePlan(deps, USER, { plan: 'annual' });
    expect(res).toEqual({ status: 200, body: { ok: true, pendingPlan: 'annual', effectiveAt: sub.current_period_end } });
    expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { auto_recurring: ANNUAL }, expect.any(String));
    expect(await repo.getByUser('user-1')).toMatchObject({
      plan: 'monthly',
      status: 'active',
      pending_plan: 'annual',
      pending_plan_effective_at: sub.current_period_end,
    });
    expect(repo.events.map((e) => e.action)).toContain('change_plan.scheduled');
    expect(mailer.sent[0].message.subject).toBe('Troca de plano agendada');
  });

  it('valida plano e estado', async () => {
    expect((await changePlan(makeDeps({ subs: [makeSub()] }).deps, USER, { plan: 'x' })).status).toBe(400);
    expect((await changePlan(makeDeps().deps, USER, { plan: 'annual' })).status).toBe(409);
    expect((await changePlan(makeDeps({ subs: [makeSub({ status: 'past_due' })] }).deps, USER, { plan: 'annual' })).status).toBe(409);
    expect((await changePlan(makeDeps({ subs: [makeSub()] }).deps, USER, { plan: 'monthly' })).status).toBe(409);
    expect((await changePlan(makeDeps({ subs: [makeSub({ cancel_at_period_end: true })] }).deps, USER, { plan: 'annual' })).status).toBe(409);
    expect((await changePlan(makeDeps({ subs: [makeSub({ current_period_end: null })] }).deps, USER, { plan: 'annual' })).status).toBe(409);
  });

  it('falha do MP devolve 502 e não grava a troca', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub()] });
    mp.updatePreapproval.mockRejectedValueOnce(new Error('mp'));
    expect((await changePlan(deps, USER, { plan: 'annual' })).status).toBe(502);
    expect((await repo.getByUser('user-1'))?.pending_plan).toBeNull();
  });
});

describe('undoPlanChange', () => {
  it('reverte o valor no MP e limpa a troca agendada', async () => {
    const sub = makeSub({ pending_plan: 'annual', pending_plan_effective_at: daysFromNow(27) });
    const { deps, mp, repo } = makeDeps({ subs: [sub] });
    expect((await undoPlanChange(deps, USER)).status).toBe(200);
    expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { auto_recurring: MONTHLY }, expect.any(String));
    expect(await repo.getByUser('user-1')).toMatchObject({ pending_plan: null, pending_plan_effective_at: null });
  });
  it('409 quando não há troca agendada', async () => {
    expect((await undoPlanChange(makeDeps({ subs: [makeSub()] }).deps, USER)).status).toBe(409);
  });
});

describe('updateCard', () => {
  it('troca o cartão na mesma assinatura (active e past_due)', async () => {
    for (const status of ['active', 'past_due'] as const) {
      const { deps, mp, repo } = makeDeps({ subs: [makeSub({ status })] });
      expect((await updateCard(deps, USER, { cardToken: 'novo-token-1234' })).status).toBe(200);
      expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { card_token_id: 'novo-token-1234' }, expect.any(String));
      expect(repo.events.map((e) => e.action)).toContain('update_card');
    }
  });
  it('valida token e estado; 502 se o MP falhar', async () => {
    expect((await updateCard(makeDeps({ subs: [makeSub()] }).deps, USER, { cardToken: 'x' })).status).toBe(400);
    expect((await updateCard(makeDeps().deps, USER, { cardToken: 'novo-token-1234' })).status).toBe(409);
    expect((await updateCard(makeDeps({ subs: [makeSub({ status: 'pending' })] }).deps, USER, { cardToken: 'novo-token-1234' })).status).toBe(409);
    const { deps, mp } = makeDeps({ subs: [makeSub()] });
    mp.updatePreapproval.mockRejectedValueOnce(new Error('mp'));
    expect((await updateCard(deps, USER, { cardToken: 'novo-token-1234' })).status).toBe(502);
  });
});

describe('cancelSubscription', () => {
  it('active: agenda para o fim do período, mantém acesso, não chama o MP', async () => {
    const sub = makeSub();
    const { deps, mp, repo, mailer } = makeDeps({ subs: [sub] });
    const res = await cancelSubscription(deps, USER);
    expect(res.body).toMatchObject({ ok: true, cancelAtPeriodEnd: true, accessUntil: sub.current_period_end });
    expect(mp.updatePreapproval).not.toHaveBeenCalled();
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'active', cancel_at_period_end: true });
    expect(mailer.sent[0].message.subject).toBe('Sua assinatura foi cancelada');
  });
  it('active já agendada: idempotente, sem novo e-mail', async () => {
    const { deps, mailer } = makeDeps({ subs: [makeSub({ cancel_at_period_end: true })] });
    expect((await cancelSubscription(deps, USER)).status).toBe(200);
    expect(mailer.sent).toHaveLength(0);
  });
  it('past_due: cancela de verdade no MP e encerra o acesso', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub({ status: 'past_due', grace_until: daysFromNow(3) })] });
    expect((await cancelSubscription(deps, USER)).body).toMatchObject({ status: 'canceled' });
    expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { status: 'cancelled' }, expect.any(String));
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'canceled', grace_until: null });
  });
  it('409 sem assinatura cancelável', async () => {
    expect((await cancelSubscription(makeDeps().deps, USER)).status).toBe(409);
    expect((await cancelSubscription(makeDeps({ subs: [makeSub({ status: 'canceled' })] }).deps, USER)).status).toBe(409);
  });
});

describe('resumeSubscription', () => {
  it('desfaz o cancelamento agendado', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ cancel_at_period_end: true })] });
    expect((await resumeSubscription(deps, USER)).status).toBe(200);
    expect((await repo.getByUser('user-1'))?.cancel_at_period_end).toBe(false);
  });
  it('409 sem cancelamento agendado', async () => {
    expect((await resumeSubscription(makeDeps({ subs: [makeSub()] }).deps, USER)).status).toBe(409);
  });
});
