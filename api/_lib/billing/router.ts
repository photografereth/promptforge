import { fail, ok, type Deps, type Result, type User } from './service/context';
import { getInvoices, getStatus } from './service/status';
import { subscribe } from './service/subscribe';
import { withdraw } from './service/withdraw';

type Body = Record<string, unknown>;
type Handler = (deps: Deps, user: User, body: Body) => Promise<Result>;

// Só campos conhecidos do corpo chegam aos serviços; o resto é descartado.
const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  status: { GET: (d, u) => getStatus(d, u) },
  invoices: { GET: (d, u) => getInvoices(d, u) },
  config: { GET: async (d) => ok({ publicKey: d.publicKey }) },
  subscribe: { POST: (d, u, b) => subscribe(d, u, { plan: b.plan, cardToken: b.cardToken }) },
  // TODO(Task 9): change-plan (POST/DELETE), update-card, cancel e resume entram aqui após o Gate A.
  withdraw: { POST: (d, u) => withdraw(d, u) },
};

export async function routeBilling(
  deps: Deps,
  user: User,
  action: string,
  method: string,
  body: Body
): Promise<Result> {
  const route = Object.prototype.hasOwnProperty.call(ROUTES, action) ? ROUTES[action] : undefined;
  if (!route) return fail(404, 'Rota não encontrada.');
  const handler = route[method];
  if (!handler) return fail(405, 'Método não permitido.');
  return handler(deps, user, body);
}
