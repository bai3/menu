# 交接文档：Supabase 云端菜谱同步（Codex 接手）

日期：2026-11-05 · 分支：`feat/supabase-sync` · 原执行者：Claude Code（subagent-driven 流程），在 Task 6 中途按用户要求暂停交接。

## 必读文件（按顺序）

1. **Spec（需求权威）**：`docs/superpowers/specs/2026-11-05-supabase-dish-sync-design.md`
2. **实施计划（含每任务完整代码与验证步骤）**：`docs/superpowers/plans/2026-11-05-supabase-dish-sync.md`
3. **执行台账（每任务状态、审查结论、裁定）**：`.superpowers/sdd/2026-11-05-supabase-dish-sync/progress.md`（git-ignored，仅在磁盘）
4. 各任务实现者报告：同目录 `task-N-report.md`（含实测输出与踩坑记录）

## 连接信息（原样使用）

- Supabase URL：`https://auqahcdgyrslespixjbu.supabase.co`
- publishable key：`sb_publishable_MZqapxotNDAwFRZ8DXWNxA_YskcezKj`（公开密钥，已入 `config.js`；RLS 全开放免登录是既定决策）
- `dishes` 表已建好（含 `updated_at` 触发器 + realtime publication）
- 本地验证服务器已在 **4173 端口**运行（复用，勿另起）

## 已完成（全部经独立子代理审查通过）

| 任务 | 内容 | commits |
|---|---|---|
| T1 | git init + 基线 + 功能分支 | 47f451b |
| T2 | Supabase 建表（用户执行 SQL，controller 验证 200） | 无 |
| T3 | vendored supabase-js@2.119.0 + config.js + index.html | bb2c58d |
| T4 | 写操作上云（`saveLocalDishes`/`cloudUpsertDish`/`cloudDeleteDish` 替换 `persistDishes`；POST 201/DELETE 204 实测） | a558f46 |
| T5 | 启动同步 `syncFromCloud`（种子+按 id 合并+补传）+ 排序决胜键修复 | d2fa2a2, 85f6d1b |
| — | 用户实时编辑两次快照入库（品牌更名白家私厨、SW v10/v12） | 4ce0ee1, 4800c3a |

## 进行中：Task 6（实时订阅）——代码已写入但**未验证、未审查、未提交**

- 工作区 `app.js` 有 +21 行未提交改动：`subscribeRealtime()` 函数（105 行附近）+ `initDishes` 里的一行接线（56 行附近），内容为计划 Task 6 代码块原文（被中断的子代理写入，中断发生在双标签验证中段）
- **接手动作**：`git diff app.js` 核对与计划 Task 6 代码一致 → 清 SW 缓存后加载 → 按计划 Step 3 完成双标签实时验证（A 标签加菜 → B 标签 2 秒内出现；B 删菜 → A 消失）→ `git add app.js` 单文件提交（勿 `git add -A`）→ 提交信息 `feat: 订阅 Supabase realtime，菜谱多设备实时同步`

## 待做

- **Task 7（SW v13 + 离线）**：`sw.js` 的 `ASSETS` 增加 `'./config.js'` 与 `'./public/vendor/supabase.js'`；`VERSION` 改为**磁盘当前值 +1**（现 v12 → v13）。验证：`jiayan-v13` 缓存出现、DevTools 离线后页面完整可用、离线加菜出现 toast「已存本机，联网后同步到云端」（**此 toast 从未被运行时触发过，务必实际观察一次**）、恢复联网刷新后离线菜上云。执行前先把用户未提交改动快照成独立 commit。
- **Task 8（全量验收 + 清理）**：对照 spec「验证计划」6 条逐项复验；清理测试数据（含并发残留的 `dish-1793868992998-onxg8q`，可 UI 删或 SQL `delete`）；终审（whole-diff review，重点分诊台账里的 parked 项）。

## 踩坑与纪律（前车之鉴，务必遵守）

1. **用户可能同时在编辑项目**：任务提交只 `git add <本任务改的文件>`；发现无关未提交改动→快照成独立 commit（信息注明「用户实时编辑快照」），绝不混入任务提交
2. **SW 缓存优先**：改了 app.js/index.html 后刷新可能拿到旧缓存——验证前先反注册 SW + 清缓存（DevTools → Application → Service Workers）
3. **curl 中文查询参数必须百分号编码**（JSON 请求体不用）；全表查询用 `?select=id,name&order=created_at.asc,id.asc`
4. **排序必须带决胜键**：`order=created_at.asc` 平局会洗牌（已修复为 + `id.asc`，勿回退）
5. 每个 Task 完成后 commit；计划文件里每个任务都有完整代码与验证步骤，照着执行即可

## 遗留小项（终审时分诊，非阻塞）

- 添加→删除的云端竞态可残留幽灵菜（spec 非目标已推迟墓碑机制）
- `sb` 初始化未包 try/catch（config.js 为静态合法值，风险≈0）
- `dishImage` 重复定义（基线预存）；favicon 404（基线预存）
- 离线启动时 `await syncFromCloud()` 使 `storage.persist()` 顺延约 7 秒（可改不 await）
