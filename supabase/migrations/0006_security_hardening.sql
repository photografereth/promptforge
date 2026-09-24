-- Ajustes apontados pelo Security Advisor do Supabase.

-- Função de trigger (auth.users → profiles): não deve ser chamável via /rest/v1/rpc.
-- O trigger continua disparando — EXECUTE só é checado ao criar o trigger.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Corpo só lança exceção, não referencia nenhum objeto.
alter function public.billing_events_immutable() set search_path = '';
