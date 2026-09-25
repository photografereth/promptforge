import { describe, it, expect } from 'vitest';
import { enqueue } from './queue';

describe('enqueue', () => {
  it('uma tarefa que falha avisa e não trava as próximas', async () => {
    const ran: string[] = [];
    const errors: unknown[] = [];
    let queue = Promise.resolve();
    queue = enqueue(queue, async () => {
      throw new Error('quebrou');
    }, (e) => errors.push(e));
    queue = enqueue(queue, async () => {
      ran.push('segunda');
    }, (e) => errors.push(e));
    await queue;
    expect(errors).toHaveLength(1);
    expect(ran).toEqual(['segunda']);
  });

  it('executa em série, na ordem', async () => {
    const ran: number[] = [];
    let queue = Promise.resolve();
    for (const n of [1, 2, 3]) {
      queue = enqueue(queue, async () => {
        await new Promise((r) => setTimeout(r, 5 - n));
        ran.push(n);
      }, () => {});
    }
    await queue;
    expect(ran).toEqual([1, 2, 3]);
  });
});
