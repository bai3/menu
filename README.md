# 家宴

一个无需构建工具的静态 PWA。使用本地 HTTP 服务运行，例如：

```sh
python3 -m http.server 8000
```

然后访问 `http://localhost:8000/`。管理后台入口为 `/admin/`。

## 代码结构

- `index.html`：页面外壳和脚本加载顺序。
- `style.css`：点菜应用样式。
- `config.js`：Supabase 连接配置。
- `shared-meal.js`：邀请家人共同点菜的流程。
- `src/data.js`：菜品数据、浏览器缓存和云端同步。
- `src/views.js`：页面状态、页面渲染和用餐记录。
- `src/menu-image.js`：菜单图片模板与导出。
- `src/paper-menu.js`：翻页菜单和相关交互。
- `app.js`：事件绑定、内测码验证及应用启动。
- `admin/`：独立的管理后台。
- `sw.js`：PWA 静态资源缓存；新增页面资源时需同步维护缓存清单和版本号。
- `supabase/migrations/`：数据库迁移文件。

目前前端仍是按 `index.html` 中顺序加载的普通脚本，共享顶层状态和函数，并非相互隔离的 ES 模块。调整加载顺序或新增脚本时，要检查依赖及 Service Worker 缓存清单。

菜品照片和吃饭日记照片会压缩后上传至 Supabase 私有 Storage，数据库只保存文件路径；老版 Base64 图片仍可读取。本地 IndexedDB 缓存已成功下载的照片，以便离线查看，浏览器清理存储后需重新联网下载。离线时不能新增或修改云端照片。

部署前依次执行 `supabase/migrations/20261108_meal_history_photo.sql` 和 `supabase/migrations/20261108_photo_storage.sql`。所有设备更新到新版后，每位内测用户可在「编辑菜单」点击「迁移旧照片」，逐张上传并校验，再有条件地替换数据库引用；失败的照片仍保留原数据，可重试。迁移前建议备份数据，旧版客户端不识别 Storage 路径。活跃的共享点菜快照可能仍引用旧文件，因此替换或删除菜品不会自动删除 Storage 中的旧图片，后续需单独核对无引用文件后清理。

## 买菜清单

菜单页可根据所选菜品生成食材和调料建议；生成后可调整、复制文字或生成图片，清单随未完成菜单保存在本机，完成这餐或开始新一餐后清除。

该功能使用 Supabase Edge Function `shopping-list`，部署前需先执行 `supabase/migrations/20261108_shopping_list_limits.sql`，再设置 Edge Function Secret `SILICONFLOW_API_KEY` 并部署该函数。函数使用内测码确认用户及菜品归属、每位用户每天最多请求 30 次，并将菜名发送给硅基流动的免费模型；免费政策和服务可用性以平台当前规则为准。不要把 AI 密钥放进网页配置或 Git 仓库。
