# 家宴 · Supabase 云端菜谱同步 — 设计文档

日期：2026-11-05

## 背景与目标

「家宴」是纯静态 PWA，菜品数据（一个数组 `{id, name, category, note, image}`）整体存于 IndexedDB，各设备数据互相独立。

目标：全家共享同一份菜谱——任何设备的增删改写入云端，并**实时**出现在其他设备上；同时保留现有离线体验（本地缓存优先，断网照常可用）。

已确认的决策：

- **免登录**：RLS 对匿名完全开放，安全性靠链接的私密性（数据只是菜谱）
- **同步策略**：本地缓存 + 云端同步 + 实时推送
- **同步粒度**：按菜（行级）操作，多设备并发改动互不覆盖
- **图片**：继续以 base64 文本存于 `image` 字段，不迁移 Supabase Storage

## 非目标（后置）

- 登录/账号体系（可后续升级为邮箱登录或匿名登录收紧 RLS）
- 图片迁移到 Storage（免费版 500MB，单图 ~100–200KB，家用规模多年够用）
- 离线删除的墓碑机制（见「已知限制」）
- 多家庭/多菜单隔离

## Supabase 侧

- 项目：`https://auqahcdgyrslespixjbu.supabase.co`
- 密钥：publishable key（`sb_publishable_…`，设计上就是公开密钥，写入客户端无安全风险）
- 已验证：REST 端点连通、密钥有效；`public.dishes` 表**尚不存在**

一次性建表 SQL（用户在 Dashboard → SQL Editor 粘贴执行）：

```sql
create table if not exists public.dishes (
  id text primary key,
  name text not null,
  category text not null,
  note text not null default '',
  image text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dishes enable row level security;

create policy "anyone can read dishes"   on public.dishes for select using (true);
create policy "anyone can insert dishes" on public.dishes for insert with check (true);
create policy "anyone can update dishes" on public.dishes for update using (true) with check (true);
create policy "anyone can delete dishes" on public.dishes for delete using (true);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger dishes_touch_updated_at before update on public.dishes
for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.dishes;
```

若最后一句报 publication 不存在（个别新项目默认未建），先执行 `create publication supabase_realtime;` 再重试。

## 客户端改动（4 个文件）

### 新增 `config.js`

```js
window.JIAYAN_SUPABASE = {
  url: 'https://auqahcdgyrslespixjbu.supabase.co',
  publishableKey: 'sb_publishable_MZqapxotNDAwFRZ8DXWNxA_YskcezKj' // 用户提供的 publishable key 原样写入
};
```

### 新增 `public/vendor/supabase.js`

把 supabase-js v2 的 UMD 构建下载到本地（实现时固定具体版本号），**不用 CDN**——Service Worker 只预缓存同源资源，本地化才能保证断网时应用完整可用。

### `index.html`

在 `app.js` 之前引入 `./config.js` 与 `./public/vendor/supabase.js`。

### `app.js` 数据层

- 保留 `idbGet`/`idbSet` 作为**本地缓存**（数据结构不变：`dishes` 数组）
- `createClient` 建客户端；新函数：
  - `syncFromCloud()`：启动同步（见下）
  - `cloudUpsert(dish)` / `cloudDelete(id)`：行级写操作
  - `subscribeRealtime()`：订阅 `postgres_changes`（`*` 事件，`dishes` 表）
- 启动顺序：渲染缓存（秒开）→ `syncFromCloud()` → `subscribeRealtime()`
- 调用点改造：现在经 `persistDishes(next)` 全量保存的两处（删除菜品、表单保存）改为按操作调用云端 upsert/delete；本地立即生效，云端失败仅 toast「已存本机，联网后同步」，不回滚 UI

**启动合并语义**：

1. 拉取失败 → 保留缓存照常用，toast 提示离线
2. 云端为空且本地非空 → 本地菜全部上云（种子，含 6 道默认菜）
3. 否则按 id 合并：同 id **云端优先**（LWW）；仅存在于本地的菜自动 upsert 上云（保住离线期间新增/编辑的菜）；合并结果写回 IndexedDB 并重渲染

**实时**：收到 INSERT/UPDATE → upsert 进本地并缓存；DELETE → 按 id 移除；收到变更后直接 `render()` 当前页面（render 幂等且开销小，无需判断是否涉及当前页；自己写入的回声无害）。

### `sw.js`

`ASSETS` 增加 `./config.js`、`./public/vendor/supabase.js`；`VERSION` 升为 `'v2'`（老客户端刷新后换用新缓存）。

## 错误处理

- 云端不可达：一切照常走缓存，UI 不阻塞、不回滚，toast 明示「已存本机」
- **已知限制**：离线期间的**删除**在恢复联网后会被云端同步回来（无墓碑记录）。家用场景可接受，后续如需精确离线删除再引入待同步操作队列
- 并发编辑同一条菜：后写入云端者胜（LWW），无字段级合并

## 验证计划（手工，真浏览器；仓库无测试设施，纯静态应用不设单元测试）

1. SQL 执行后 `curl` dishes 表 → 200 `[]`
2. 首次启动 → 本地默认菜种子上传，Supabase Dashboard Table Editor 可见
3. 添加 / 编辑 / 删除菜品 → REST 查询确认与本地一致
4. 开两个标签页（或手机+电脑）→ 一端改动实时出现在另一端
5. DevTools 断网：应用可用、能加菜；恢复联网刷新后本地新菜上云
6. 确认 sw v2 缓存生效（Application → Cache Storage 出现 `jiayan-v2`）
