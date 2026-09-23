-- Pilar 5 (parte 2): rate limit por IP, pré-autenticação

create table public.ip_rate_limit (
  ip text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (ip, window_start)
);

alter table public.ip_rate_limit enable row level security;
-- Sem policies: só o service role acessa.

create or replace function public.increment_ip_rate_limit(p_ip text, p_window_start timestamptz)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.ip_rate_limit (ip, window_start, count)
  values (p_ip, p_window_start, 1)
  on conflict (ip, window_start)
  do update set count = ip_rate_limit.count + 1
  returning count;
$$;

revoke all on function public.increment_ip_rate_limit(text, timestamptz) from public, anon, authenticated;
grant execute on function public.increment_ip_rate_limit(text, timestamptz) to service_role;
