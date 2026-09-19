import { describe, it, expect, vi } from 'vitest';
import { createResendMailer, emails } from './mailer';

describe('createResendMailer', () => {
  it('envia via API do Resend com bearer e destinatário', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    await createResendMailer('re_key', 'Forge <no-reply@x.com>', f).send('ana@example.com', { subject: 'Oi', html: '<p>x</p>' });
    const [url, init] = (f as any).mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_key');
    expect(JSON.parse(init.body)).toEqual({ from: 'Forge <no-reply@x.com>', to: ['ana@example.com'], subject: 'Oi', html: '<p>x</p>' });
  });
  it('lança se não configurado ou se o Resend falhar', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
    await expect(createResendMailer('', '', f).send('a@b.c', { subject: 's', html: 'h' })).rejects.toThrow();
    await expect(createResendMailer('k', 'f', f).send('a@b.c', { subject: 's', html: 'h' })).rejects.toThrow();
  });
});

describe('emails', () => {
  it('paymentFailed traz a data limite e o link do cartão', () => {
    const m = emails.paymentFailed({ graceUntil: new Date('2026-09-25T12:00:00Z'), updateCardUrl: 'https://app.example.com' });
    expect(m.subject).toMatch(/cobrança/i);
    expect(m.html).toContain('25/09/2026');
    expect(m.html).toContain('https://app.example.com');
  });
  it('subscriptionCanceled com e sem data de acesso', () => {
    expect(emails.subscriptionCanceled({ accessUntil: new Date('2026-10-18T12:00:00Z') }).html).toContain('18/10/2026');
    expect(emails.subscriptionCanceled({ accessUntil: null }).html).not.toContain('undefined');
  });
  it('planChangeScheduled, refundDone e receipt formatam valores em BRL', () => {
    expect(emails.planChangeScheduled({ planLabel: 'Plano Anual', effectiveAt: new Date('2026-10-18T12:00:00Z') }).html).toContain('Plano Anual');
    expect(emails.refundDone({ amount: 119 }).html).toContain('119,00');
    const r = emails.receipt({ planLabel: 'Plano Mensal', amount: 119, nextChargeAt: new Date('2026-10-18T12:00:00Z') });
    expect(r.html).toContain('119,00');
    expect(r.html).toContain('18/10/2026');
  });
  it('escapa HTML em valores dinâmicos', () => {
    expect(emails.planChangeScheduled({ planLabel: '<script>x</script>', effectiveAt: new Date() }).html).not.toContain('<script>');
  });
});
