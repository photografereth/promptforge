import { supabase } from './supabaseClient';

// Disparado quando uma rota protegida responde 403 com code "subscription_required":
// o app reconsulta o estado da assinatura e mostra o paywall.
export const SUBSCRIPTION_REQUIRED_EVENT = 'billing:subscription-required';

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

  const res = await fetch(path, { ...init, headers });

  if (res.status === 403) {
    res
      .clone()
      .json()
      .then((body) => {
        if (body?.code === 'subscription_required') {
          window.dispatchEvent(new Event(SUBSCRIPTION_REQUIRED_EVENT));
        }
      })
      .catch(() => {});
  }

  return res;
}
