-- Memória da marca: marcas, ativos (produtos/elenco), biblioteca de prompts e fotos.

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kit jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brands_one_default_per_user on public.brands (user_id) where is_default;
create index brands_user_idx on public.brands (user_id, created_at);

create table public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('product', 'character')),
  name text not null,
  data jsonb not null,
  analysis jsonb,
  photos jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brand_assets_name_unique on public.brand_assets (brand_id, kind, lower(name));
create index brand_assets_list_idx on public.brand_assets (brand_id, pinned, last_used_at desc);
create index brand_assets_user_idx on public.brand_assets (user_id);

create table public.prompt_library (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('video', 'image')),
  agent text,
  title text not null,
  product_name text,
  deterministic_prompt text not null,
  enhanced_prompt text,
  state jsonb,
  asset_ids uuid[] not null default '{}',
  favorite boolean not null default false,
  legacy_id text,
  created_at timestamptz not null default now()
);
create unique index prompt_library_legacy_unique on public.prompt_library (user_id, legacy_id) where legacy_id is not null;
create index prompt_library_list_idx on public.prompt_library (brand_id, created_at desc, id desc);

alter table public.brands enable row level security;
alter table public.brand_assets enable row level security;
alter table public.prompt_library enable row level security;
-- Sem policies: só o service role acessa.

-- Bucket privado. O limite de tamanho e de tipo vale também para uploads por link assinado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Arquivos do bucket com mais de p_older_than que nenhum ativo referencia (upload nunca confirmado,
-- ou remoção do Storage que falhou). Usada só pelo cron diário.
create or replace function public.list_orphan_brand_photos(p_older_than timestamptz)
returns table (path text)
language sql
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'brand-assets'
    and o.created_at < p_older_than
    and not exists (
      select 1
      from public.brand_assets a
      cross join lateral jsonb_array_elements(a.photos) p
      where p ->> 'path' = o.name
    )
  limit 1000;
$$;

revoke all on function public.list_orphan_brand_photos(timestamptz) from public, anon, authenticated;
grant execute on function public.list_orphan_brand_photos(timestamptz) to service_role;
