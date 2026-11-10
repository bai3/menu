-- Shared, administrator-managed menu vocabulary. Existing dishes retain their text values.
create table public.dish_taxonomy (
 kind text not null check (kind in ('category', 'cuisine')),
 name text not null check (length(trim(name)) between 1 and 60),
 sort_order integer not null default 0,
 primary key (kind, name)
);
alter table public.dish_taxonomy enable row level security;
revoke all on public.dish_taxonomy from anon, authenticated;
grant select on public.dish_taxonomy to anon, authenticated;
create policy "Everyone can read dish vocabulary" on public.dish_taxonomy for select to anon, authenticated using (true);
insert into public.dish_taxonomy (kind, name, sort_order) values
 ('category','家常菜',10),('category','清爽凉菜',20),('category','暖心汤羹',30),('category','主食',40),('category','饮品',50),('category','甜点',60),('category','小吃',70),('category','火锅',80),('category','烧烤',90),('category','其他',100),
 ('cuisine','未分类',10),('cuisine','川菜',20),('cuisine','鲁菜',30),('cuisine','粤菜',40),('cuisine','苏菜',50),('cuisine','浙菜',60),('cuisine','闽菜',70),('cuisine','湘菜',80),('cuisine','徽菜',90),('cuisine','东北菜',100),('cuisine','西北菜',110),('cuisine','京菜',120),('cuisine','日料',130),('cuisine','韩料',140),('cuisine','泰餐',150),('cuisine','越南菜',160),('cuisine','印度菜',170),('cuisine','法餐',180),('cuisine','意餐',190),('cuisine','美式料理',200),('cuisine','其他',210);
