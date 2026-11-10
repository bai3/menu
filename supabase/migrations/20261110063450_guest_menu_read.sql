-- A user ID is a public read-only menu link. Only available dish fields and
-- referenced dish photos are exposed; account data and meal diaries stay private.
begin;
create or replace function menu_private.guest_menu_read(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select case when exists (select 1 from public.menu_accounts a where a.auth_user_id = p_user)
 then coalesce((select jsonb_agg(jsonb_build_object(
  'id', d.id, 'name', d.name, 'category', d.category, 'cuisine', d.cuisine,
  'note', d.note, 'image', d.image, 'spice_level', d.spice_level, 'is_available', d.is_available,
  'created_at', d.created_at, 'edited_at', to_jsonb(d)->>'edited_at', 'recommend_count', (
   select count(*) from public.meal_history h
   where h.owner_key = d.owner_key and exists (
    select 1 from jsonb_array_elements(h.dishes) item where item->>'id' = d.id
   )
  )
 ) order by d.created_at, d.id)
 from public.dishes d join public.menu_accounts a on a.owner_key = d.owner_key
 where a.auth_user_id = p_user and d.is_available), '[]'::jsonb)
 else null end
$$;
create or replace function menu_private.guest_photo_read(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.dishes d join public.menu_accounts a on a.owner_key = d.owner_key
  where a.auth_user_id::text = (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-guest-user')
   and d.is_available and d.image = 'storage://' || p_name
 )
$$;
revoke all on function menu_private.guest_menu_read(uuid), menu_private.guest_photo_read(text) from public, anon, authenticated;
grant usage on schema menu_private to anon, authenticated;
grant execute on function menu_private.guest_menu_read(uuid), menu_private.guest_photo_read(text) to anon, authenticated;
create or replace function public.guest_menu_read(p_user uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
 select menu_private.guest_menu_read(p_user)
$$;
revoke all on function public.guest_menu_read(uuid) from public, anon, authenticated;
grant execute on function public.guest_menu_read(uuid) to anon, authenticated;
create policy meal_photos_guest_menu_read on storage.objects for select to anon, authenticated
 using (bucket_id = 'meal-photos' and menu_private.guest_photo_read(name));
notify pgrst, 'reload schema';
commit;
