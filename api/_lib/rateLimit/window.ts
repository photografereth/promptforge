const WINDOW_MS = 5 * 60 * 1000;

export function windowStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
}
