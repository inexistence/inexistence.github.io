# 性能与响应式图片优化

本站对 `public/assets/` 下的站点图片按实际收益生成 WebP 与 AVIF 候选资源。当候选中保留了不低于原图宽度的有效格式时，构建会将页面、文章封面和 Markdown 正文图片输出为带 `srcset`、`sizes` 与固有尺寸的响应式图片。浏览器依次尝试 AVIF、WebP 与原图；原图始终保留为最终回退资源。

这套机制的目标是减少移动端下载远大于实际显示尺寸的图片，同时为图片预留布局空间以降低 CLS。它不改写外链图片，也不会改变首页入场动画、漂浮动画或 Astro 页面切换。

## 生成流程与缓存

`npm run dev`、`npm run check` 与 `npm run build` 会在前置步骤执行图片生成；构建结束会验证清单与文件完整性：

```bash
npm run images:ensure  # 扫描并生成或复用候选资源
npm run images:verify  # 验证清单、尺寸和候选文件
```

输入、输出和缓存边界如下：

```text
public/assets/**                         原始图片（提交）
public/assets/responsive/**              带内容指纹的 AVIF/WebP 派生图（忽略）
src/generated/responsive-images.json     尺寸、候选与构建缓存清单（提交）
src/generated/responsive-backgrounds.css CSS 背景图格式 token（提交）
```

生成器会为 JPG、JPEG、PNG 和 WebP 尝试不超过原图宽度的 `320 / 480 / 768 / 1024 / 1440` 宽候选图。它先在临时目录编码并测量真实体积：WebP 必须比原图至少节省 8 KiB 才发布。AVIF 会逐一与同宽 WebP 比较；只有不大于 WebP 的候选才保留，且一张图必须拥有覆盖全部 WebP 宽度的完整 AVIF 集合才会发布 AVIF。小图因此通常直接使用原图。SVG 与 `assets/avatars/` 不参与候选生成；后者是 Waline 的头像池，更新规则见 [`docs/comment-maintenance.md`](comment-maintenance.md#修改岛民头像池)。

候选文件名包含源图和编码配置的内容指纹；替换原图或调整质量、尺寸、门槛后会生成新 URL，避免浏览器继续使用旧缓存。manifest 同时保存源图哈希和管线哈希，且所有候选文件存在时才复用；缺失文件、原图或配置变化会只重建对应图片组。旧 manifest 曾管理但不再引用的候选会在成功发布新 manifest 后清理。

`npm run dev` 与 `npm run build` 会强制刷新 Astro 内容层缓存，确保图片候选 URL 更新后，即使 Markdown 正文没有改动，也会重新执行 `<picture>` 转换而不会保留已删除的旧候选 URL。

GitHub Actions 缓存派生图；manifest 与背景 token 会随代码提交。派生图不提交到仓库，因此清理它们后只需重新运行 `npm run images:ensure`。

## 写文章与添加素材

把本地图片放在 `public/assets/` 的既有分类目录中，并使用站点绝对路径：

```md
![海边的傍晚](/assets/blog-images/my-new-post/photo.jpg)
```

构建时，具备足够宽有效候选的 Markdown 图片会改写为 `<picture>`：AVIF `srcset` 优先，WebP 次之，原图保留在 `<img>` 的 `src` 中作为回退，且自动填入正确的 `width` 与 `height`。候选不足时，Markdown 图片保持为原始 `<img>`。

已有的本地 HTML 图片也会被处理，可保留样式类：

```html
<img class="full-width" src="/assets/blog-images/my-new-post/photo.jpg" alt="海边的傍晚">
```

外链（例如 `https://…`）不会改写，须由图片源或内容作者自行处理尺寸、压缩与可用性。非 `/assets/` 路径和不受支持的图片格式也保持原样。

新增或替换图片后的建议检查：

```bash
npm run images:ensure
npm run images:verify
npm run build
```

不要手工编辑 `public/assets/responsive/`、`src/generated/responsive-images.json` 或 `src/generated/responsive-backgrounds.css`；它们会由生成器重建。

## 页面组件用法

页面、封面和卡片使用 [`ResponsiveImage.astro`](../src/components/ResponsiveImage.astro)。常规内容图应提供准确的 `sizes`，使浏览器可根据实际容器宽度选择候选图：

```astro
<ResponsiveImage
  src="/assets/blog-images/my-new-post/cover.jpg"
  alt="文章封面"
  sizes="(max-width: 760px) calc(100vw - 40px), 720px"
  loading="lazy"
/>
```

组件会从清单读取图片固有宽高，保留现有 CSS 的裁切、`object-fit` 和动画规则。小型装饰图可传入 `fixedWidth`，只在候选有实际收益时输出最小足够宽的 AVIF/WebP 来源；否则使用原图。首页等大型 CSS 背景使用生成的背景 token，并按媒体条件引用足够宽的候选图；候选不足时同样使用原图。新增需要响应式格式的 CSS 大背景时，把其原图路径加入生成器的 `cssBackgroundSources`，再在样式中使用对应 token。

### CSS 背景图

`<picture>` 是 HTML 图片元素的选择机制，不能用于 CSS 的 `background-image`；CSS 背景没有 `<source>`、`srcset` 或 `sizes`。因此普通内容图继续由 `ResponsiveImage` 输出 `AVIF → WebP → 原图` 的 `<picture>`，而大型 CSS 背景走背景 token。

生成器只为 `cssBackgroundSources` 中列出的原图写入 [`src/generated/responsive-backgrounds.css`](../src/generated/responsive-backgrounds.css)。每个已发布的 WebP 候选都有一个 token；浏览器支持 `image-set()` 时，同一个 token 会优先选择 AVIF、再选择 WebP，浏览器不支持时使用 WebP。页面样式应始终为 token 提供原图回退，例如：

```css
background-image: var(--responsive-background-animal-island-ui-home-bg-1012, url('/assets/animal-island-ui/home-bg.webp'));
```

不要为所有图片生成背景 token：这些 URL 和变量会进入全站主 CSS，即使对应背景从未被页面使用。新增大型 CSS 背景时，添加其 `/assets/...` 原图路径到 `cssBackgroundSources`，运行 `npm run images:ensure`，从生成的文件确认实际存在的候选宽度与 token 名称，再在媒体查询中引用它们。不要手工编辑该生成的 CSS；某种格式或尺寸未达到收益门槛时，它不会产生 token，应保留原图回退。

`fetchpriority="high"` 不作为默认设置。目前审计中的 LCP 是文本区域；错误地提高多个图片优先级会与关键 CSS、字体和文本竞争。响应式图片上线后，应在生产环境复测；只有当某页面的唯一真实 LCP 图片被确认后，才为它添加高优先级。

## 其他首屏资源策略

- 不再引入 `animal-island-ui` 的全量样式入口；基础布局只汇入本站实际使用的 Button、Card、Collapse、Divider、Footer、Loading、Tag、Title 与 Tooltip 样式，并在全局样式补齐主题变量。
- Waline 的客户端、样式和评论字体不在初始 HTML 中加载。评论区进入视口前约 600px 时才动态加载；不支持 `IntersectionObserver` 的浏览器会立即加载作为回退。站内切换时旧实例会销毁，当前页面重新建立观察器。
- 首页的入场动画、漂浮动画以及 `ClientRouter` 保持原有行为与时长；性能优化不以移除这些体验为代价。
- 图片声明固有尺寸，页脚许可文字和正文链接色使用满足 WCAG AA 对比度的颜色。

## 验证与排障

本地运行生产预览后，在 DevTools 的 Network 面板关闭缓存并检查：

- 输出响应式图片在支持 AVIF 的浏览器会优先选择 AVIF，否则选择 WebP；桌面或 Retina 屏会根据 `sizes` 与 DPR 选择合适宽度；候选不足的图片会直接请求原图；
- 已改写的 `<img>` 仍带原图 `src`、正确的 `width` 和 `height`；
- 首屏文章不会请求 Waline JS、样式、评论字体或评论 API；滚动接近评论区后才会加载；
- 页面切换后，评论区不应出现重复挂载。

若候选图不存在或页面没有响应式输出，先确认图片位于 `public/assets/`，路径以 `/assets/` 开头，并执行：

```bash
npm run images:ensure
npm run images:verify
```

仍需完全重建时，可以只删除被忽略的 `public/assets/responsive/`，再运行生成命令。不要删除原始图片或生成的 manifest。
