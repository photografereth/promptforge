import { describe, it, expect } from 'vitest';
import { decideAccess } from './accessGate';
import { createMemoryRepo } from './testing/memoryRepo';
import { daysFromNow, makeSub, NOW } from './testing/fixtures';

describe('decideAccess', () => {
  it('ok para active e past_due em carência', async () => {
    const repo = createMemoryRepo([makeSub({ user_id: 'a' }), makeSub({ user_id: 'b', status: 'past_due', grace_until: daysFromNow(2) })]);
    expect(await decideAccess(repo, 'a', NOW)).toBe('ok');
    expect(await decideAccess(repo, 'b', NOW)).toBe('ok');
  });
  it('denied sem assinatura, pending, canceled ou carência vencida', async () => {
    const repo = createMemoryRepo([
      makeSub({ user_id: 'p', status: 'pending' }),
      makeSub({ user_id: 'c', status: 'canceled' }),
      makeSub({ user_id: 'g', status: 'past_due', grace_until: daysFromNow(-1) }),
    ]);
    for (const id of ['nobody', 'p', 'c', 'g']) expect(await decideAccess(repo, id, NOW)).toBe('denied');
  });
  it('falha fechada: erro no banco vira "error", nunca "ok"', async () => {
    const repo = createMemoryRepo();
    repo.getByUser = async () => {
      throw new Error('db fora do ar');
    };
    expect(await decideAccess(repo, 'a', NOW)).toBe('error');
  });
});
