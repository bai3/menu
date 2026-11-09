-- Run once on an existing email-auth database to retire dashboard access.
-- Fresh installations use the migrations without dashboard objects.
begin;
drop policy if exists accounts_dashboard_read on public.menu_accounts;
drop policy if exists beta_users_dashboard_read on public.menu_accounts;
drop policy if exists dishes_dashboard_read on public.dishes;
drop policy if exists meal_history_dashboard_read on public.meal_history;
revoke select on public.menu_accounts from anon, authenticated;

drop policy if exists meal_photos_read on storage.objects;
create policy meal_photos_read on storage.objects for select to anon, authenticated using (
 bucket_id = 'meal-photos' and (
  (storage.foldername(name))[1] = public.photo_owner_folder()
  or public.photo_can_read_shared(name)
 )
);

-- Remove policies before their helper functions; avoid cascading into user data.
drop function if exists public.photo_is_admin();
drop function if exists public.is_dashboard_admin();
drop table if exists public.dashboard_admins;
notify pgrst, 'reload schema';
commit;
