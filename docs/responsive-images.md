# 性能与响应式图片优化

本站对 `public/assets/` 下的本地图片生成 WebP 候选资源。当候选中保留了不低于原图宽度的有效 WebP 时，构建会将页面、文章封面和 Markdown 正文图片输出为带 `srcset`、`sizes` 与固有尺寸的响应式图片；否则直接使用原图。原图始终保留，作为不支持 WebP 或候选不足时的回退资源。

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
public/assets/responsive/**              WebP 派生图（忽略）
src/generated/responsive-images.json     尺寸与候选清单（忽略）
```

生成器会为 JPG、JPEG、PNG 和 WebP 生成不超过原图宽度的 `320 / 480 / 768 / 1024 / 1440` 宽候选图，并尝试保留一张原图宽度的 WebP。小于 320px 的装饰图会改用不超过原图的更小候选宽度，避免为图标建立多余的 `srcset`。PNG 流程图使用无损 WebP；照片、封面和装饰图使用高质量有损 WebP。每张候选图若不比原图更小会被删除；若因此没有保留原图宽度候选，即使较小候选仍存在，常规响应式输出也会改用原图，避免放大较小 WebP 或增加传输体积。源文件内容的 SHA-256 组成稳定指纹，未变化的图片会直接复用已有候选图；它不依赖文件修改时间，因此 GitHub Actions 在全新检出时仍可命中缓存。

GitHub Actions 缓存派生图和清单；缓存键同时依赖 `package-lock.json`、原始 `public/assets/` 内容和生成脚本。派生图不提交到仓库，因此清理它们后只需重新运行 `npm run images:ensure`。

## 写文章与添加素材

把本地图片放在 `public/assets/` 的既有分类目录中，并使用站点绝对路径：

```md
![海边的傍晚](/assets/blog-images/my-new-post/photo.jpg)
```

构建时，具备足够宽有效候选的 Markdown 图片会改写为 `<picture>`：WebP `srcset` 用于支持的浏览器，原图保留在 `<img>` 的 `src` 中作为回退，且自动填入正确的 `width` 与 `height`。候选不足时，Markdown 图片保持为原始 `<img>`。

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

不要手工编辑 `public/assets/responsive/` 或 `src/generated/responsive-images.json`；它们会由生成器重建。

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

组件会从清单读取图片固有宽高，保留现有 CSS 的裁切、`object-fit` 和动画规则。小型装饰图可传入 `fixedWidth`，输出宽度不小于目标显示尺寸的最小单一 WebP 候选，而不建立冗余 `srcset`；若没有足够宽的候选则使用原图。首页背景图按媒体条件引用桌面和移动端各自足够宽的候选图；候选不足时同样使用原图。

`fetchpriority="high"` 不作为默认设置。目前审计中的 LCP 是文本区域；错误地提高多个图片优先级会与关键 CSS、字体和文本竞争。响应式图片上线后，应在生产环境复测；只有当某页面的唯一真实 LCP 图片被确认后，才为它添加高优先级。

## 其他首屏资源策略

- 不再引入 `animal-island-ui` 的全量样式入口；基础布局只汇入本站实际使用的 Button、Card、Collapse、Divider、Footer、Loading、Tag、Title 与 Tooltip 样式，并在全局样式补齐主题变量。
- Waline 的客户端、样式和评论字体不在初始 HTML 中加载。评论区进入视口前约 600px 时才动态加载；不支持 `IntersectionObserver` 的浏览器会立即加载作为回退。站内切换时旧实例会销毁，当前页面重新建立观察器。
- 首页的入场动画、漂浮动画以及 `ClientRouter` 保持原有行为与时长；性能优化不以移除这些体验为代价。
- 图片声明固有尺寸，页脚许可文字和正文链接色使用满足 WCAG AA 对比度的颜色。

## 验证与排障

本地运行生产预览后，在 DevTools 的 Network 面板关闭缓存并检查：

- 输出响应式 WebP `srcset` 的图片在移动端会选择较小候选；桌面或 Retina 屏会根据 `sizes` 与 DPR 选择合适宽度；候选不足的图片会直接请求原图；
- 已改写的 `<img>` 仍带原图 `src`、正确的 `width` 和 `height`；
- 首屏文章不会请求 Waline JS、样式、评论字体或评论 API；滚动接近评论区后才会加载；
- 页面切换后，评论区不应出现重复挂载。

若候选图不存在或页面没有响应式输出，先确认图片位于 `public/assets/`，路径以 `/assets/` 开头，并执行：

```bash
npm run images:ensure
npm run images:verify
```

仍需完全重建时，可以只删除被忽略的 `public/assets/responsive/` 和 `src/generated/responsive-images.json`，再运行生成命令。不要删除原始图片。
