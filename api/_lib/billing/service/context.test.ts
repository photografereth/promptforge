import { describe, it, expect } from 'vitest';
import { canceledState, guard, idemKey, safeSend } from './context.js';
import { makeDeps } from '../testing/fakes.js';
import { makeSub, NOW } from '../testing/fixtures.js';

describe('idemKey', () => {
  it('é determinística e sensível aos parâmetros', () => {
    expect(idemKey('a', 'b')).toBe(idemKey('a', 'b'));
    expect(idemKey('a', 'b')).not.toBe(idemKey('a', 'c'));
    expect(idemKey('a', 'b')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('guard', () => {
  it('permite até o limite, bloqueia depois e libera após a janela', async () => {
    const { deps, setNow } = makeDeps();
    for (let i = 0; i < 3; i++) expect(await guard(deps, 'user-1', 'x', 3, 60_000)).toBeNull();
    const blocked = await guard(deps, 'user-1', 'x', 3, 60_000);
    expect(blocked?.status).toBe(429);
    setNow(new Date(NOW.getTime() + 61_000));
    expect(await guard(deps, 'user-1', 'x', 3, 60_000)).toBeNull();
  });
  it('isola por usuário', async () => {
    const { deps } = makeDeps();
    await guard(deps, 'user-1', 'x', 1, 60_000);
    expect(await guard(deps, 'user-2', 'x', 1, 60_000)).toBeNull();
  });
});

describe('safeSend', () => {
  it('envia para o e-mail do perfil', async () => {
    const { deps, mailer } = makeDeps();
    await safeSend(deps, 'user-1', { subject: 's', html: 'h' });
    expect(mailer.sent).toEqual([{ to: 'ana@example.com', message: { subject: 's', html: 'h' } }]);
  });
  it('registra e engole falha de envio', async () => {
    const { deps, repo } = makeDeps();
    deps.mailer.send = async () => {
      throw new Error('resend fora do ar');
    };
    await expect(safeSend(deps, 'user-1', { subject: 's', html: 'h' })).resolves.toBeUndefined();
    expect(repo.events.map((e) => e.action)).toContain('email.failed');
  });
});

describe('canceledState', () => {
  it('limpa carência, cancelamento agendado e troca de plano', () => {
    const s = canceledState(
      makeSub({ cancel_at_period_end: true, grace_until: NOW.toISOString(), pending_plan: 'annual', pending_plan_effective_at: NOW.toISOString() })
    );
    expect(s).toMatchObject({
      status: 'canceled',
      grace_until: null,
      cancel_at_period_end: false,
      pending_plan: null,
      pending_plan_effective_at: null,
    });
  });
});
