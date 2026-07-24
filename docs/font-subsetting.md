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
predev
  ├─ npm run fonts:ensure
  │    ├─ scripts/fonts-ensure.mjs
  │    └─ scripts/generate-font-subsets.py
  └─ npm run fonts:verify -- --fonts-dir public/fonts

prebuild
  └─ npm run fonts:ensure
```

首次运行时，`fonts:ensure` 会查找可用的 Python 3（`PYTHON` 优先；Windows 还会尝试 `python` / `py`，非 Windows 优先 `python3`；会用 `sys.version_info` 排除 Python 2）创建项目内的 `.fonttools/` 虚拟环境，并从 `tools/font-subset-requirements.txt` 安装固定版本的 `fonttools[woff]`。首次需要网络；后续会复用该环境。

评论字体共 144 个分块。仓库提交 `public/fonts/comment/`、`comment-fonts.css` 与 `manifest-fragment.json`（含 comment 指纹与每个文件的 SHA-256）。`fonts:ensure` 在指纹、生成器版本与文件哈希均匹配时跳过评论子集化；不匹配时本地会重新生成、写入 `manifest-fragment.json` 并警告，随后把更新后的 comment 产物一并提交即可。`npm run fonts:vendor-comment` 用于显式刷新/初次 vendoring（过期时会重建）。CI 设置 `STRICT_COMMENT_FONT_VENDOR=1`，不匹配则直接失败，禁止靠现算混过。

需要现算评论字体时，生成器使用进程池并行子集化（默认最多 8 个 worker）。输出内容与顺序仍由固定分块策略决定。

静态字体的跳过清单位于 `.cache/inexistence-fonts/manifest.json`，**仅记录 static 指纹**。三份静态 WOFF2 存在且指纹相同才会跳过；`.cache` 不再作为 comment 的依据。

以下路径为本地生成物或缓存，已被 `.gitignore` 忽略：

```text
.fonttools/
.cache/
public/fonts/static/
```

以下路径**提交进仓库**（勿手改；应由生成器更新）：

```text
public/fonts/comment/
public/fonts/comment-fonts.css
public/fonts/manifest-fragment.json
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

### 容量监控与演进阈值

随着文章增加，全站静态子集会逐渐变大，单个页面也可能下载并未实际显示的文章字符。`npm run dev` 的前置流程会检查 `public/fonts`，`npm run build` 末尾则检查 `dist/fonts`；两种模式都会统计三个静态字体的实际总字节数。超过阈值时会输出警告，在 GitHub Actions 中显示为 warning annotation，但不会让构建失败。也可随时手动检查：

```bash
du -ch public/fonts/static/*.woff2
```

以下阈值用于决定何时演进方案：

- 合计低于 1 MiB：继续使用当前全站共享子集；
- 达到 1–2 MiB：脚本发出评估提醒，考虑拆分“公共 UI 字体”和“文章正文字体”；
- 达到 2 MiB，或实际监测显示字体请求已明显影响 LCP：脚本发出拆分提醒，应实施按路由或按文章生成子集，并保留公共字符字体；
- CI 字体生成耗时明显增加：优化静态指纹，使其只依赖实际字符集合，避免 CSS、注释或代码结构变化触发不必要的重建。

这些阈值是维护触发条件，不是构建失败条件。评估时应同时参考生产环境字体传输大小、缓存命中率、LCP 和 CI 生成耗时；评论字体不依赖文章内容，不纳入上述静态子集容量判断。

所有自托管字体均设置 `font-display: swap`。首次访问时，浏览器可以先用后备字体显示文字，字体下载完成后再切换至 Noto Sans SC；短暂的字形变化是为了避免文字被字体下载阻塞的预期取舍。验证实际字体时应等待 Network 中的字体请求完成，再在 DevTools 的 Rendered Fonts 面板确认。

`src/` 外的文本不会进入静态子集，例如 `public/` 中独立文件、接口或 CMS 返回的文本。使用组件时，写在本站页面中的 slot、标题和按钮文案会被扫描；组件库内部写死的中文不会扫描。若组件库的固定中文文案需要保证一致字形，应将其添加至受控的静态字符清单或扩展生成器扫描范围，不要扫描整个 `node_modules`。

## Waline 评论字体

评论字体位于 `public/fonts/comment/`，CSS 为 `public/fonts/comment-fonts.css`，清单为 `public/fonts/manifest-fragment.json`。它定义独立的 `Noto Sans SC Comment` 字体族：每个字重拆为 48 个带 `unicode-range` 的 WOFF2 文件，共 144 块。

维护评论字体（源字体、生成器、分块策略变更后）：

```bash
npm run fonts:ensure
# 或显式：npm run fonts:vendor-comment
git add public/fonts/comment public/fonts/comment-fonts.css public/fonts/manifest-fragment.json
```

分块覆盖每份源字体 CMap 的全部 Unicode 码点。固定的常用简体中文优先级表会将常见字符排入前面的块，剩余字符仍完整覆盖；该表不依赖文章内容，因此新增文章不会改变评论分块或使评论缓存失效。浏览器只会请求当前 Waline UI、评论文本和编辑器实际命中的块，而不是一次下载 144 个文件。

每个字重的分块顺序为“固定优先级字符 + 其余码点的稳定排序”，随后按码点数量均匀切成 48 段。这里均衡的是字符数量，而不是 WOFF2 的字节数：不同字形及其 OpenType 依赖不同，单个文件体积不一定相同。完整覆盖以源字体 CMap 为准；生成后的 48 块并集应等于对应源字体的 CMap。

文章页和留言页通过 `BaseLayout` 的 `commentFonts` 属性在 `<head>` 中加载评论 CSS；分类页、首页、归档页等没有 Waline 的页面不会加载它。`.waline-host` 及其输入、编辑器和按钮使用评论字体，`code`、`pre`、`kbd` 与 `samp` 仍使用等宽字体。

评论使用独立的 `Noto Sans SC Comment` 字体族，而不是复用正文的 `Noto Sans SC`。正文族的中文文件是有限静态子集，适合已知文本；评论族则完整覆盖源字体。两者隔离后，未知评论字符只会匹配评论分块，不会误命中正文子集并回退到系统中文字体。

## GitHub Pages

工作流在 `npm ci` 前恢复**静态**字体缓存（`.cache` + `public/fonts/static/`），key 额外依赖 `src/**`。评论字体从仓库检出，不再使用 comment 的 Actions cache。

Build 步骤设置 `STRICT_COMMENT_FONT_VENDOR=1`：已提交的 comment 指纹或文件哈希与当前生成器不一致时构建失败。

工作流也通过 `actions/setup-python` 缓存 pip。`npm ci` 只重建 `node_modules`，不会删除 `.cache/`、`.fonttools/` 或已跟踪的 `public/fonts` 评论产物。

当 `animal-island-ui` 字体源、FontTools 版本、生成器或分块策略变更时，必须本地更新并提交 comment 产物与 `manifest-fragment.json`；仅依赖 CI 现算不能通过 STRICT 检查。

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
- `dist/fonts/manifest-fragment.json` 存在，且 `chunkCount` 为 48、含非空 `commentFingerprint`；
- 任意 `dist` 文件中没有组件库的 `noto-sans-sc-chinese-simplified-*` 原始完整字体；
- 含 `data-waline-host` 的 HTML 页面必须引用评论 CSS，未含 Waline 的页面不得引用它。

开发前执行的 `npm run fonts:verify -- --fonts-dir public/fonts` 复用字体完整性和容量检查，但跳过仅适用于完整构建的原始字体泄漏与 HTML 页面范围检查。

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

无改动时应显示静态与评论均已跳过。若提示找不到 Python，请安装 Python 3 或设置 `PYTHON`；若首次安装 FontTools 失败，请检查网络或 Python 包源后重试。删除 `.fonttools/`、`.cache/inexistence-fonts/` 和 `public/fonts/static/` 可模拟静态冷启动；评论字体仍从仓库使用。
