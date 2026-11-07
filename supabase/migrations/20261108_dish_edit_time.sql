-- Older rows have no recorded edit history; use their creation time as a baseline.
alter table public.dishes add column if not exists edited_at timestamptz;
update public.dishes set edited_at = coalesce(created_at, now()) where edited_at is null;
alter table public.dishes alter column edited_at set default now();
alter table public.dishes alter column edited_at set not null;

create or replace function public.set_dish_edit_time() returns trigger
language plpgsql set search_path = '' as $$
begin
 if (new.name, new.category, new.cuisine, new.note, new.image, new.spice_level, new.is_available)
    is distinct from
    (old.name, old.category, old.cuisine, old.note, old.image, old.spice_level, old.is_available) then
  new.edited_at := now();
 else
  new.edited_at := old.edited_at;
 end if;
 return new;
end $$;
drop trigger if exists dishes_set_edit_time on public.dishes;
create trigger dishes_set_edit_time before update on public.dishes
 for each row execute function public.set_dish_edit_time();
