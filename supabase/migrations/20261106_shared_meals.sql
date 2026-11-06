-- Shared meals are accessed only through the narrowly scoped functions below.
begin;
create table public.shared_meals (
 id uuid primary key default gen_random_uuid(), owner_code text not null references public.beta_users(code),
 invite_token text not null unique, title text not null, status text not null default 'open' check (status in ('open','completed')),
 catalog jsonb not null, created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '1 hour', completed_at timestamptz
);
create table public.shared_meal_people (
 id uuid primary key default gen_random_uuid(), meal_id uuid not null references public.shared_meals(id) on delete cascade,
 token text not null unique, name text not null, created_at timestamptz not null default now()
);
create table public.shared_meal_choices (
 meal_id uuid not null references public.shared_meals(id) on delete cascade,
 person_id uuid not null references public.shared_meal_people(id) on delete cascade,
 dish_id text not null, created_at timestamptz not null default now(), primary key(meal_id,person_id,dish_id)
);
alter table public.shared_meals enable row level security;
alter table public.shared_meal_people enable row level security;
alter table public.shared_meal_choices enable row level security;
revoke all on public.shared_meals, public.shared_meal_people, public.shared_meal_choices from anon, authenticated;

create function public.shared_meal_create(p_title text, p_name text, p_invite text, p_person text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare owner text; meal uuid; catalogue jsonb;
begin
 owner := public.current_beta_code();
 if owner is null or p_invite !~ '^[a-f0-9]{64}$' or p_person !~ '^[a-f0-9]{64}$' or length(trim(p_name)) not between 1 and 12 or length(trim(p_title)) not between 1 and 16 then raise exception 'Invalid request'; end if;
 select coalesce(jsonb_agg(to_jsonb(d) - 'user_code' order by d.created_at, d.id), '[]'::jsonb) into catalogue from public.dishes d where d.user_code = owner and d.is_available;
 insert into public.shared_meals(owner_code,invite_token,title,catalog) values(owner,p_invite,trim(p_title),catalogue) returning id into meal;
 insert into public.shared_meal_people(meal_id,token,name) values(meal,p_person,trim(p_name));
 return meal;
end $$;
create function public.shared_meal_join(p_invite text, p_person text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare meal public.shared_meals;
begin
 select * into meal from public.shared_meals where invite_token=p_invite for update;
 if meal.id is null or meal.status <> 'open' or meal.expires_at <= now() or p_person !~ '^[a-f0-9]{64}$' or length(trim(p_name)) not between 1 and 12 then raise exception 'Invitation unavailable'; end if;
 insert into public.shared_meal_people(meal_id,token,name) values(meal.id,p_person,trim(p_name)) on conflict (token) do nothing;
 if not exists(select 1 from public.shared_meal_people where meal_id=meal.id and token=p_person) then raise exception 'Invalid participant'; end if;
 return meal.id;
end $$;
create function public.shared_meal_read(p_invite text, p_person text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare meal public.shared_meals; person uuid; result jsonb;
begin
 select * into meal from public.shared_meals where invite_token=p_invite;
 if meal.id is null then raise exception 'Invitation unavailable'; end if;
 select id into person from public.shared_meal_people where meal_id=meal.id and token=p_person;
 if person is null and meal.expires_at <= now() then raise exception 'Invitation unavailable'; end if;
 if person is null then return jsonb_build_object('title',meal.title,'status',meal.status,'joined',false); end if;
 select jsonb_build_object('title',meal.title,'status',meal.status,'joined',true,'is_owner',meal.owner_code=public.current_beta_code(),
 'catalog',meal.catalog,'person_id',person,'people',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by created_at),'[]'::jsonb) from public.shared_meal_people where meal_id=meal.id),
 'choices',(select coalesce(jsonb_agg(jsonb_build_object('person_id',person_id,'dish_id',dish_id) order by created_at),'[]'::jsonb) from public.shared_meal_choices where meal_id=meal.id)) into result;
 return result;
end $$;
create function public.shared_meal_choose(p_invite text,p_person text,p_dish text,p_selected boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare meal public.shared_meals; person uuid;
begin
 select * into meal from public.shared_meals where invite_token=p_invite for update;
 select id into person from public.shared_meal_people where meal_id=meal.id and token=p_person;
 if meal.id is null or person is null or meal.status <> 'open' or not exists(select 1 from jsonb_array_elements(meal.catalog) d where d->>'id'=p_dish) then raise exception 'Selection unavailable'; end if;
 if p_selected then insert into public.shared_meal_choices values(meal.id,person,p_dish,now()) on conflict do nothing;
 else delete from public.shared_meal_choices where meal_id=meal.id and person_id=person and dish_id=p_dish; end if;
end $$;
create function public.shared_meal_complete(p_invite text) returns void
language plpgsql security definer set search_path = '' as $$
declare meal public.shared_meals;
begin
 select * into meal from public.shared_meals where invite_token=p_invite for update;
 if meal.id is null or meal.owner_code is distinct from public.current_beta_code() or meal.status <> 'open' or not exists(select 1 from public.shared_meal_choices where meal_id=meal.id) then raise exception 'Cannot complete meal'; end if;
 update public.shared_meals set status='completed',completed_at=now() where id=meal.id;
end $$;
revoke all on function public.shared_meal_create(text,text,text,text), public.shared_meal_join(text,text,text), public.shared_meal_read(text,text), public.shared_meal_choose(text,text,text,boolean), public.shared_meal_complete(text) from public;
grant execute on function public.shared_meal_create(text,text,text,text), public.shared_meal_join(text,text,text), public.shared_meal_read(text,text), public.shared_meal_choose(text,text,text,boolean), public.shared_meal_complete(text) to anon, authenticated;
commit;
