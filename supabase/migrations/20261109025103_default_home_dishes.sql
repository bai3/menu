-- Initialize each verified account once; preserve existing dishes and user deletions.
begin;
alter table public.menu_accounts add column default_dishes_initialized_at timestamptz;

create function menu_private.seed_default_dishes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare verified_email text;
begin
 if new.auth_user_id is null or new.default_dishes_initialized_at is not null then return new; end if;
 select lower(email) into verified_email from auth.users
 where id=new.auth_user_id and email_confirmed_at is not null;
 if verified_email is null or verified_email in ('bzxdggy@gmail.com','bzxdggyx@gmail.com')
    or lower(coalesce(new.email,'')) in ('bzxdggy@gmail.com','bzxdggyx@gmail.com') then return new; end if;

 -- Claim initialization atomically. The trigger does not run on marker updates.
 update public.menu_accounts set default_dishes_initialized_at=now()
 where owner_key=new.owner_key and default_dishes_initialized_at is null;
 if not found then return new; end if;

 insert into public.dishes(id,owner_key,name,category,cuisine,note,image,spice_level,is_available)
 select 'default-v1:' || new.owner_key || ':' || seed.slug,new.owner_key,
 seed.name,seed.category,'未分类',seed.note,seed.image,seed.spice_level,true
 from (values
 ('tomato','番茄炒蛋','家常菜','酸甜开胃，家的味道','tomato.jpg',0),
 ('pork','红烧肉','家常菜','软糯入味，浓香下饭','pork.jpg',0),
 ('chicken','可乐鸡翅','家常菜','咸甜入味，大人孩子都喜欢','pork.jpg',0),
 ('pepper-pork','青椒肉丝','家常菜','青椒爽脆，肉丝鲜嫩','pork.jpg',1),
 ('greens','蒜蓉青菜','家常菜','清爽鲜嫩，蒜香扑鼻','cucumber.jpg',0),
 ('cucumber','凉拌黄瓜','清爽凉菜','清脆爽口，简单开胃','cucumber.jpg',0),
 ('fish','清蒸鱼','家常菜','鲜嫩清甜，保留原味','fish.jpg',0),
 ('shrimp','蒜蓉虾','家常菜','虾肉鲜甜，蒜香浓郁','shrimp.jpg',0),
 ('ribs-soup','冬瓜排骨汤','暖心汤羹','清润鲜美，暖暖一碗','soup.jpg',0),
 ('egg-soup','紫菜蛋花汤','暖心汤羹','紫菜鲜香，蛋花柔嫩','soup.jpg',0)
 ) as seed(slug,name,category,note,image,spice_level)
 where not exists(select 1 from public.dishes d where d.owner_key=new.owner_key and d.name=seed.name)
 on conflict(id) do nothing;
 return new;
end $$;
revoke all on function menu_private.seed_default_dishes() from public,anon,authenticated;
create trigger menu_account_default_dishes
 after insert or update of auth_user_id,email on public.menu_accounts
 for each row execute function menu_private.seed_default_dishes();

-- Fire the same initializer for existing verified users; excluded accounts are skipped.
update public.menu_accounts set email=email where auth_user_id is not null;
commit;
