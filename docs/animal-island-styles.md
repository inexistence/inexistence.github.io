# Animal Island 组件样式维护

本站不引入 `animal-island-ui` 的全量样式入口。这样可以避免未使用组件的 CSS、字体声明和主题规则进入首屏；组件样式由源码导入情况驱动，并由校验脚本强制保持同步。

## 样式结构

- `src/styles/animal-island-base.css`：从组件库全局样式中保留的共享基础规则；在布局中先于其他站点样式加载。
- `src/styles/animal-island-components.css`：按组件列出的 CSS 导入清单，是组件样式的唯一入口。
- `src/styles/global.css`：本站主题变量与组件覆盖规则。组件 CSS 或基础样式引用的 `--animal-*` 变量必须在这里定义。

不要在页面、组件或其他样式文件中直接导入组件库的 CSS，也不要改回组件库的全量样式入口。

## 自动校验

`npm run styles:verify` 运行 `scripts/verify-animal-island-styles.mjs`，并会在 `dev`、`check` 和 `build` 前自动执行。脚本会扫描 `src/` 下的 `.astro`、`.ts` 与 `.tsx` 文件（忽略声明文件），识别以下组件导入：

- `animal-island-ui/es/components/<组件名>/...` 的直接导入；
- `import { <组件名> } from 'animal-island-ui'` 的具名导入。

它会同时检查：

1. 每个源码组件都有 `animal-island-components.css` 中对应的样式导入；
2. 每个组件样式导入都有实际源码组件与之对应；
3. 基础样式和组件样式引用的主题变量都在 `global.css` 中定义。

因此，新增组件却漏加样式、删除组件却遗留样式，都会导致校验失败。若需要采用新的导入形式，先扩展校验脚本的导入解析逻辑；不要为绕过校验保留无用样式。

## 维护流程

### 新增组件

1. 在 `src/` 中导入并使用组件。
2. 在 `animal-island-components.css` 添加该组件对应的 CSS 模块导入。
3. 将校验提示的缺失 `--animal-*` 主题变量补充到 `global.css`。
4. 运行 `npm run styles:verify`；涉及页面、构建或组件库升级时再运行 `npm run build`。

### 移除组件

1. 删除全部源码组件导入与使用处。
2. 删除 `animal-island-components.css` 中对应的 CSS 模块导入，以及只服务于该组件的站点覆盖样式。
3. 运行 `npm run styles:verify`。遗留的组件样式会以 `Unused animal-island component styles` 报错。

### 升级组件库

升级 `animal-island-ui` 后，运行完整的 `npm run build`。除样式校验外，还要按照 [字体子集维护说明](font-subsetting.md) 确认完整中文字体没有进入 `dist/`。

## 例外处理

当前没有“仅样式使用”的组件白名单。确实需要这类例外时，应先在校验脚本中增加具名、受注释约束的例外配置并说明原因，再添加样式；不要用未使用的组件导入或跳过校验作为替代方案。
