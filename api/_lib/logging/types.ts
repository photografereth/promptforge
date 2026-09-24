export interface LogRepo {
  insertLog(level: string, event: string, details: Record<string, unknown> | null): Promise<void>;
}
