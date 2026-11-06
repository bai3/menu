-- Each saved meal is a snapshot; dish changes do not rewrite past meals.
create table if not exists public.meal_history (
  id text primary key,
  meal_date date not null,
  title text not null,
  note text not null default '',
  dishes jsonb not null check (jsonb_typeof(dishes) = 'array' and jsonb_array_length(dishes) > 0),
  created_at timestamptz not null default now()
);

create index if not exists meal_history_date_idx on public.meal_history (meal_date desc, created_at desc);
alter table public.meal_history enable row level security;
create policy "anyone can read meal history" on public.meal_history for select using (true);
create policy "anyone can insert meal history" on public.meal_history for insert with check (true);
