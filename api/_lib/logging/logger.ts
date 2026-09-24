export function logInfo(event: string, details?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: 'info', event, ...details }));
}

export function logWarn(event: string, details?: Record<string, unknown>): void {
  console.warn(JSON.stringify({ level: 'warn', event, ...details }));
}
