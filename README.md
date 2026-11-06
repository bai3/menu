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
