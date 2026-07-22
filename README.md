# INEXISTENCE

个人博客，使用 Astro 构建，并通过 GitHub Pages 发布。

## 技术栈

- Astro 7 静态内容与路由
- React islands
- [animal-island-ui](https://github.com/guokaigdg/animal-island-ui) 1.3.0
- GitHub Actions + GitHub Pages

## 本地开发

```bash
npm install
npm run dev
```

构建并检查：

```bash
npm run build
```

## 内容

文章位于 `src/content/posts`。在文章 frontmatter 中设置 `draft: true` 后，该文章不会出现在生产页面、RSS 或 sitemap 中。

## 许可说明

本站使用的 `animal-island-ui` 组件遵循 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 许可，仅用于非商业个人博客。本站修改了主题变量和页面布局，并加入了原创岛屿插画。
