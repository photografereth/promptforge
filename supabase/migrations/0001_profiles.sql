-- Pilar 1: Fundação de dados e autenticação
-- Cria o enum de status de assinatura, a tabela de perfis (1:1 com auth.users),
-- políticas de RLS, e o trigger que popula o perfil automaticamente no signup.

create type subscription_status as enum ('trial', 'active', 'past_due', 'canceled');
create type subscription_plan as enum ('monthly', 'annual');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  subscription_status subscription_status not null default 'trial',
  plan subscription_plan,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-cria a linha de perfil sempre que um novo usuário se cadastra.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'display_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
