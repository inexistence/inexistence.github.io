# RSS 订阅说明

本站的 RSS 订阅地址是 <https://inexistence.github.io/rss.xml>。

## 生成方式

RSS 由 Astro 的静态路由 [`src/pages/rss.xml.ts`](../src/pages/rss.xml.ts) 在构建时生成。该路由使用 `@astrojs/rss`，在执行 `npm run build` 时输出为 `dist/rss.xml`，随后随 GitHub Pages 部署。

站点的 `<head>` 已通过 `rel="alternate"` 声明该订阅源；页脚的订阅入口也直接链接至 `/rss.xml`。

## 收录规则

RSS 从 `src/content/posts/` 读取 `.md` 与 `.mdx` 文章，并复用 `getPublishedPosts()`：

- 仅收录 frontmatter 中 `draft: false`（或未填写、默认值为 `false`）的文章；
- 按 `publishDate` 倒序排列；
- 每个条目包含 `title`、`description`、`publishDate`、文章链接、`category` 和 `tags`；
- 文章正文、封面图与 `place` 字段不会写入 RSS 条目。

因此，新文章完成后将 `draft` 改为 `false` 并部署即可自动进入订阅源；草稿不会出现在 RSS、生产文章列表或 sitemap 中。

## 验证

本地运行：

```bash
npm run build
```

构建完成后检查 `dist/rss.xml`。线上部署完成后，访问订阅地址确认最新文章和链接均正确。
