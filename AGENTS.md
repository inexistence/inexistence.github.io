# INEXISTENCE 开发约定

本文件是本仓库开发者与自动化代理的入口约定，不替代各专题维护文档。改动前先确认工作区已有未提交内容；不要覆盖、删除或混入无关变更。

## 常用命令

```bash
npm run dev       # 启动开发环境；会准备字体与响应式图片
npm run check     # Astro 类型与内容检查
npm run build     # 生产构建及资源校验
npm run preview   # 预览 dist/
```

首次准备字体需要 Python 3 与网络。提交前至少运行与改动范围相符的检查；涉及页面、构建、图片或字体时运行 `npm run build`。

## 内容与静态资源

- 文章位于 `src/content/posts/`；遵循 `README.md` 中的 frontmatter 约定。
- 岛屿展厅独立于文章：展览元数据位于 `src/content/exhibitions/`，作品内容位于 `src/content/photographs/`，摄影素材位于 `public/assets/exhibitions/<展览-id>/`。新增或替换作品时遵循 [`docs/exhibition-maintenance.md`](docs/exhibition-maintenance.md)，并运行 `npm run images:ensure`、`npm run check` 和 `npm run build`。
- `public/assets/` 中的原图是可手工新增、替换和提交的站点素材。
- `public/assets/avatars/` 是 Waline 匿名留言的岛民头像池，不生成响应式候选；保持稳定文件名。增删或替换头像时，还要在 `waline-for-blog` 的 `index.cjs` 同步 `avatarFiles`，并先部署博客静态图片、再部署 Waline 服务。细节见 [`docs/comment-maintenance.md`](docs/comment-maintenance.md)。
- 不要手工修改 `public/assets/responsive/`：它是被忽略的 AVIF/WebP 派生图。使用 `npm run images:ensure` 生成，使用 `npm run images:verify` 校验。
- `src/generated/responsive-images.json` 与 `src/generated/responsive-backgrounds.css` 是生成的、**需要提交**的索引文件；不要手改。
- 普通页面与文章图片使用 `ResponsiveImage.astro` 或 Markdown 图片；大型 CSS 背景才使用背景 token。新增这类背景时更新生成器的 `cssBackgroundSources`，重新生成后引用实际产生的 token。
- 图片候选的格式、尺寸、收益门槛、缓存和回退规则见 [`docs/responsive-images.md`](docs/responsive-images.md)。

## 字体

- `public/fonts/static/` 是本地生成物，已忽略；不要手改或提交。
- `public/fonts/comment/`、`public/fonts/comment-fonts.css`、`public/fonts/manifest-fragment.json` 是受版本控制的生成产物。更改字体源或策略后运行 `npm run fonts:ensure`（或 `npm run fonts:vendor-comment`），并将它们作为一组提交。
- 评论字体的指纹和文件哈希由 CI 校验；不要通过手改产物规避校验。
- 细节见 [`docs/font-subsetting.md`](docs/font-subsetting.md)。

## 组件库样式

- `src/styles/animal-island-components.css` 仅导入 `src/` 实际使用的 `animal-island-ui` 组件样式。新增或移除组件时，必须在同一改动中同步更新该文件。
- `npm run styles:verify` 会双向校验组件导入与样式清单，并检查所需主题变量；不得通过保留无用样式或跳过校验规避报错。
- 裁剪逻辑、脚本边界与新增／移除组件的维护流程见 [`docs/animal-island-styles.md`](docs/animal-island-styles.md)。

## 页面样式

- 页面专属样式放在 `src/styles/` 的对应文件中，并由页面直接导入；不要把它们继续堆入 `global.css`。
- `global.css` 只保留全站基础、共享组件与跨页面的响应式规则。新增或调整样式前，先查阅 `README.md` 的“页面样式组织”。

## 前端运行时

- 默认交付静态 HTML；只为真实客户端交互使用 island，并按交互时机选择合适的 `client:*` 指令。不能以延迟 hydration 为由移除链接、语义或无 JavaScript 回退。
- 本站启用 `ClientRouter`。新增页面脚本、观察器、计时器或第三方实例时，必须处理重复初始化，并在 `astro:before-swap` 清理资源。
- 细则、动效可访问性与验证清单见 [`docs/frontend-runtime.md`](docs/frontend-runtime.md)。

## 评论、安全与部署

- Waline 前端、服务端和数据分别由本仓库、`waline-for-blog` 与私有 `waline-data` 仓库维护。改动评论功能前阅读 [`docs/comments.md`](docs/comments.md)；日常操作看 [`docs/comment-maintenance.md`](docs/comment-maintenance.md)。
- 不要将令牌、JWT、Turnstile secret、管理员地址或任何私有服务信息写入代码、公开文档、截图或提交记录。
- GitHub Pages 部署由 `.github/workflows/deploy.yml` 运行。不要提交 `dist/`、本地缓存或其他构建产物，除非该文件本来就是受版本控制的生成索引。

## 修改原则

- 保持图片回退链、固有尺寸、可访问性文本与现有动画行为；性能优化不能以删除既有体验为代价。
- 修改生成脚本、候选质量、宽度、门槛或排除目录后，必须重新生成图片并复查 manifest 与页面输出。
- 升级 `animal-island-ui` 或调整字体处理后，运行完整生产构建并按字体文档确认未把完整中文字体带入 `dist/`。
