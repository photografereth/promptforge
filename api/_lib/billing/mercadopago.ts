export interface MpAutoRecurring {
  frequency: number;
  frequency_type: 'months' | 'years';
  transaction_amount: number;
  currency_id: 'BRL';
}

export interface MpPreapproval {
  id: string;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled';
  external_reference: string;
  payer_email?: string;
  next_payment_date?: string | null;
  auto_recurring: MpAutoRecurring;
}

export interface MpAuthorizedPayment {
  id: number | string;
  preapproval_id: string;
  status: string;
  transaction_amount: number;
  debit_date?: string;
  payment?: { id: number | string; status: string };
}

export interface MpCreatePreapproval {
  reason: string;
  external_reference: string;
  payer_email: string;
  card_token_id: string;
  auto_recurring: MpAutoRecurring;
  back_url: string;
  status: 'authorized';
}

export type MpUpdatePreapproval = {
  auto_recurring?: MpAutoRecurring;
  card_token_id?: string;
  status?: 'cancelled';
};

export interface MpClient {
  createPreapproval(input: MpCreatePreapproval, idempotencyKey: string): Promise<MpPreapproval>;
  getPreapproval(id: string): Promise<MpPreapproval>;
  updatePreapproval(id: string, body: MpUpdatePreapproval, idempotencyKey: string): Promise<MpPreapproval>;
  getAuthorizedPayment(id: string): Promise<MpAuthorizedPayment>;
  searchAuthorizedPayments(preapprovalId: string): Promise<MpAuthorizedPayment[]>;
  refundPayment(paymentId: string, idempotencyKey: string): Promise<{ id: number | string }>;
}

// O corpo da resposta de erro pode conter dados pessoais: não entra na mensagem.
export class MpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'MpError';
  }
}

const BASE_URL = 'https://api.mercadopago.com';

export function createMpClient(accessToken: string, fetchImpl: typeof fetch = fetch): MpClient {
  async function call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
    const res = await fetchImpl(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new MpError(res.status, `Mercado Pago ${method} ${path} respondeu ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    createPreapproval: (input, key) => call('POST', '/preapproval', input, key),
    getPreapproval: (id) => call('GET', `/preapproval/${encodeURIComponent(id)}`),
    updatePreapproval: (id, body, key) => call('PUT', `/preapproval/${encodeURIComponent(id)}`, body, key),
    getAuthorizedPayment: (id) => call('GET', `/authorized_payments/${encodeURIComponent(id)}`),
    async searchAuthorizedPayments(preapprovalId) {
      const res = await call<{ results?: MpAuthorizedPayment[] }>(
        'GET',
        `/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}`
      );
      return res.results ?? [];
    },
    refundPayment: (paymentId, key) =>
      call('POST', `/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {}, key),
  };
}

// Resultado de uma tentativa de cobrança recorrente. Usa o status do pagamento
// quando presente; senão, o status da própria cobrança.
export function paymentOutcome(ap: MpAuthorizedPayment): 'paid' | 'failed' | 'ignore' {
  const s = ap.payment?.status ?? ap.status;
  if (s === 'approved' || s === 'processed') return 'paid';
  if (s === 'rejected' || s === 'cancelled' || s === 'recycling') return 'failed';
  return 'ignore';
}
