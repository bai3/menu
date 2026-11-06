-- Run together with the beta-aware app release. Existing rows go to the first code.
begin;
create table if not exists public.beta_users (
  code text primary key,
  created_at timestamptz not null default now()
);
alter table public.beta_users enable row level security;
revoke all on public.beta_users from anon, authenticated;

do $$ begin
  if (select count(*) from public.beta_users) <> 10 then
    raise exception 'Expected exactly 10 beta users; assign legacy data explicitly';
  end if;
end $$;

alter table public.dishes add column if not exists user_code text references public.beta_users(code);
alter table public.meal_history add column if not exists user_code text references public.beta_users(code);
update public.dishes set user_code = (select code from public.beta_users order by created_at, code limit 1) where user_code is null;
update public.meal_history set user_code = (select code from public.beta_users order by created_at, code limit 1) where user_code is null;
alter table public.dishes alter column user_code set not null;
alter table public.meal_history alter column user_code set not null;
create index if not exists dishes_user_code_idx on public.dishes(user_code);
create index if not exists meal_history_user_code_idx on public.meal_history(user_code, meal_date desc, created_at desc);

create or replace function public.current_beta_code() returns text
language sql stable security definer set search_path = '' as $$
  select code from public.beta_users
  where code = (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-beta-code')
$$;
create or replace function public.validate_beta_code() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_beta_code() is not null
$$;
revoke all on function public.current_beta_code() from public;
revoke all on function public.validate_beta_code() from public;
grant execute on function public.current_beta_code() to anon, authenticated;
grant execute on function public.validate_beta_code() to anon, authenticated;

alter table public.dishes enable row level security;
alter table public.meal_history enable row level security;
do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('dishes', 'meal_history')
  loop execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename); end loop;
end $$;
create policy dishes_beta_access on public.dishes for all to anon, authenticated
  using (user_code = public.current_beta_code()) with check (user_code = public.current_beta_code());
create policy meal_history_beta_access on public.meal_history for all to anon, authenticated
  using (user_code = public.current_beta_code()) with check (user_code = public.current_beta_code());
commit;
