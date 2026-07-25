# 前端运行时与 Hydration 维护

本站以静态 HTML 和服务端渲染为默认交付方式；React islands、浏览器脚本与 Waline 只用于确实需要客户端交互的部分。优化首屏时，应优先减少不必要的 hydration，而不是删除链接、可访问性语义或既有交互。

## Island 选择

| 场景 | 选择 |
| --- | --- |
| 静态内容、链接和纯展示组件 | 不使用客户端指令 |
| 首屏立即需要交互的控件 | `client:load` |
| 可以在首屏空闲时准备、但不阻塞渲染的交互 | `client:idle` |
| 位于首屏外或可延后加载的交互 | `client:visible` |

客户端指令只负责 hydration 时机；组件仍应输出可用的服务端 HTML。链接、文本和必要的替代说明不能依赖 JavaScript 才出现。移动端没有实际收益的 hover 交互不应为了桌面提示而引入 island。

新增 island 前，先确认是否可用 Astro 模板、原生 HTML/CSS 或已有页面脚本完成。若选择指令会影响首屏脚本体积、首屏交互或无 JavaScript 回退，应在改动中说明理由。

## ClientRouter 生命周期

`BaseLayout.astro` 启用了 Astro `ClientRouter`。页面内联脚本可能在站内导航后重新执行，旧页面节点与监听器也会在切换前失效。

- 需要在每次页面进入时执行的内联脚本使用 `data-astro-rerun`。
- 初始化必须面向当前 DOM，避免累积监听器、观察器、计时器或第三方实例。
- 使用 `IntersectionObserver`、事件监听、计时器、`requestAnimationFrame` 或第三方实例时，在 `astro:before-swap` 中释放资源；监听器通常使用 `{ once: true }`。
- 需要在每次页面加载后寻找新节点的长驻脚本，监听 `astro:page-load`；切换前清理的逻辑监听 `astro:before-swap`。
- 初始化逻辑应可重复运行：找不到目标节点时安全退出，重复初始化时不应重复挂载。

Waline 是第三方动态组件的参考实现：它在接近视口时加载，维护单一实例，并在页面切换前销毁实例和观察器。

## 动效与可访问性

- 所有非必要动画必须遵从 `prefers-reduced-motion`；简化模式下保持内容可见、控件可操作。
- 进入视口动画不得依赖 JavaScript 才让内容可见。浏览器不支持 `IntersectionObserver` 时应立即显示内容或提供等效回退。
- 动态显示／隐藏的控件同步维护焦点可达性与 ARIA 状态；例如不可用的返回顶部按钮不应留在 Tab 顺序中。

## 验证清单

涉及 islands、页面脚本或动画时：

1. 运行 `npm run check`；涉及页面或构建时运行 `npm run build`。
2. 在首次加载和至少一次站内导航后检查交互，确认没有重复挂载或重复监听。
3. 检查窄屏与触摸场景，避免只依赖 hover 的关键操作。
4. 以减少动态效果模式检查内容可见性、焦点顺序和动画回退。
