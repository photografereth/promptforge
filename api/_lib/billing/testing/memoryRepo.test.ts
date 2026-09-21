import { describe, it, expect } from 'vitest';
import { createMemoryRepo } from './memoryRepo.js';
import { makeSub, NOW, daysFromNow } from './fixtures.js';

const clock = () => new Date(NOW);

describe('memoryRepo', () => {
  it('salva e busca por usuário e por preapproval', async () => {
    const repo = createMemoryRepo([], clock);
    await repo.save(makeSub());
    expect((await repo.getByUser('user-1'))?.mp_preapproval_id).toBe('pre_1');
    expect((await repo.getByPreapprovalId('pre_1'))?.user_id).toBe('user-1');
    expect(await repo.getByUser('nobody')).toBeNull();
  });

  it('claim de webhook é atômico e liberável', async () => {
    const repo = createMemoryRepo([], clock);
    expect(await repo.claimWebhookEvent('e1', 't')).toBe(true);
    expect(await repo.claimWebhookEvent('e1', 't')).toBe(false);
    await repo.releaseWebhookEvent('e1', 't');
    expect(await repo.claimWebhookEvent('e1', 't')).toBe(true);
  });

  it('conta eventos por usuário, ação e janela', async () => {
    const repo = createMemoryRepo([], clock);
    await repo.recordEvent({ user_id: 'user-1', actor: 'user', action: 'rl:x' });
    await repo.recordEvent({ user_id: 'user-1', actor: 'user', action: 'rl:x' });
    await repo.recordEvent({ user_id: 'user-2', actor: 'user', action: 'rl:x' });
    expect(await repo.countEvents('user-1', 'rl:x', daysFromNow(-1))).toBe(2);
    expect(await repo.countEvents('user-1', 'rl:x', daysFromNow(1))).toBe(0);
  });

  it('lista cancelamentos vencidos, carências vencidas e reconciliáveis', async () => {
    const repo = createMemoryRepo(
      [
        makeSub({ user_id: 'a', mp_preapproval_id: 'pa', cancel_at_period_end: true, current_period_end: daysFromNow(-1) }),
        makeSub({ user_id: 'b', mp_preapproval_id: 'pb', status: 'past_due', grace_until: daysFromNow(-1) }),
        makeSub({ user_id: 'c', mp_preapproval_id: 'pc', status: 'canceled' }),
      ],
      clock
    );
    expect((await repo.listCancellationsDue(NOW.toISOString())).map((s) => s.user_id)).toEqual(['a']);
    expect((await repo.listGraceExpired(NOW.toISOString())).map((s) => s.user_id)).toEqual(['b']);
    const rec = (await repo.listReconcilable(daysFromNow(-3))).map((s) => s.user_id).sort();
    // 'c' está cancelada mas foi atualizada dentro da janela de 3 dias: entra na reconciliação.
    expect(rec).toEqual(['a', 'b', 'c']);
    expect((await repo.listReconcilable(daysFromNow(1))).map((s) => s.user_id).sort()).toEqual(['a', 'b']);
  });
});
