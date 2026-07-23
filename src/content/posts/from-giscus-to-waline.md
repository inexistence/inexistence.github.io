---
title: "从 Giscus 到 Waline：给 Astro 博客搭建评论区与留言板"
description: "记录一次从 GitHub Discussions 评论迁移到 Waline 的实践：三仓库架构、Vercel 部署、私有数据存储、前端接入，以及两个容易踩到的 GitHub 存储问题。"
publishDate: "2026-07-23"
category: "技术"
place: ""
tags: ["Astro", "Waline", "Vercel", "GitHub Pages", "评论系统"]
cover: ""
draft: false
---

博客的评论区看似只是页面底部的一小块，实际牵涉到身份、垃圾留言、数据持久化、部署、隐私和站点风格。这个博客最初接入的是 Giscus：它足够轻量，评论会直接落到 GitHub Discussions。但实际使用下来，我还是把它换成了 Waline。

这篇文章记录完整的搭建过程。目标很明确：文章评论和留言板共用一套服务；评论数据不公开；访客只需填写昵称和邮箱；页面仍然部署在 GitHub Pages；服务端尽量保持免费、低维护。

## 为什么从 Giscus 换到 Waline

Giscus 的优点很明显：没有后端、配置快、GitHub 登录天然可用。但它也带来几个与个人博客不太契合的限制：

- 留言者必须使用 GitHub 账号；
- 评论本质是 Discussion，内容和管理界面都在 GitHub；
- 视觉可以通过主题调整，但表单和评论结构仍然很像 GitHub；
- “文章评论”和“留言板”需要靠不同的分类或映射规则管理。

Waline 的定位不同：它是独立的评论服务。前端只嵌入一个客户端，数据放在自己控制的存储中；访客可以用昵称和邮箱留言；管理员在 Waline 后台删除或管理评论。

这次迁移不做历史评论导入。旧 Giscus Discussion 只在 Waline 上线、测试留言成功后再清理。

## 最终结构：三个仓库和一个服务

最终没有把所有东西塞进一个仓库，而是按职责拆开：

```text
访客浏览器
    │
    ├── GitHub Pages
    │   └── inexistence.github.io
    │       Astro 页面 + Waline 客户端 + 评论区样式
    │
    └── Vercel
        └── waline-for-blog
            Waline 服务端
                │
                └── GitHub 私有仓库
                    └── waline-data
                        CSV 格式的评论、用户和计数数据
```

各部分的边界很重要：

| 位置 | 负责什么 | 不能放什么 |
| --- | --- | --- |
| `inexistence.github.io` | Astro 前端、评论组件、GitHub Pages 部署 | GitHub Token、JWT Token、Turnstile Secret |
| `waline-for-blog` | Waline 服务源码、Vercel 部署说明 | 真实密钥 |
| `waline-data`（私有） | 评论数据 | 前端代码和服务端密钥 |
| Vercel 环境变量 | 运行 Waline 所需的私密配置 | 不应同步回仓库 |

前端只知道 Waline 的公开服务地址，例如 `https://waline-for-blog-rho.vercel.app`。服务端才持有 GitHub Token，并用它读写私有数据仓库。

## 1. 准备 Waline 服务仓库

先创建 `waline-for-blog`，内容基于 Waline 的 Vercel 示例：入口文件只需要加载 `@waline/vercel`，`vercel.json` 则把请求转发给该入口。

部署前最好补一个 `.gitignore`：

```gitignore
node_modules/
.vercel/
.env
.env.local
.env.*.local
!.env.example
*.log
.DS_Store
```

`node_modules`、Vercel 本地链接信息和环境变量都不应该推到 GitHub。尤其是 `.env`，它很容易在本地调试时被填入临时凭据。

然后在 Vercel 创建或关联同名项目。项目成功部署但访问返回 500 并不一定表示部署失败：Vercel 的构建已经完成，只是 Waline 还没有拿到存储配置。

## 2. 创建私有评论数据仓库和最小权限 Token

新建私有仓库 `inexistence/waline-data`，它只用来存评论数据。再到 GitHub 的 **Settings → Developer settings → Personal access tokens → Fine-grained tokens** 创建 Token：

- Resource owner：自己的 GitHub 账号；
- Repository access：只选择 `inexistence/waline-data`；
- Repository permissions：只开启 **Contents: Read and write**；
- 其他权限保持关闭。

这符合最小权限原则：即使 Token 泄露，攻击面也被限制在一个私有数据仓库中。Token 只复制到 Vercel 的 `GITHUB_TOKEN`，不要写进 README、前端仓库、GitHub Actions Variables 或截图。

## 3. 初始化 GitHub 存储的 CSV 文件

这里遇到了第一个坑。

Waline 的 GitHub 存储会把数据写成 CSV。当前 `@waline/vercel` 版本在读取一个尚不存在的文件时处理得并不理想：GitHub API 返回的是 404 JSON，没有 `content` 字段；随后代码尝试对 `undefined` 做 Buffer 解码，最终导致留言提交失败。

因此不能只创建一个空仓库，还需要预先放入三个只有表头的文件。若 Vercel 设置的是 `GITHUB_PATH=waline`，文件应为：

```text
waline/Comment.csv
objectId,user_id,comment,insertedAt,ip,link,mail,nick,pid,rid,status,ua,url,createdAt,updatedAt

waline/Counter.csv
objectId,time,url,createdAt,updatedAt

waline/Users.csv
objectId,display_name,email,password,type,url,avatar,label,github,twitter,facebook,google,weibo,qq,oidc,createdAt,updatedAt
```

目录不需要手动创建；在 GitHub 新建文件时把文件名写成 `waline/Comment.csv` 即可。之后 Waline 会持续更新这些 CSV 文件，不要改动表头。

## 4. 配置 Vercel 环境变量

进入 Vercel 项目的 **Settings → Environment Variables**，以下变量选择 **Production**：

```text
GITHUB_REPO=inexistence/waline-data
GITHUB_TOKEN=<fine-grained-token>
GITHUB_PATH=waline

SITE_NAME=INEXISTENCE
SITE_URL=https://inexistence.github.io
SERVER_URL=https://waline-for-blog-rho.vercel.app
JWT_TOKEN=<一段足够长的随机字符串>

SECURE_DOMAINS=inexistence.github.io,waline-for-blog-rho.vercel.app
IPQPS=60
COMMENT_AUDIT=false
DISABLE_REGION=true
DISABLE_USERAGENT=true
```

它们分别解决四类问题：

- **存储**：`GITHUB_REPO`、`GITHUB_TOKEN`、`GITHUB_PATH` 告诉 Waline 到哪里读写数据；
- **站点身份**：`SITE_NAME`、`SITE_URL`、`SERVER_URL` 让服务知道自己属于哪个博客；
- **安全与隐私**：`JWT_TOKEN` 用于管理员身份验证，`SECURE_DOMAINS` 限制可调用接口的域名，`DISABLE_REGION` 和 `DISABLE_USERAGENT` 避免记录地点与设备信息；
- **留言策略**：`IPQPS=60` 限制同一 IP 的提交频率，`COMMENT_AUDIT=false` 表示评论立即公开。

Vercel 的环境变量不是保存后立刻注入正在运行的服务。每次变更都要到 **Deployments** 对最新 Production 部署执行 **Redeploy**。

## 5. 初始化 Waline 管理员

服务能正常访问后，打开 Waline 服务域名末尾的 `/ui/` 路径，例如：

```text
https://<你的-waline-服务域名>/ui/
```

Waline 没有预设的管理员账号或密码，也不使用 GitHub、Vercel 的登录密码。首次进入时选择“注册”，自行设置昵称、邮箱和一组独立的强密码；**第一个注册成功的账号会自动成为管理员**。

本次没有配置 SMTP，因此首次注册不需要邮件验证，但也无法通过邮件自助找回密码。密码应保存到密码管理器，不能写入仓库、环境变量、文档或截图。登录后就可以在「评论」页面查看、审核、回复或删除留言。

## 6. 两个报错是如何定位的

实际配置时，两个错误很有代表性。

### `The "path" argument must be of type string`

这是缺少 `GITHUB_PATH`。GitHub 存储内部会执行类似下面的逻辑：

```js
path.join(GITHUB_PATH, `${tableName}.csv`)
```

如果 `GITHUB_PATH` 没有配置，传进去的就是 `undefined`。补上：

```text
GITHUB_PATH=waline
```

然后 Redeploy 即可。

### `Received undefined` / Buffer 相关错误

这说明 `GITHUB_PATH` 已生效，服务已经开始从 GitHub 读取文件，但目标 CSV 不存在，GitHub 响应中没有可解码的 `content`。按前一节预建 `Comment.csv`、`Counter.csv`、`Users.csv` 后，无需重新部署服务，下一次提交就会使用这些文件。

如果文件已经存在仍然报同类错误，应检查两项：Token 是否只选中了正确的 `waline-data` 仓库，以及 Vercel 中的 `GITHUB_REPO` 是否拼写正确。

## 7. GitHub CSV 与后台管理：第三个坑

完成注册后，我又遇到了一个看起来很矛盾的现象：`Comment.csv` 已经有数据，文章和留言板前台也能显示评论，但 Waline 的 `/ui/` 管理页却是一张空表。

这不是新问题。Waline 的 [Issue #205：GitHub 存储的评论后台无法显示](https://github.com/walinejs/waline/issues/205) 和更早的 [Issue #152](https://github.com/walinejs/waline/issues/152) 都记录了相同组合：Vercel 部署、GitHub CSV 存储、前台读取正常、后台列表为空。维护者当时也说明，后台管理会频繁调用 GitHub API，容易受频率和文件读取限制影响，因此不建议把 GitHub 存储当作高频后台管理方案。

这次的问题还包含一个可复现的代码错误：GitHub 存储适配器把后台分页参数写成了 `slice(limit, offset)`。后台第一页会得到类似 `slice(10, 0)` 的空数组；前台读取评论走的是另一条逻辑，因此不受影响。

当前的处理是固定 `@waline/vercel@1.41.3`，并用 `patch-package` 保存一个补丁，把它修正为从 `offset` 开始取 `limit` 条。`postinstall` 会让这个补丁在 Vercel 每次构建时自动生效。它解决了当前后台空列表，却不会改变 GitHub CSV 的架构边界：对于个人博客、低频评论很合适；如果评论量或管理操作明显增加，应考虑迁移到数据库型存储。

## 8. 在 Astro 中接入文章评论和留言板

前端只需要一个可复用的 Waline 组件。它接受固定 `path`，在 Astro 站内导航前销毁旧实例、页面加载后再初始化新实例，避免多个评论区重复挂载。

路径要选择稳定且与标题无关的值：

```text
文章：/posts/{slug}/
留言板：/guestbook/
```

于是改文章标题、描述或分类时，旧评论不会丢失关联。

文章页在正文后加入“岛民留言”区域；`/guestbook/` 则是一个独立页面。外层继续使用现有的 `animal-island-ui`：

- `Divider` 负责内容分界；
- `Tag` 标识评论区；
- `Card` 承载整个 Waline 区域。

Waline 内部的昵称、邮箱、编辑器和提交按钮由客户端生成，不能直接用 React 的 `Input`、`Button` 组件替换，否则会断开 Waline 的状态、验证和提交逻辑。正确做法是保留其功能结构，通过 Waline 的 CSS 变量和 `.wl-*` 选择器把纸张底色、棕色文字、圆角和薄荷色按钮对齐到现有主题。

## 9. 把服务地址交给 GitHub Pages

博客仓库的 GitHub Actions 在构建时读取公开变量：

| GitHub Actions Variable | 值 |
| --- | --- |
| `WALINE_SERVER_URL` | `https://waline-for-blog-rho.vercel.app` |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile 的公开 Site Key |

工作流将它们映射给 Astro：

```yaml
env:
  PUBLIC_WALINE_SERVER_URL: ${{ vars.WALINE_SERVER_URL }}
  PUBLIC_TURNSTILE_SITE_KEY: ${{ vars.TURNSTILE_SITE_KEY }}
```

然后运行 `Deploy Astro site to Pages`。如果 `WALINE_SERVER_URL` 没有配置，前端不会发起失败请求，而会显示“留言区正在准备中”的提示。

本地预览也只需填公开地址：

```bash
cp .env.example .env
npm run dev
```

`.env` 中填写：

```text
PUBLIC_WALINE_SERVER_URL=https://waline-for-blog-rho.vercel.app
PUBLIC_TURNSTILE_SITE_KEY=<可暂时留空>
```

Waline 默认会允许 `localhost` 和 `127.0.0.1`，因此本地页面可以直接调用线上服务。

## 10. Turnstile：在公开前补上防垃圾留言

没有人机验证时，Waline 可以正常运行，但公开站点很快会收到机器人留言。Cloudflare Turnstile 用来解决这个问题。

在 [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) 创建 **Managed** 小组件，添加以下 Hostnames（不写 `https://` 或端口号）：

```text
inexistence.github.io
waline-for-blog-rho.vercel.app
localhost
```

创建后会得到两项：

- **Site Key**：公开，填写到 Vercel 的 `TURNSTILE_KEY`，同时填写到博客仓库的 `TURNSTILE_SITE_KEY`；
- **Secret Key**：私密，只填写到 Vercel 的 `TURNSTILE_SECRET`。

本地 `.env` 也可以填写同一个公开 Site Key：`PUBLIC_TURNSTILE_SITE_KEY=<Site Key>`。保存 Vercel 变量后 Redeploy Waline；保存 GitHub Actions Variable 后重新部署 Pages。最后从真实文章页和留言板各提交一条测试留言，确认验证、立即公开、数据写入和管理员删除都正常。

## 最后的检查清单

- [ ] Waline 服务地址访问不再返回 500；
- [ ] Vercel 已配置 `GITHUB_PATH=waline`；
- [ ] 私有 `waline-data` 已有三个 CSV 表头文件；
- [ ] 文章评论路径为 `/posts/{slug}/`；
- [ ] 留言板路径为 `/guestbook/`；
- [ ] GitHub Pages 构建已注入 `WALINE_SERVER_URL`；
- [ ] Turnstile 在生产环境可用；
- [ ] 没有 Token 或 Secret 被提交到任一仓库；
- [ ] 确认 Waline 稳定后，再删除旧 Giscus 的评论资源。

评论系统不是博客的主角，但它是一个很好的小型系统设计练习：前端、无服务器后端、私有数据、公开配置、权限最小化与故障排查都集中在这里。把边界划清楚之后，后续维护反而比把一切塞进静态站点更轻松。

## 相关链接

- [本博客前端仓库](https://github.com/inexistence/inexistence.github.io)
- [Giscus](https://giscus.app/) 与 [配置说明](https://giscus.app/zh-CN)
- [Waline 官网](https://waline.js.org/) 与 [Vercel 部署文档](https://waline.js.org/guide/deploy/vercel.html)
- [Waline 服务端环境变量说明](https://waline.js.org/reference/server/env.html)
- [Waline Issue #205：GitHub 存储的评论后台无法显示](https://github.com/walinejs/waline/issues/205)
- [Waline Issue #152：后台无法看到 GitHub 后端的评论](https://github.com/walinejs/waline/issues/152)
- [Vercel](https://vercel.com/) 与 [环境变量文档](https://vercel.com/docs/environment-variables)
- [GitHub Fine-grained Personal Access Token 创建页](https://github.com/settings/personal-access-tokens/new)
- [GitHub Actions Variables 文档](https://docs.github.com/actions/learn-github-actions/variables)
- [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) 与 [开发者文档](https://developers.cloudflare.com/turnstile/)
