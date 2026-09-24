import type { LogRepo } from '../types.js';

export interface LoggedEntry {
  level: string;
  event: string;
  details: Record<string, unknown> | null;
}

export interface MemoryLogRepo extends LogRepo {
  logs: LoggedEntry[];
}

export function createMemoryRepo(): MemoryLogRepo {
  const logs: LoggedEntry[] = [];
  return {
    logs,
    async insertLog(level, event, details) {
      logs.push({ level, event, details });
    },
  };
}
