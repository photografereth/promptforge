import { supabase } from './supabaseClient';

// Wrapper de `fetch` que anexa o Bearer token da sessão Supabase atual (se houver)
// e assume Content-Type JSON quando um body é enviado sem headers explícitos.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(path, { ...init, headers });
}
