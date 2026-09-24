import { describe, it, expect } from 'vitest';
import { logError } from './logger.js';
import { createMemoryRepo } from './testing/memoryRepo.js';

describe('logError', () => {
  it('persiste o evento com level, event e details', async () => {
    const repo = createMemoryRepo();
    await logError('teste_evento', { foo: 'bar' }, repo);
    expect(repo.logs).toEqual([{ level: 'error', event: 'teste_evento', details: { foo: 'bar' } }]);
  });

  it('details vira null quando omitido', async () => {
    const repo = createMemoryRepo();
    await logError('sem_detalhes', undefined, repo);
    expect(repo.logs[0].details).toBeNull();
  });

  it('não propaga erro se a persistência falhar', async () => {
    const repo = createMemoryRepo();
    repo.insertLog = async () => {
      throw new Error('db fora do ar');
    };
    await expect(logError('teste_evento', {}, repo)).resolves.toBeUndefined();
  });
});
