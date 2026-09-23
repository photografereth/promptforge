-- Pilar 3: cota diária de uso de IA e circuit breaker compartilhado do Gemini

create table public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  count integer not null default 0,
  primary key (user_id, usage_date)
);

alter table public.ai_usage_daily enable row level security;

create policy "ai_usage_select_own" on public.ai_usage_daily
  for select using (auth.uid() = user_id);

-- Incremento atômico: nunca "ler depois escrever" em código da aplicação.
create or replace function public.increment_ai_usage(p_user_id uuid, p_date date)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage_daily (user_id, usage_date, count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, usage_date)
  do update set count = ai_usage_daily.count + 1
  returning count;
$$;

-- Supabase concede EXECUTE em funções novas do schema public a anon/authenticated
-- por default privileges, mesmo sendo security definer — "revoke ... from public"
-- sozinho não desfaz isso. Revogar de cada role explicitamente.
revoke all on function public.increment_ai_usage(uuid, date) from public, anon, authenticated;
grant execute on function public.increment_ai_usage(uuid, date) to service_role;

create table public.gemini_circuit_breaker (
  id boolean primary key default true,
  last_high_demand_at timestamptz,
  constraint gemini_circuit_breaker_single_row check (id)
);

insert into public.gemini_circuit_breaker (id, last_high_demand_at)
values (true, null);

alter table public.gemini_circuit_breaker enable row level security;
-- Sem policies: só o service role acessa (nenhum policy = nenhum acesso pro client role).
