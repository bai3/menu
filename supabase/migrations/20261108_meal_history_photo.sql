-- Keep a compressed photo in the same user-scoped row as its meal snapshot.
alter table public.meal_history add column if not exists photo text;
