-- Apply before deploying the Storage-enabled client. Existing text fields remain compatible.
begin;
create extension if not exists pgcrypto with schema extensions;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Object paths contain a hash, never the beta code itself: shared catalogues include paths.
create or replace function public.photo_owner_folder() returns text
language sql stable security definer set search_path = '' as $$
 select encode(extensions.digest(public.current_beta_code(), 'sha256'), 'hex')
$$;
create or replace function public.photo_can_read_shared(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.shared_meals m
  join public.shared_meal_people p on p.meal_id = m.id
  where m.invite_token = (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-meal-invite')
   and p.token = (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-meal-person')
   and exists (select 1 from jsonb_array_elements(m.catalog) d where d->>'image' = 'storage://' || object_name)
 )
$$;
create or replace function public.photo_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.dashboard_admins where user_id = (select auth.uid()))
$$;
revoke all on function public.photo_owner_folder(), public.photo_can_read_shared(text), public.photo_is_admin() from public;
grant execute on function public.photo_owner_folder(), public.photo_can_read_shared(text), public.photo_is_admin() to anon, authenticated;

drop policy if exists meal_photos_read on storage.objects;
create policy meal_photos_read on storage.objects for select to anon, authenticated using (
 bucket_id = 'meal-photos' and (
  (storage.foldername(name))[1] = public.photo_owner_folder()
  or public.photo_can_read_shared(name) or public.photo_is_admin()
 )
);
drop policy if exists meal_photos_insert on storage.objects;
create policy meal_photos_insert on storage.objects for insert to anon, authenticated with check (
 bucket_id = 'meal-photos' and (storage.foldername(name))[1] = public.photo_owner_folder()
 and (storage.foldername(name))[2] in ('dishes', 'diary')
 and name ~ '^[a-f0-9]{64}/(dishes|diary)/[a-f0-9-]+\.jpg$'
);
-- Compare the original value so a concurrent photo change is never overwritten.
create or replace function public.migrate_photo_reference(p_kind text, p_id text, p_old text, p_path text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare changed integer; owner text := public.current_beta_code();
begin
 if owner is null or p_old not like 'data:image/%;base64,%' or
    p_path not like 'storage://' || public.photo_owner_folder() || '/' || p_kind || '/%' or
    p_kind not in ('dishes','diary') or not exists (
     select 1 from storage.objects where bucket_id='meal-photos' and name=substr(p_path, 11)
    ) then raise exception 'Invalid migration request'; end if;
 if p_kind = 'dishes' then
  update public.dishes set image=p_path where user_code=owner and id=p_id and image=p_old;
 else
  update public.meal_history set photo=p_path where user_code=owner and id=p_id and photo=p_old;
 end if;
 get diagnostics changed = row_count;
 return changed = 1;
end $$;
revoke all on function public.migrate_photo_reference(text,text,text,text) from public;
grant execute on function public.migrate_photo_reference(text,text,text,text) to anon, authenticated;
commit;
