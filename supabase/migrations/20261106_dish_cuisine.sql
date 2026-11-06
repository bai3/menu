-- Preserve existing dishes without guessing their cuisine.
alter table public.dishes
  add column if not exists cuisine text not null default '未分类';
