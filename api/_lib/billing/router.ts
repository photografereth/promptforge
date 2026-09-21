import { cancelSubscription, changePlan, resumeSubscription, undoPlanChange, updateCard } from './service/manage.js';
import { fail, ok, type Deps, type Result, type User } from './service/context.js';
import { getInvoices, getStatus } from './service/status.js';
import { subscribe } from './service/subscribe.js';
import { withdraw } from './service/withdraw.js';

type Body = Record<string, unknown>;
type Handler = (deps: Deps, user: User, body: Body) => Promise<Result>;

// Só campos conhecidos do corpo chegam aos serviços; o resto é descartado.
const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  status: { GET: (d, u) => getStatus(d, u) },
  invoices: { GET: (d, u) => getInvoices(d, u) },
  config: { GET: async (d) => ok({ publicKey: d.publicKey }) },
  subscribe: { POST: (d, u, b) => subscribe(d, u, { plan: b.plan, cardToken: b.cardToken }) },
  'change-plan': {
    POST: (d, u, b) => changePlan(d, u, { plan: b.plan }),
    DELETE: (d, u) => undoPlanChange(d, u),
  },
  'update-card': { POST: (d, u, b) => updateCard(d, u, { cardToken: b.cardToken }) },
  cancel: { POST: (d, u) => cancelSubscription(d, u) },
  resume: { POST: (d, u) => resumeSubscription(d, u) },
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
