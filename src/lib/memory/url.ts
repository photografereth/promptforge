export type Query = Record<string, string | undefined>;

// URLSearchParams codifica "+" como %2B: o cursor da biblioteca contém "+00:00".
export function memoryUrl(action: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return `/api/memory/${action}${qs ? `?${qs}` : ''}`;
}
