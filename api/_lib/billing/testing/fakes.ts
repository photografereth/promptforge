import { vi, type Mock } from 'vitest';
import { autoRecurringFor } from '../../plans.js';
import type { EmailMessage, Mailer } from '../mailer.js';
import type { MpAuthorizedPayment, MpClient, MpPreapproval } from '../mercadopago.js';
import type { Deps } from '../service/context.js';
import type { Subscription } from '../types.js';
import { daysFromNow, NOW } from './fixtures.js';
import { createMemoryRepo } from './memoryRepo.js';

export const USER = { id: 'user-1', email: 'ana@example.com' };

export type FakeMp = { [K in keyof MpClient]: Mock<MpClient[K]> };

export function makePreapproval(overrides: Partial<MpPreapproval> = {}): MpPreapproval {
  return {
    id: 'pre_1',
    status: 'authorized',
    external_reference: 'user-1',
    payer_email: 'ana@example.com',
    next_payment_date: daysFromNow(27),
    auto_recurring: autoRecurringFor('monthly'),
    ...overrides,
  };
}

export function makeAuthorizedPayment(overrides: Partial<MpAuthorizedPayment> = {}): MpAuthorizedPayment {
  return {
    id: 'ap_1',
    preapproval_id: 'pre_1',
    status: 'processed',
    transaction_amount: 119,
    debit_date: NOW.toISOString(),
    payment: { id: 555, status: 'approved' },
    ...overrides,
  };
}

export function createFakeMp(): FakeMp {
  return {
    createPreapproval: vi.fn<MpClient['createPreapproval']>(async () => makePreapproval({ next_payment_date: null })),
    getPreapproval: vi.fn<MpClient['getPreapproval']>(async () => makePreapproval()),
    updatePreapproval: vi.fn<MpClient['updatePreapproval']>(async () => makePreapproval()),
    getAuthorizedPayment: vi.fn<MpClient['getAuthorizedPayment']>(async () => makeAuthorizedPayment()),
    getPayment: vi.fn<MpClient['getPayment']>(async () => ({ id: 555, status: 'approved' })),
    searchAuthorizedPayments: vi.fn<MpClient['searchAuthorizedPayments']>(async () => []),
    refundPayment: vi.fn<MpClient['refundPayment']>(async () => ({ id: 1 })),
  };
}

export interface FakeMailer extends Mailer {
  sent: { to: string; message: EmailMessage }[];
}

export function createFakeMailer(): FakeMailer {
  const sent: FakeMailer['sent'] = [];
  return {
    sent,
    async send(to, message) {
      sent.push({ to, message });
    },
  };
}

export function makeDeps(opts: { subs?: Subscription[] } = {}) {
  const state = { now: new Date(NOW) };
  const clock = () => new Date(state.now);
  const repo = createMemoryRepo(opts.subs ?? [], clock);
  repo.setEmail('user-1', 'ana@example.com');
  const mp = createFakeMp();
  const mailer = createFakeMailer();
  const deps: Deps = {
    mp,
    repo,
    mailer,
    now: clock,
    appUrl: 'https://app.example.com',
    publicKey: 'public-key-de-teste',
    notificationUrl: 'https://app.example.com/api/webhooks/mercadopago',
  };
  return {
    deps,
    mp,
    repo,
    mailer,
    setNow: (d: Date) => {
      state.now = d;
    },
  };
}
