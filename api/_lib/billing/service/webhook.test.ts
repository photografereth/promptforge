import { describe, it, expect } from 'vitest';
import { handleWebhook, processAuthorizedPaymentEvent, processPreapprovalEvent } from './webhook';
import { makeAuthorizedPayment, makeDeps, makePreapproval } from '../testing/fakes';
import { daysFromNow, makeSub, NOW } from '../testing/fixtures';

describe('processPreapprovalEvent', () => {
  it('authorized: pending vira active e grava o fim do período nativo', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'pending', current_period_end: null })] });
    await processPreapprovalEvent(deps, 'pre_1');
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'active', current_period_end: daysFromNow(27) });
    expect(repo.events.map((e) => e.action)).toContain('webhook.preapproval');
  });

  it('sem mudança de estado: não grava nem registra evento', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub()] });
    await processPreapprovalEvent(deps, 'pre_1');
    expect(repo.events).toHaveLength(0);
  });

  it('assinatura desconhecida ou de outro preapproval: registra órfão e segue', async () => {
    const a = makeDeps();
    await processPreapprovalEvent(a.deps, 'pre_1');
    expect(a.repo.events.map((e) => e.action)).toContain('webhook.orphan_preapproval');
    const b = makeDeps({ subs: [makeSub({ mp_preapproval_id: 'outro' })] });
    await processPreapprovalEvent(b.deps, 'pre_1');
    expect(b.repo.events.map((e) => e.action)).toContain('webhook.orphan_preapproval');
    expect((await b.repo.getByUser('user-1'))?.mp_preapproval_id).toBe('outro');
  });

  it('paused: active vira past_due com carência de 7 dias; pending não ganha acesso', async () => {
    const a = makeDeps({ subs: [makeSub()] });
    a.mp.getPreapproval.mockResolvedValueOnce(makePreapproval({ status: 'paused' }));
    await processPreapprovalEvent(a.deps, 'pre_1');
    expect(await a.repo.getByUser('user-1')).toMatchObject({ status: 'past_due', grace_until: daysFromNow(7) });

    const b = makeDeps({ subs: [makeSub({ status: 'pending' })] });
    b.mp.getPreapproval.mockResolvedValueOnce(makePreapproval({ status: 'paused' }));
    await processPreapprovalEvent(b.deps, 'pre_1');
    expect((await b.repo.getByUser('user-1'))?.status).toBe('pending');
  });

  it('authorized não reativa past_due (só um pagamento aprovado reativa)', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'past_due', grace_until: daysFromNow(3) })] });
    await processPreapprovalEvent(deps, 'pre_1');
    expect((await repo.getByUser('user-1'))?.status).toBe('past_due');
  });

  it('cancelled: cancela, limpa estados e envia e-mail uma única vez', async () => {
    const { deps, mp, repo, mailer } = makeDeps({ subs: [makeSub({ cancel_at_period_end: true })] });
    mp.getPreapproval.mockResolvedValue(makePreapproval({ status: 'cancelled' }));
    await processPreapprovalEvent(deps, 'pre_1');
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'canceled', cancel_at_period_end: false });
    await processPreapprovalEvent(deps, 'pre_1');
    expect(mailer.sent).toHaveLength(1);
  });

  it('localmente cancelada mas ainda authorized no MP: ignora e registra (o cron corrige)', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'canceled' })] });
    await processPreapprovalEvent(deps, 'pre_1');
    expect((await repo.getByUser('user-1'))?.status).toBe('canceled');
    expect(repo.events.map((e) => e.action)).toContain('webhook.ignored_after_cancel');
  });
});

describe('processAuthorizedPaymentEvent', () => {
  it('primeira cobrança aprovada: ativa, registra primeira cobrança e envia recibo', async () => {
    const { deps, repo, mailer } = makeDeps({ subs: [makeSub({ status: 'pending', current_period_end: null, first_charge_at: null, first_payment_id: null })] });
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(await repo.getByUser('user-1')).toMatchObject({
      status: 'active',
      first_charge_at: NOW.toISOString(),
      first_payment_id: '555',
      current_period_end: daysFromNow(27),
      grace_until: null,
    });
    expect(mailer.sent[0].message.subject).toBe('Recibo da sua assinatura');
  });

  it('cobrança aprovada em past_due limpa a carência e reativa', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'past_due', grace_until: daysFromNow(3) })] });
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'active', grace_until: null });
  });

  it('valor divergente do plano: não libera acesso e registra a divergência', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub({ status: 'pending', current_period_end: null })] });
    mp.getAuthorizedPayment.mockResolvedValueOnce(makeAuthorizedPayment({ transaction_amount: 1 }));
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect((await repo.getByUser('user-1'))?.status).toBe('pending');
    expect(repo.events.map((e) => e.action)).toContain('reconcile.amount_mismatch');
  });

  it('cobrança no valor do plano agendado promove pending_plan', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub({ pending_plan: 'annual', pending_plan_effective_at: daysFromNow(0) })] });
    mp.getAuthorizedPayment.mockResolvedValueOnce(makeAuthorizedPayment({ transaction_amount: 948 }));
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(await repo.getByUser('user-1')).toMatchObject({ plan: 'annual', pending_plan: null, pending_plan_effective_at: null });
  });

  it('cobrança recusada: past_due com carência de 7 dias e um único e-mail', async () => {
    const { deps, mp, repo, mailer } = makeDeps({ subs: [makeSub()] });
    mp.getAuthorizedPayment.mockResolvedValue(makeAuthorizedPayment({ status: 'recycling', payment: { id: 9, status: 'rejected' } }));
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'past_due', grace_until: daysFromNow(7) });
    expect(mailer.sent[0].message.subject).toBe('Não conseguimos processar a cobrança da sua assinatura');
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(mailer.sent).toHaveLength(1);
  });

  it('cobrança ainda agendada: ignora', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub()] });
    mp.getAuthorizedPayment.mockResolvedValueOnce(makeAuthorizedPayment({ status: 'scheduled', payment: undefined }));
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(repo.events).toHaveLength(0);
  });

  it('cobrança aprovada para assinatura cancelada: não reativa', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'canceled' })] });
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect((await repo.getByUser('user-1'))?.status).toBe('canceled');
    expect(repo.events.map((e) => e.action)).toContain('webhook.paid_after_cancel');
  });

  it('reassinatura após reembolso recebe acesso e mantém refunded_at', async () => {
    const refundedAt = daysFromNow(-30);
    const { deps, repo } = makeDeps({
      subs: [makeSub({ status: 'pending', current_period_end: null, first_charge_at: null, first_payment_id: null, refunded_at: refundedAt })],
    });
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'active', refunded_at: refundedAt, first_payment_id: '555' });
  });

  it('cobrança de preapproval desconhecida: registra órfão', async () => {
    const { deps, repo } = makeDeps();
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(repo.events.map((e) => e.action)).toContain('webhook.orphan_authorized_payment');
  });

  it('propaga erro do MP ao confirmar o período (o webhook será reenviado)', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub({ status: 'pending', current_period_end: null })] });
    mp.getPreapproval.mockRejectedValueOnce(new Error('mp'));
    await expect(processAuthorizedPaymentEvent(deps, 'ap_1')).rejects.toThrow();
  });
});

describe('handleWebhook', () => {
  const evt = { type: 'subscription_preapproval', dataId: 'pre_1', requestId: 'req-1' };

  it('ignora tópicos não suportados e id vazio', async () => {
    const { deps, mp } = makeDeps();
    expect(await handleWebhook(deps, { ...evt, type: 'payment' })).toBe(200);
    expect(await handleWebhook(deps, { ...evt, dataId: '' })).toBe(200);
    expect(mp.getPreapproval).not.toHaveBeenCalled();
  });

  it('a mesma entrega (mesmo request-id) não é reprocessada; outro request-id é', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub()] });
    expect(await handleWebhook(deps, evt)).toBe(200);
    expect(await handleWebhook(deps, evt)).toBe(200);
    expect(mp.getPreapproval).toHaveBeenCalledTimes(1);
    expect(await handleWebhook(deps, { ...evt, requestId: 'req-2' })).toBe(200);
    expect(mp.getPreapproval).toHaveBeenCalledTimes(2);
  });

  it('roteia authorized_payment', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub()] });
    await handleWebhook(deps, { type: 'subscription_authorized_payment', dataId: 'ap_1', requestId: 'r' });
    expect(mp.getAuthorizedPayment).toHaveBeenCalledWith('ap_1');
  });

  it('falha no processamento devolve 500 e libera a chave para o reenvio', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub()] });
    mp.getPreapproval.mockRejectedValueOnce(new Error('mp'));
    expect(await handleWebhook(deps, evt)).toBe(500);
    expect(await handleWebhook(deps, evt)).toBe(200);
    expect(mp.getPreapproval).toHaveBeenCalledTimes(2);
  });
});
