# 家宴 · Supabase 云端菜谱同步 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 菜品数据从「设备本地 IndexedDB 独享」升级为「Supabase 云端共享」：行级增删改同步、实时推送、保留离线缓存。

**Architecture:** 纯静态 PWA（无构建、无框架）。supabase-js v2 UMD 构建 **vendored 到本地** `public/vendor/supabase.js`（保证 Service Worker 可预缓存、断网可用）。`app.js` 数据层：IndexedDB 仍是本地缓存层，Supabase 为共享数据源；启动时「渲染缓存 → 云端按 id 合并 → 订阅 realtime」；写操作本地立即生效 + 异步上行，失败仅 toast 不回滚。

**Tech Stack:** 原生 HTML/CSS/JS、supabase-js v2（UMD，本地 vendored）、IndexedDB、Service Worker 预缓存。

**Spec:** `docs/superpowers/specs/2026-11-05-supabase-dish-sync-design.md`（执行者需同时阅读）

## Global Constraints

- 纯静态项目：**不引入**构建工具、npm 依赖清单、框架；第三方库只能以 vendored UMD 文件形式放本地
- Supabase 密钥只允许 publishable key（`sb_publishable_…`，设计上公开）；**严禁**使用 service_role key
- 密钥写在 `config.js`：`window.JIAYAN_SUPABASE = { url: 'https://auqahcdgyrslespixjbu.supabase.co', publishableKey: 'sb_publishable_MZqapxotNDAwFRZ8DXWNxA_YskcezKj' }`
- 图片保持 base64 data URL 存 `image` text 列，**不**迁移 Supabase Storage
- 界面文案中文；代码注释跟随现有风格（中文、简短、解释「为什么」）
- 保持 `app.js` 现有架构：innerHTML 模板 + `bind()`，单文件，不重构无关代码
- `sw.js` 预缓存清单必须包含所有新增同源文件；任何静态资源变更后 `VERSION` 必须 +1（本计划最终为 `'v2'`）
- 项目无测试设施：每个任务的「测试」= 下方给出的精确 curl / 浏览器验证步骤，不允许用「应该能行」替代实际运行
- 本地验证统一用 `python3 -m http.server 4173`（在项目根目录），浏览器验证用 Playwright MCP 打开 `http://localhost:4173`
- **本目录不是 git 仓库**：Task 1 先 `git init`，此后每个任务结束都要 commit

---

### Task 1: git 初始化与基线提交

**Files:**
- Create: `.gitignore`（仅忽略系统/编辑器文件，代码全部入库）

**Interfaces:**
- Consumes: 无
- Produces: 一个 git 仓库，后续所有任务在其上提交；基线 commit 含改造前的 `app.js`/`index.html`/`sw.js` 等全部文件

- [ ] **Step 1: 初始化仓库**

```bash
cd /Users/bai/Code/bai/menu
git init
printf '.DS_Store\n*.log\n' > .gitignore
git add -A
git commit -m "chore: 基线提交（Supabase 同步改造前）"
```

- [ ] **Step 2: 验证**

Run: `git log --oneline` 
Expected: 一条 `chore: 基线提交…` 记录；`git status` 干净

---

### Task 2: Supabase 建表（用户执行 SQL）+ 连通验证

**Files:** 无代码文件改动。产出物是云端 `public.dishes` 表。

**Interfaces:**
- Consumes: Supabase 项目 `https://auqahcdgyrslespixjbu.supabase.co`，publishable key（见 Global Constraints）
- Produces: 存在且 RLS 全开放、realtime 已启用的 `public.dishes` 表；后续任务的 curl 验证全部依赖它

- [ ] **Step 1: 检查表是否已存在**

```bash
curl -s -w "\nHTTP %{http_code}\n" "https://auqahcdgyrslespixjbu.supabase.co/rest/v1/dishes?select=id&limit=1" \
  -H "apikey: sb_publishable_MZqapxotNDAwFRZ8DXWNxA_YskcezKj" \
  -H "Authorization: Bearer sb_publishable_MZqapxotNDAwFRZ8DXWNxA_YskcezKj" --max-time 15
```

Expected: `HTTP 200` + `[]`（已建表，跳过 Step 2）或 `404 PGRST205`（未建表，继续）

- [ ] **Step 2: 把下面 SQL 交给用户，在 Supabase Dashboard → SQL Editor 执行，等待确认**

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

注：若最后一句报 publication 不存在，先执行 `create publication supabase_realtime;` 再重试该句。

- [ ] **Step 3: 重新执行 Step 1 的 curl**

Expected: `HTTP 200` + `[]`

---

### Task 3: vendored supabase-js + config.js + index.html 引入

**Files:**
- Create: `public/vendor/supabase.js`（UMD 构建，锁定版本）
- Create: `config.js`
- Modify: `index.html`（`<script src="./app.js">` 之前加两行）

**Interfaces:**
- Consumes: Task 2 的表（运行时才用，本任务只需库加载成功）
- Produces: 全局 `window.supabase.createClient` 与 `window.JIAYAN_SUPABASE`；Task 4-6 的数据层代码依赖这两个全局量

- [ ] **Step 1: 查询最新 v2 精确版本号**

```bash
curl -s https://registry.npmjs.org/@supabase/supabase-js/latest | grep -o '"version":"[^"]*"' | head -1
```

记下输出（形如 `"version":"2.xx.x"`），后续步骤用 `2.xx.x` 指代。

- [ ] **Step 2: 下载 UMD 构建到本地并校验**

```bash
mkdir -p public/vendor
curl -sL -o public/vendor/supabase.js "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.xx.x/dist/umd/supabase.js"
ls -la public/vendor/supabase.js
grep -c "createClient" public/vendor/supabase.js
```

Expected: 文件 ≥ 150KB；`createClient` 出现次数 ≥ 1。文件头部用注释写明来源与版本，例如在文件开头插入：
`// vendored from https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.xx.x/dist/umd/supabase.js`
（用 `printf '// vendored from ...\n' | cat - public/vendor/supabase.js > tmp && mv tmp public/vendor/supabase.js` 前置）

- [ ] **Step 3: 创建 `config.js`**

```js
// Supabase 连接配置。publishable key 设计上就是公开密钥，可随前端分发。
window.JIAYAN_SUPABASE = {
  url: 'https://auqahcdgyrslespixjbu.supabase.co',
  publishableKey: 'sb_publishable_MZqapxotNDAwFRZ8DXWNxA_YskcezKj'
};
```

- [ ] **Step 4: 修改 `index.html`（在 `<script src="./app.js"></script>` 之前插入）**

```html
  <script src="./config.js"></script>
  <script src="./public/vendor/supabase.js"></script>
```

- [ ] **Step 5: 浏览器验证**

```bash
python3 -m http.server 4173
```

Playwright MCP → `http://localhost:4173` → 执行 JS `() => ({ sb: typeof window.supabase?.createClient, cfg: !!window.JIAYAN_SUPABASE?.url })` 
Expected: `{ sb: "function", cfg: true }`；console 无新增报错（页面当前功能不受影响）

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: 本地引入 supabase-js UMD 与连接配置"
```

---

### Task 4: 数据层写操作（本地即时 + 云端上行）

**Files:**
- Modify: `app.js`（约 59-63 行 `persistDishes` 区域、208 行删除调用点、211 行表单提交调用点）

**Interfaces:**
- Consumes: Task 3 的 `window.supabase` / `window.JIAYAN_SUPABASE`；现有 `idbSet`、`isValidDish`、`notify`
- Produces: `saveLocalDishes(next)`（本地立即生效，返回 void）、`cloudUpsertDish(dish)`、`cloudDeleteDish(id)`（均为 async、失败仅 toast）。Task 5/6 复用这三个函数；`persistDishes` 从代码中消失

- [ ] **Step 1: 替换 `persistDishes`（app.js:59-63）为下面的代码块**

```js
function saveLocalDishes(next) {
 dishes = next;
 idbSet('dishes', next).catch(() => notify('保存失败，浏览器存储不可用'));
}
// —— 云同步（Supabase）：本地先行，云端失败只提示，不回滚 UI ——
const sb = (window.JIAYAN_SUPABASE && window.supabase) ? window.supabase.createClient(window.JIAYAN_SUPABASE.url, window.JIAYAN_SUPABASE.publishableKey) : null;
const cloudFail = () => notify('已存本机，联网后同步到云端');
async function cloudUpsertDish(d) {
 if (!sb) return;
 const { error } = await sb.from('dishes').upsert({ id: d.id, name: d.name, category: d.category, note: d.note, image: d.image });
 if (error) cloudFail();
}
async function cloudDeleteDish(id) {
 if (!sb) return;
 const { error } = await sb.from('dishes').delete().eq('id', id);
 if (error) cloudFail();
}
```

（注：若图片特别大导致上行 413，把 `app.js:210` 的压缩参数 `.82` 降到 `.7`、800 降到 640，属已知调参点，不另设任务。）

- [ ] **Step 2: 改删除调用点（app.js:208）**

把 `if(persistDishes(dishes.filter(d=>d.id!==dish.id))){...}` 整句替换为：

```js
saveLocalDishes(dishes.filter(d=>d.id!==dish.id));cloudDeleteDish(dish.id);state.selected=state.selected.filter(id=>id!==dish.id);render();notify('菜品已删除');
```

- [ ] **Step 3: 改表单提交调用点（app.js:211）**

把 `if(persistDishes(next)){state.editingId=null;state.draftImage=null;state.page='manage';render();notify(existing?'菜品已更新':'菜品已添加')}` 替换为：

```js
saveLocalDishes(next);cloudUpsertDish(dish);state.editingId=null;state.draftImage=null;state.page='manage';render();notify(existing?'菜品已更新':'菜品已添加');
```

- [ ] **Step 4: 浏览器验证（写上行）**

保持 `python3 -m http.server 4173`，Playwright 打开 `http://localhost:4173`：
1. 「编辑菜单」→「添加菜品」→ 名称填 `云同步测试菜` → 保存
2. UI 出现「菜品已添加」且列表有该菜
3. curl 验证上行成功：

```bash
curl -s "https://auqahcdgyrslespixjbu.supabase.co/rest/v1/dishes?name=eq.云同步测试菜&select=id,name" \
  -H "apikey: sb_publishable_MZqapxotNDAwFRZ8DXWNxA_YskcezKj" \
  -H "Authorization: Bearer sb_publishable_MZqapxotNDAwFRZ8DXWNxA_YskcezKj"
```

Expected: 返回包含 `云同步测试菜` 的一行
4. 在管理页删除「云同步测试菜」→ UI 提示已删除；重跑上面 curl 
Expected: `[]`（删除已上行）

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: 菜品增删改同步到 Supabase"
```

---

### Task 5: 启动同步 syncFromCloud（种子 + 按 id 合并）

**Files:**
- Modify: `app.js`（新增 `syncFromCloud`；改写 `initDishes` 尾部，app.js:39-57）

**Interfaces:**
- Consumes: Task 4 的 `saveLocalDishes`/`cloudFail`/`sb`；现有 `isValidDish`、`idbGet`、`dishes`、`state`、`render`
- Produces: `syncFromCloud()`（async）。Task 7 的验收依赖其种子与合并语义

- [ ] **Step 1: 在 `cloudDeleteDish` 之后新增函数**

```js
// 启动同步：云端为准合并本机。空表时把本机菜全部上云（种子）；
// 同 id 云端优先（LWW）；只在本机存在的菜自动补传（保住离线期间的增改）。
async function syncFromCloud() {
 if (!sb) return;
 let rows;
 try {
  const { data, error } = await sb.from('dishes').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  rows = data;
 } catch (_) { notify('云端暂不可达，当前显示本机菜谱'); return; }
 const toDish = (r) => ({ id: r.id, name: r.name, category: r.category, note: r.note, image: r.image });
 const cloudDishes = rows.map(toDish).filter(isValidDish);
 const cloudIds = new Set(cloudDishes.map(d => d.id));
 const localOnly = dishes.filter(d => !cloudIds.has(d.id));
 if (!cloudDishes.length && localOnly.length) {
  const { error } = await sb.from('dishes').upsert(localOnly);
  if (error) cloudFail();
  return; // 本机数据已是权威，无需合并
 }
 if (localOnly.length) {
  const { error } = await sb.from('dishes').upsert(localOnly);
  if (error) cloudFail();
 }
 saveLocalDishes([...cloudDishes, ...localOnly]);
 if (state.page === 'dishes' || state.page === 'manage') render();
}
```

- [ ] **Step 2: 改 `initDishes`（app.js:39-57）**

在读取 IndexedDB 缓存的 `try/catch` 块之后、`navigator.storage.persist` 之前插入一行：

```js
 await syncFromCloud();
```

- [ ] **Step 3: 浏览器验证（种子与合并）**

1. Playwright 打开 `http://localhost:4173`（本地 IndexedDB 已有 6 道默认菜），等待 2 秒后 curl：

```bash
curl -s "https://auqahcdgyrslespixjbu.supabase.co/rest/v1/dishes?select=id,name&order=created_at.asc" \
  -H "apikey: sb_publishable_MZqapxotNDAwFRZ8DXWNxA_YskcezKj" \
  -H "Authorization: Bearer sb_publishable_MZqapxotNDAwFRZ8DXWNxA_YskcezKj"
```

Expected: 6 行默认菜已上云
2. 用 curl 在云端插入一条「云端新菜」（模拟其他设备写入）：

```bash
curl -s -X POST "https://auqahcdgyrslespixjbu.supabase.co/rest/v1/dishes" \
  -H "apikey: sb_publishable_MZqapxotNDAwFRZ8DXWNxA_YskcezKj" \
  -H "Authorization: Bearer sb_publishable_MZqapxotNDAwFRZ8DXWNxA_YskcezKj" \
  -H "Content-Type: application/json" \
  -d '{"id":"cloud-test","name":"云端新菜","category":"家常菜","note":"来自云端","image":"tomato.jpg"}'
```

刷新页面 → UI 菜单出现「云端新菜」（7 道菜）
3. 清掉测试数据：管理页删除「云端新菜」，重跑查询 Expected 少一行

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: 启动时云端种子与按 id 合并"
```

---

### Task 6: 实时订阅（多设备即时可见）

**Files:**
- Modify: `app.js`（新增 `subscribeRealtime`；`initDishes` 中 `await syncFromCloud();` 之后调用）

**Interfaces:**
- Consumes: Task 4/5 的 `saveLocalDishes`、`isValidDish`；Task 2 的 realtime publication
- Produces: `subscribeRealtime()`（void）。验收：两标签页实时互通

- [ ] **Step 1: 在 `syncFromCloud` 之后新增函数**

```js
// 实时订阅：家人增删改菜，本机即时生效。自己写入的回声与本地一致时跳过，避免无谓重渲染。
function subscribeRealtime() {
 if (!sb) return;
 sb.channel('jiayan-dishes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'dishes' }, (payload) => {
   if (payload.event === 'DELETE') {
    const id = payload.old?.id;
    if (!id || !dishes.some(d => d.id === id)) return; // 自己删除的回声
    saveLocalDishes(dishes.filter(d => d.id !== id));
   } else {
    const d = { id: payload.new.id, name: payload.new.name, category: payload.new.category, note: payload.new.note, image: payload.new.image };
    if (!isValidDish(d)) return;
    const old = dishes.find(x => x.id === d.id);
    if (old && old.name === d.name && old.category === d.category && old.note === d.note && old.image === d.image) return; // 回声
    saveLocalDishes(old ? dishes.map(x => x.id === d.id ? d : x) : [...dishes, d]);
   }
   render();
  })
  .subscribe();
}
```

- [ ] **Step 2: 在 `initDishes` 里 `await syncFromCloud();` 之后加一行**

```js
 subscribeRealtime();
```

- [ ] **Step 3: 浏览器验证（双标签实时）**

1. Playwright 开两个标签页都指向 `http://localhost:4173`，各等 2 秒（订阅建立）
2. 标签页 A：添加菜品 `实时测试菜`（保存后在管理页）
3. 标签页 B 不做任何操作，等 2 秒后截图/快照 
Expected: B 的菜品列表出现 `实时测试菜`（无需刷新）
4. 标签页 B：删除 `实时测试菜` → A 的列表 2 秒内少一行
5. curl 确认云端无残留：`select` 查询 Expected `[]` 中不含该菜

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: 订阅 Supabase realtime，菜谱多设备实时同步"
```

---

### Task 7: Service Worker v2 + 离线可用

**Files:**
- Modify: `sw.js`（`VERSION`、`ASSETS`）

**Interfaces:**
- Consumes: Task 3 新增的 `./config.js`、`./public/vendor/supabase.js`
- Produces: 缓存 `jiayan-v2`，断网时应用（含 supabase-js）完整可用

- [ ] **Step 1: 修改 `sw.js`**

`sw.js:3` `const VERSION = 'v1';` → `const VERSION = 'v2';`
`ASSETS` 数组在 `'./manifest.json',` 之后插入两项：

```js
  './config.js',
  './public/vendor/supabase.js',
```

- [ ] **Step 2: 浏览器验证（缓存与离线）**

1. Playwright 打开 `http://localhost:4173`，等 3 秒（sw 安装完成），评估 JS `() => caches.keys()` 
Expected: 包含 `jiayan-v2`（旧的 `jiayan-v1` 消失）
2. DevTools/Playwright 设离线（`browser_emulate_media` 不行，用 `browser_run_code_unsafe`：`async (page) => { await page.context().setOffline(true); }`），刷新页面 
Expected: 页面正常渲染、菜品列表完整（走 SW 预缓存 + IndexedDB 缓存）
3. 离线状态下添加菜品 `离线测试菜` → UI 正常、toast「已存本机，联网后同步到云端」
4. 恢复联网（`setOffline(false)`），刷新页面 
Expected: `离线测试菜` 仍在（合并把本地独有的菜补传云端）；curl 查询含该菜；删除它清理测试数据

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: SW 预缓存 supabase-js 与配置，版本升至 v2"
```

---

### Task 8: 全量验收（对照 spec 验证计划）

**Files:** 无改动；只跑验证。

**Interfaces:**
- Consumes: 前面全部任务成果
- Produces: 验收结论（通过/问题清单）

- [ ] **Step 1: 逐项执行 spec「验证计划」**

1. `curl` dishes 表 → 200（Task 2 已验）
2. 首启动种子上传 → Task 5 已验；如需复验：清空云端表（SQL Editor `delete from dishes;`）后刷新页面，curl 应见默认菜回归
3. 增/改/删与云端一致 → Task 4 已验
4. 双端实时 → Task 6 已验
5. 断网可用 + 恢复后补同步 → Task 7 已验
6. `jiayan-v2` 缓存生效 → Task 7 已验

- [ ] **Step 2: 清理测试数据**

Supabase Table Editor（或 SQL `delete from dishes where id like 'dish-%' or name like '%测试%' or id='cloud-test';`）删除所有测试菜；UI 刷新后与真实菜谱一致。

- [ ] **Step 3: 最终提交（如有清理脚本/文档变更）**

```bash
git add -A && git commit -m "chore: Supabase 云同步验收完成" --allow-empty
```

向用户报告：手机连接同一 Wi-Fi 或直接用流量打开局域网地址（`python3 -m http.server 4173` 仅本机可用，真机联调需部署或端口转发，正式体验按 spec 后续发布到 EdgeOne Pages）。
