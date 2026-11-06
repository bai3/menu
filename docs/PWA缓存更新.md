# PWA 缓存更新

每次提交时，Git 的 pre-commit 钩子会自动增加 `sw.js` 的缓存版本并将该版本写入本次提交。钩子只修改版本行，不会把 `sw.js` 中其他未暂存的修改加入提交。提交失败后再次尝试时，版本号可能再次递增，这是正常的。

每次新克隆仓库后，在仓库根目录运行一次：

```sh
./scripts/install-git-hooks.sh
```

需要 Git 和 Python 3。Git 钩子是本地配置，不会自动随克隆启用；使用 `git -c core.hooksPath=...` 或 `git commit --no-verify` 也可能跳过它。发布时须同时部署 `sw.js` 和页面资源，并确保服务器或 CDN 不会长期缓存旧的 `sw.js`。Service Worker 更新后，已打开的页面仍可能需要重新打开或刷新才能看到新内容。
