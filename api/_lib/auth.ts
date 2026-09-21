import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAnon } from './supabaseAnon.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

// Valida o Bearer token do Supabase. Em caso de falha, já escreve a resposta 401
// e retorna null — o handler chamador só precisa checar `if (!user) return;`.
export async function authenticate(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Não autenticado.' });
    return null;
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'Não autenticado.' });
    return null;
  }

  return { id: data.user.id, email: data.user.email || '' };
}
