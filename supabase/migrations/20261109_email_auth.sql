-- Apply once before releasing the Auth client. Preserve all IDs and photo paths.
begin;
create schema if not exists menu_private;
revoke all on schema menu_private from public, anon, authenticated;
alter table public.beta_users rename to menu_accounts;
alter table public.menu_accounts rename column code to owner_key;
alter table public.menu_accounts add column auth_user_id uuid unique references auth.users(id) on delete set null;
alter table public.menu_accounts add column email text;
alter table public.dishes rename column user_code to owner_key;
alter table public.meal_history rename column user_code to owner_key;
alter table public.shared_meals rename column owner_code to owner_key;
alter table public.shopping_ai_usage rename column user_code to owner_key;

-- Only a verified email may claim legacy data; ignore client metadata and headers.
create function menu_private.attach_menu_account(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare account auth.users; legacy constant text := '46fdf7c7e9e845e38152faffd9490563';
begin
 select * into account from auth.users where id=p_user;
 if account.id is null or account.email_confirmed_at is null then return; end if;
 if exists(select 1 from public.menu_accounts where auth_user_id=p_user) then
  update public.menu_accounts set email=account.email where auth_user_id=p_user;
  return;
 end if;
 if lower(account.email)='bzxdggyx@gmail.com' then
  update public.menu_accounts set auth_user_id=p_user,email=account.email
   where owner_key=legacy and auth_user_id is null;
  if found then return; end if;
 end if;
 insert into public.menu_accounts(owner_key,auth_user_id,email) values(p_user::text,p_user,account.email);
end $$;
revoke all on function menu_private.attach_menu_account(uuid) from public, anon, authenticated;
create function menu_private.on_menu_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform menu_private.attach_menu_account(new.id); return new; end $$;
revoke all on function menu_private.on_menu_auth_user() from public, anon, authenticated;
create trigger menu_auth_user after insert or update of email_confirmed_at,email on auth.users
 for each row execute function menu_private.on_menu_auth_user();
do $$ declare u record; begin
 if not exists(select 1 from public.menu_accounts where owner_key='46fdf7c7e9e845e38152faffd9490563') then
  raise exception 'Legacy account missing; stop rather than silently lose ownership';
 end if;
 for u in select id from auth.users where email_confirmed_at is not null loop
  perform menu_private.attach_menu_account(u.id);
 end loop;
end $$;
create function public.current_owner_key() returns text
language sql stable security definer set search_path = '' as $$
 select owner_key from public.menu_accounts where auth_user_id=(select auth.uid())
$$;
revoke all on function public.current_owner_key() from public;
grant execute on function public.current_owner_key() to anon, authenticated;
revoke all on public.menu_accounts from anon, authenticated;
drop policy if exists dishes_beta_access on public.dishes;
drop policy if exists meal_history_beta_access on public.meal_history;
create policy dishes_account_access on public.dishes for all to authenticated
 using(owner_key=public.current_owner_key()) with check(owner_key=public.current_owner_key());
create policy history_account_access on public.meal_history for all to authenticated
 using(owner_key=public.current_owner_key()) with check(owner_key=public.current_owner_key());
alter table public.dishes alter column owner_key set default public.current_owner_key();
alter table public.meal_history alter column owner_key set default public.current_owner_key();
create or replace function public.shared_meal_create(p_title text, p_name text, p_invite text, p_person text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare owner text; meal uuid; catalogue jsonb;
begin
 owner := public.current_owner_key();
 if owner is null or p_invite !~ '^[a-f0-9]{64}$' or p_person !~ '^[a-f0-9]{64}$' or length(trim(p_name)) not between 1 and 12 or length(trim(p_title)) not between 1 and 16 then raise exception 'Invalid request'; end if;
 select coalesce(jsonb_agg(to_jsonb(d) - 'owner_key' order by d.created_at, d.id), '[]'::jsonb) into catalogue from public.dishes d where d.owner_key = owner and d.is_available;
 insert into public.shared_meals(owner_key,invite_token,title,catalog) values(owner,p_invite,trim(p_title),catalogue) returning id into meal;
 insert into public.shared_meal_people(meal_id,token,name) values(meal,p_person,trim(p_name));
 return meal;
end $$;
create or replace function public.shared_meal_join(p_invite text, p_person text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare meal public.shared_meals;
begin
 select * into meal from public.shared_meals where invite_token=p_invite for update;
 if meal.id is null or meal.status <> 'open' or meal.expires_at <= now() or p_person !~ '^[a-f0-9]{64}$' or length(trim(p_name)) not between 1 and 12 then raise exception 'Invitation unavailable'; end if;
 insert into public.shared_meal_people(meal_id,token,name) values(meal.id,p_person,trim(p_name)) on conflict (token) do nothing;
 if not exists(select 1 from public.shared_meal_people where meal_id=meal.id and token=p_person) then raise exception 'Invalid participant'; end if;
 return meal.id;
end $$;
create or replace function public.shared_meal_read(p_invite text, p_person text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare meal public.shared_meals; person uuid; result jsonb;
begin
 select * into meal from public.shared_meals where invite_token=p_invite;
 if meal.id is null then raise exception 'Invitation unavailable'; end if;
 select id into person from public.shared_meal_people where meal_id=meal.id and token=p_person;
 if person is null and meal.expires_at <= now() then raise exception 'Invitation unavailable'; end if;
 if person is null then return jsonb_build_object('title',meal.title,'status',meal.status,'joined',false); end if;
 select jsonb_build_object('title',meal.title,'status',meal.status,'joined',true,'is_owner',meal.owner_key=public.current_owner_key(),
 'catalog',meal.catalog,'person_id',person,'people',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by created_at),'[]'::jsonb) from public.shared_meal_people where meal_id=meal.id),
 'choices',(select coalesce(jsonb_agg(jsonb_build_object('person_id',person_id,'dish_id',dish_id) order by created_at),'[]'::jsonb) from public.shared_meal_choices where meal_id=meal.id)) into result;
 return result;
end $$;
create or replace function public.shared_meal_choose(p_invite text,p_person text,p_dish text,p_selected boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare meal public.shared_meals; person uuid;
begin
 select * into meal from public.shared_meals where invite_token=p_invite for update;
 select id into person from public.shared_meal_people where meal_id=meal.id and token=p_person;
 if meal.id is null or person is null or meal.status <> 'open' or not exists(select 1 from jsonb_array_elements(meal.catalog) d where d->>'id'=p_dish) then raise exception 'Selection unavailable'; end if;
 if p_selected then insert into public.shared_meal_choices values(meal.id,person,p_dish,now()) on conflict do nothing;
 else delete from public.shared_meal_choices where meal_id=meal.id and person_id=person and dish_id=p_dish; end if;
end $$;
create or replace function public.shared_meal_complete(p_invite text) returns void
language plpgsql security definer set search_path = '' as $$
declare meal public.shared_meals;
begin
 select * into meal from public.shared_meals where invite_token=p_invite for update;
 if meal.id is null or meal.owner_key is distinct from public.current_owner_key() or meal.status <> 'open' or not exists(select 1 from public.shared_meal_choices where meal_id=meal.id) then raise exception 'Cannot complete meal'; end if;
 update public.shared_meals set status='completed',completed_at=now() where id=meal.id;
end $$;
create or replace function public.reserve_shopping_request() returns text
language plpgsql security definer set search_path = '' as $$
declare owner text := public.current_owner_key(); used integer;
begin
 if owner is null then return 'unauthorized'; end if;
 insert into public.shopping_ai_usage as usage(owner_key,usage_day,requests)
 values(owner,(now() at time zone 'Asia/Shanghai')::date,1)
 on conflict(owner_key,usage_day) do update
 set requests=usage.requests+1
 where usage.requests < 30
 returning requests into used;
 if used is null then return 'limit'; end if;
 return 'ok';
end $$;
revoke all on function public.reserve_shopping_request() from public;
grant execute on function public.reserve_shopping_request() to anon, authenticated;
create or replace function public.photo_owner_folder() returns text
language sql stable security definer set search_path = '' as $$
 select encode(extensions.digest(public.current_owner_key(), 'sha256'), 'hex')
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
revoke all on function public.photo_owner_folder(), public.photo_can_read_shared(text) from public;
grant execute on function public.photo_owner_folder(), public.photo_can_read_shared(text) to anon, authenticated;

drop policy if exists meal_photos_read on storage.objects;
create policy meal_photos_read on storage.objects for select to anon, authenticated using (
 bucket_id = 'meal-photos' and (
  (storage.foldername(name))[1] = public.photo_owner_folder()
  or public.photo_can_read_shared(name)
 )
);
drop policy if exists meal_photos_insert on storage.objects;
create policy meal_photos_insert on storage.objects for insert to authenticated with check (
 bucket_id = 'meal-photos' and (storage.foldername(name))[1] = public.photo_owner_folder()
 and (storage.foldername(name))[2] in ('dishes', 'diary')
 and name ~ '^[a-f0-9]{64}/(dishes|diary)/[a-f0-9-]+\.jpg$'
);
-- Compare the original value so a concurrent photo change is never overwritten.
create or replace function public.migrate_photo_reference(p_kind text, p_id text, p_old text, p_path text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare changed integer; owner text := public.current_owner_key();
begin
 if owner is null or p_old not like 'data:image/%;base64,%' or
    p_path not like 'storage://' || public.photo_owner_folder() || '/' || p_kind || '/%' or
    p_kind not in ('dishes','diary') or not exists (
     select 1 from storage.objects where bucket_id='meal-photos' and name=substr(p_path, 11)
    ) then raise exception 'Invalid migration request'; end if;
 if p_kind = 'dishes' then
  update public.dishes set image=p_path where owner_key=owner and id=p_id and image=p_old;
 else
  update public.meal_history set photo=p_path where owner_key=owner and id=p_id and photo=p_old;
 end if;
 get diagnostics changed = row_count;
 return changed = 1;
end $$;
revoke all on function public.migrate_photo_reference(text,text,text,text) from public;
grant execute on function public.migrate_photo_reference(text,text,text,text) to anon, authenticated;

revoke execute on function public.shared_meal_create(text,text,text,text), public.shared_meal_complete(text), public.reserve_shopping_request(), public.migrate_photo_reference(text,text,text,text) from public, anon;
grant execute on function public.shared_meal_create(text,text,text,text), public.shared_meal_complete(text), public.reserve_shopping_request(), public.migrate_photo_reference(text,text,text,text) to authenticated;
alter function public.touch_updated_at() set search_path = '';
notify pgrst, 'reload schema';
drop function public.validate_beta_code();
drop function public.current_beta_code();
commit;
