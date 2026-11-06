-- Dashboard access is opt-in: add an existing auth.users id to dashboard_admins
-- using the SQL editor after creating the administrator in Supabase Auth.
begin;
create table if not exists public.dashboard_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.dashboard_admins enable row level security;
revoke all on public.dashboard_admins from anon, authenticated;

create or replace function public.is_dashboard_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.dashboard_admins where user_id = (select auth.uid()))
$$;
revoke all on function public.is_dashboard_admin() from public;
grant execute on function public.is_dashboard_admin() to authenticated;

grant select on public.beta_users to authenticated;
drop policy if exists beta_users_dashboard_read on public.beta_users;
create policy beta_users_dashboard_read on public.beta_users for select to authenticated using (public.is_dashboard_admin());
drop policy if exists dishes_dashboard_read on public.dishes;
create policy dishes_dashboard_read on public.dishes for select to authenticated using (public.is_dashboard_admin());
drop policy if exists meal_history_dashboard_read on public.meal_history;
create policy meal_history_dashboard_read on public.meal_history for select to authenticated using (public.is_dashboard_admin());
commit;
