-- Existing dishes remain available and non-spicy.
alter table public.dishes
  add column if not exists spice_level smallint not null default 0 check (spice_level between 0 and 3),
  add column if not exists is_available boolean not null default true;
