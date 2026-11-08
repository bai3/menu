-- A beta code, not the public Supabase key, authenticates each request.
create table if not exists public.shopping_ai_usage (
 user_code text not null references public.beta_users(code) on delete cascade,
 usage_day date not null,
 requests integer not null default 0,
 primary key (user_code, usage_day)
);
alter table public.shopping_ai_usage enable row level security;
revoke all on public.shopping_ai_usage from public, anon, authenticated;

create or replace function public.reserve_shopping_request() returns text
language plpgsql security definer set search_path = '' as $$
declare owner text := public.current_beta_code(); used integer;
begin
 if owner is null then return 'unauthorized'; end if;
 insert into public.shopping_ai_usage as usage(user_code,usage_day,requests)
 values(owner,(now() at time zone 'Asia/Shanghai')::date,1)
 on conflict(user_code,usage_day) do update
 set requests=usage.requests+1
 where usage.requests < 30
 returning requests into used;
 if used is null then return 'limit'; end if;
 return 'ok';
end $$;
revoke all on function public.reserve_shopping_request() from public;
grant execute on function public.reserve_shopping_request() to anon, authenticated;
