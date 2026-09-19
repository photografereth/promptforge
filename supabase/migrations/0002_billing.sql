-- Pilar 2: assinaturas e cobrança recorrente (Mercado Pago)

create table public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mp_preapproval_id text unique,
  plan text not null check (plan in ('monthly', 'annual')),
  status text not null check (status in ('pending', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  pending_plan text check (pending_plan in ('monthly', 'annual')),
  pending_plan_effective_at timestamptz,
  grace_until timestamptz,
  first_charge_at timestamptz,
  first_payment_id text,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_status_period_idx on public.subscriptions (status, current_period_end);
create index subscriptions_status_grace_idx on public.subscriptions (status, grace_until);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
-- Sem policies de insert/update/delete: só o service role escreve.

create table public.billing_events (
  id bigint generated always as identity primary key,
  -- Sem FK: a trilha de auditoria sobrevive à exclusão da conta
  -- (o trigger de imutabilidade bloquearia um "on delete set null").
  user_id uuid,
  actor text not null check (actor in ('user', 'webhook', 'cron', 'system')),
  action text not null,
  before jsonb,
  after jsonb,
  mp_id text,
  created_at timestamptz not null default now()
);

create index billing_events_user_action_idx on public.billing_events (user_id, action, created_at);

alter table public.billing_events enable row level security;
-- Sem policies: só o service role acessa.

create function public.billing_events_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'billing_events is append-only';
end;
$$;

create trigger billing_events_no_update
  before update or delete on public.billing_events
  for each row execute function public.billing_events_immutable();

create table public.webhook_events (
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  primary key (event_id, event_type)
);

alter table public.webhook_events enable row level security;
-- Sem policies: só o service role acessa.

-- Fecha a brecha do Pilar 1: o usuário podia alterar o próprio subscription_status
-- via anon key. A partir daqui, escritas de assinatura em profiles só via backend.
drop policy if exists "profiles_update_own" on public.profiles;
