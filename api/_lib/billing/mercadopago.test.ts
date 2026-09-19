import { describe, it, expect, vi } from 'vitest';
import { createMpClient, MpError, paymentOutcome } from './mercadopago';

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const recurring = { frequency: 1, frequency_type: 'months' as const, transaction_amount: 119, currency_id: 'BRL' as const };

describe('createMpClient', () => {
  it('cria preapproval com bearer, JSON e X-Idempotency-Key', async () => {
    const f = fakeFetch(201, { id: 'pre_1', status: 'authorized' });
    const mp = createMpClient('tok-secreto', f);
    const res = await mp.createPreapproval(
      { reason: 'r', external_reference: 'u1', payer_email: 'a@b.c', card_token_id: 'ct', auto_recurring: recurring, back_url: 'https://x/y', status: 'authorized' },
      'idem-1'
    );
    expect(res.id).toBe('pre_1');
    const [url, init] = (f as any).mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/preapproval');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-secreto');
    expect(init.headers['X-Idempotency-Key']).toBe('idem-1');
    expect(JSON.parse(init.body).card_token_id).toBe('ct');
  });

  it('GET não envia corpo nem idempotency key', async () => {
    const f = fakeFetch(200, { id: 'pre_1' });
    await createMpClient('t', f).getPreapproval('pre_1');
    const [url, init] = (f as any).mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/preapproval/pre_1');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers['X-Idempotency-Key']).toBeUndefined();
  });

  it('PUT atualiza a preapproval', async () => {
    const f = fakeFetch(200, { id: 'pre_1' });
    await createMpClient('t', f).updatePreapproval('pre_1', { status: 'cancelled' }, 'k');
    const [url, init] = (f as any).mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/preapproval/pre_1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ status: 'cancelled' });
  });

  it('busca cobranças e devolve a lista de results', async () => {
    const f = fakeFetch(200, { results: [{ id: 1, preapproval_id: 'pre_1', status: 'processed', transaction_amount: 119 }] });
    const list = await createMpClient('t', f).searchAuthorizedPayments('pre_1');
    expect(list).toHaveLength(1);
    expect((f as any).mock.calls[0][0]).toBe('https://api.mercadopago.com/authorized_payments/search?preapproval_id=pre_1');
  });

  it('devolve lista vazia quando results não existe', async () => {
    const f = fakeFetch(200, {});
    expect(await createMpClient('t', f).searchAuthorizedPayments('pre_1')).toEqual([]);
  });

  it('reembolso total via POST /v1/payments/{id}/refunds com corpo vazio', async () => {
    const f = fakeFetch(201, { id: 5 });
    await createMpClient('t', f).refundPayment('999', 'k');
    const [url, init] = (f as any).mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/v1/payments/999/refunds');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({});
  });

  it('erro HTTP vira MpError sem vazar o corpo da resposta', async () => {
    const f = fakeFetch(400, { message: 'dado sensível do cartão 4111' });
    await expect(createMpClient('t', f).getPreapproval('x')).rejects.toSatisfy(
      (e: unknown) => e instanceof MpError && e.status === 400 && !e.message.includes('4111')
    );
  });
});

describe('paymentOutcome', () => {
  it('interpreta o status do pagamento, com fallback para o status da cobrança', () => {
    const base = { id: 1, preapproval_id: 'p', transaction_amount: 1 };
    expect(paymentOutcome({ ...base, status: 'processed', payment: { id: 9, status: 'approved' } })).toBe('paid');
    expect(paymentOutcome({ ...base, status: 'processed', payment: { id: 9, status: 'rejected' } })).toBe('failed');
    expect(paymentOutcome({ ...base, status: 'processed' })).toBe('paid');
    expect(paymentOutcome({ ...base, status: 'recycling' })).toBe('failed');
    expect(paymentOutcome({ ...base, status: 'scheduled' })).toBe('ignore');
  });
});
