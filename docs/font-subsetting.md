# 字体子集技术方案

本文说明本站中文 WebFont 的生成、加载和维护方式。日常开发只需运行 `npm run dev` 或 `npm run build`；两条命令都会自动执行字体准备流程。

## 目标与边界

目标是在中文内容跨设备保持 Noto Sans SC 字形一致，同时避免让每位访问者下载三份完整中文字体。

- 正文、页面和组件传入的静态文案使用静态子集。
- Waline 的昵称、评论、编辑器和按钮使用完整覆盖的评论字体分块，支持无法预先枚举的用户输入。
- emoji，以及 Noto Sans SC 源字体本来不支持的字符，保留系统后备字体渲染；这不属于跨平台字形一致性的覆盖范围。

## 字体来源与字重

中文字体源来自锁定版本的 `animal-island-ui`：

```text
node_modules/animal-island-ui/dist/files/
  noto-sans-sc-chinese-simplified-400-normal.*.woff2
  noto-sans-sc-chinese-simplified-500-normal.*.woff2
  noto-sans-sc-chinese-simplified-700-normal.*.woff2
```

三个字重均会生成：400 用于常规正文，500 用于强调和输入区域，700 用于标题和按钮。组件库 CSS 中原始完整中文 `@font-face` 会在构建时移除；组件库提供的拉丁字体仍保留。这样不会在构建产物中重新带入完整中文字体。

具体来说，[`astro.config.mjs`](../astro.config.mjs) 中的 Vite 预处理插件只转换 `animal-island-ui/dist/index.css`：它会删除字体族为 `Noto Sans SC`、且引用 `noto-sans-sc-chinese-simplified` 的 `@font-face` 规则；其余 Noto Sans SC 规则保留，并限制为拉丁 Unicode 范围 `U+0000-024F`。原始中文 WOFF2 不会从 `node_modules` 删除——生成器仍以它们为源字体——但由于打包后的 CSS 已不再引用它们，Vite 不会将其输出到 `dist/_astro`，浏览器也不会下载它们。

该转换依赖组件库当前的 CSS 规则格式。升级 `animal-island-ui` 后，应运行 `npm run build`，并确认 `dist/_astro` 中没有 `noto-sans-sc-chinese-simplified-*` 文件；若出现，需同步调整 `astro.config.mjs` 中的转换规则。

## 自动生成与缓存

`package.json` 的生命周期脚本会在开发和构建前执行：

```text
predev / prebuild
  └─ npm run fonts:ensure
       ├─ scripts/fonts-ensure.mjs
       └─ scripts/generate-font-subsets.py
```

首次运行时，`fonts:ensure` 会使用 `python3`（也可用 `PYTHON` 指定）创建项目内的 `.fonttools/` 虚拟环境，并从 `tools/font-subset-requirements.txt` 安装固定版本的 `fonttools[woff]`。首次需要网络；后续会复用该环境。

生成清单位于 `.cache/inexistence-fonts/manifest.json`，并分别记录静态字体与评论字体的指纹。指纹包含字体源哈希、生成器版本、FontTools 版本和相应策略。输出文件不存在或指纹不同才会重建。

缓存命中不只依赖清单：生成器还会检查三份静态 WOFF2，以及评论 CSS 和全部 144 个评论分块是否存在且非空。任一输出缺失时，即使指纹相同也会重新生成对应资产。CI 恢复的缓存因此只是加速手段，不能绕过源字体、策略与产物完整性的校验。

以下路径均为本地生成物，已被 `.gitignore` 忽略，不能提交：

```text
.fonttools/
.cache/
public/fonts/
```

## 静态字体

静态字体输出到：

```text
public/fonts/static/noto-sans-sc-static-400.woff2
public/fonts/static/noto-sans-sc-static-500.woff2
public/fonts/static/noto-sans-sc-static-700.woff2
```

生成器会递归读取 `src/` 中的 `.astro`、`.css`、`.md`、`.mdx`、`.ts`、`.tsx`、`.js`、`.jsx` 与 `.json` 文件，并收集完整文件内容中的每个字符。它不会解析“最终可见文本”，因此模板字符串、条件分支和注释中的中文也会被纳入。这是刻意采取的保守策略，以避免漏掉运行时选择的静态文案。

静态内容变更只会重新生成这三份正文子集，不会触发评论字体重分块。新增普通页面或文章只要位于 `src/` 且扩展名在上述列表中，就会自动纳入下一次开发或构建。

当前策略是全站共用子集，不按路由拆分。因此技术分类页可能会下载包含其他文章文字的子集。以当前内容为例，页面若使用了 400、500、700 三个字重，字体传输约为 621 KB；这仍低于三份完整中文字体约 3.47 MB。按路由拆分可进一步降低单页首次传输，但会增加产物、请求数和缓存维护复杂度。

所有自托管字体均设置 `font-display: swap`。首次访问时，浏览器可以先用后备字体显示文字，字体下载完成后再切换至 Noto Sans SC；短暂的字形变化是为了避免文字被字体下载阻塞的预期取舍。验证实际字体时应等待 Network 中的字体请求完成，再在 DevTools 的 Rendered Fonts 面板确认。

`src/` 外的文本不会进入静态子集，例如 `public/` 中独立文件、接口或 CMS 返回的文本。使用组件时，写在本站页面中的 slot、标题和按钮文案会被扫描；组件库内部写死的中文不会扫描。若组件库的固定中文文案需要保证一致字形，应将其添加至受控的静态字符清单或扩展生成器扫描范围，不要扫描整个 `node_modules`。

## Waline 评论字体

评论字体输出到 `public/fonts/comment/`，CSS 为 `public/fonts/comment-fonts.css`。它定义独立的 `Noto Sans SC Comment` 字体族：每个字重拆为 48 个带 `unicode-range` 的 WOFF2 文件，共 144 块。

分块覆盖每份源字体 CMap 的全部 Unicode 码点。固定的常用简体中文优先级表会将常见字符排入前面的块，剩余字符仍完整覆盖；该表不依赖文章内容，因此新增文章不会改变评论分块或使评论缓存失效。浏览器只会请求当前 Waline UI、评论文本和编辑器实际命中的块，而不是一次下载 144 个文件。

每个字重的分块顺序为“固定优先级字符 + 其余码点的稳定排序”，随后按码点数量均匀切成 48 段。这里均衡的是字符数量，而不是 WOFF2 的字节数：不同字形及其 OpenType 依赖不同，单个文件体积不一定相同。完整覆盖以源字体 CMap 为准；生成后的 48 块并集应等于对应源字体的 CMap。

文章页和留言页通过 `BaseLayout` 的 `commentFonts` 属性在 `<head>` 中加载评论 CSS；分类页、首页、归档页等没有 Waline 的页面不会加载它。`.waline-host` 及其输入、编辑器和按钮使用评论字体，`code`、`pre`、`kbd` 与 `samp` 仍使用等宽字体。

评论使用独立的 `Noto Sans SC Comment` 字体族，而不是复用正文的 `Noto Sans SC`。正文族的中文文件是有限静态子集，适合已知文本；评论族则完整覆盖源字体。两者隔离后，未知评论字符只会匹配评论分块，不会误命中正文子集并回退到系统中文字体。

## GitHub Pages

工作流在 `npm ci` 前恢复两份字体缓存：

- 评论缓存只依赖锁文件、生成器和分块策略；
- 静态缓存额外依赖 `src/**`，因此文章改动只让静态缓存失效。

工作流也通过 `actions/setup-python` 缓存 pip。`npm ci` 只重建 `node_modules`，不会删除项目根目录的 `.cache/`、`.fonttools/` 或 `public/fonts/`；因此恢复的资产可被 `npm run build` 直接验证并复用。

当 `animal-island-ui` 字体源、FontTools 版本、生成器或分块策略变更时，生成器会检测到指纹变化，重新生成相应资产。CI 缓存只是加速手段，清单和输出存在性检查才是正确性保障。

### 升级检查清单

升级 `animal-island-ui`、FontTools 或字体生成器后：

1. 执行 `npm run build`；
2. 确认构建末尾的 `fonts:verify` 通过；
3. 在 `dist/_astro` 中确认没有 `noto-sans-sc-chinese-simplified-*` 原始完整字体；
4. 在文章页或留言页确认评论 CSS 和实际命中的评论分块可加载；
5. 在分类页确认不会加载评论 CSS。

## 构建回归测试

`npm run build` 完成 Astro 构建后会自动运行 `npm run fonts:verify`，CI 复用同一命令。验证脚本检查：

- `dist/fonts/static/` 中 400、500、700 三份静态字体均存在且非空；
- `dist/fonts/comment/` 中恰有 144 个非空评论分块，且评论 CSS 存在；
- 任意 `dist` 文件中没有组件库的 `noto-sans-sc-chinese-simplified-*` 原始完整字体；
- 含 `data-waline-host` 的 HTML 页面必须引用评论 CSS，未含 Waline 的页面不得引用它。

## 验证与排障

启动本地服务器：

```bash
npm run dev
```

在浏览器 DevTools 的 Network 面板中勾选 Disable cache 后刷新页面：

- 分类页应请求实际用到的 `noto-sans-sc-static-*.woff2`，不应出现 `noto-sans-sc-chinese-simplified-*.woff2` 原始完整字体；
- 文章页或留言页应加载 `/fonts/comment-fonts.css`，随后只请求命中的少数 `comment/*.woff2`；
- 在 Elements 的 Computed 面板底部查看 Rendered Fonts：正文应使用 Noto Sans SC，评论区应使用 Noto Sans SC Comment。

检查生成目录和缓存命中：

```bash
npm run fonts:ensure
du -sh public/fonts/static public/fonts/comment
```

无改动时应显示两类字体都已跳过。若提示找不到 Python，请安装 `python3` 或设置 `PYTHON`；若首次安装 FontTools 失败，请检查网络或 Python 包源后重试。删除 `.fonttools/`、`.cache/inexistence-fonts/` 和 `public/fonts/` 可模拟冷启动，随后运行 `npm run dev` 或 `npm run build` 会重新创建全部资产。
