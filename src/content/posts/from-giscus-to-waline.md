---
title: "给 Astro 博客搭建评论区与留言板"
description: "记录一次从 GitHub Discussions 评论迁移到 Waline 的实践：三仓库架构、Vercel 部署、私有数据存储、前端接入，以及三个容易踩到的 GitHub 存储问题。"
publishDate: "2026-07-23"
category: "技术"
place: ""
tags: ["Astro", "Waline", "Vercel", "GitHub Pages", "评论系统"]
cover: ""
draft: false
---

博客的评论区看似只是页面底部的一小块，实际牵涉到身份、垃圾留言、数据持久化、部署、隐私和站点风格。这个博客最初接入的是 Giscus：它足够轻量，评论会直接落到 GitHub Discussions。但实际使用下来，我还是把它换成了 Waline。

这篇文章记录完整的搭建过程。目标很明确：文章评论和留言板共用一套服务；底层 CSV、邮箱和用户记录放在私有数据仓库中；访客只需填写昵称和邮箱；页面仍然部署在 GitHub Pages；服务端尽量保持免费、低维护。

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

最快的方式是使用 Waline 官方提供的 Vercel 模板，而不是从空目录手写项目。打开 [Waline 的 Vercel 部署文档](https://waline.js.org/guide/deploy/vercel.html)，点击页面中的 **Deploy** 按钮并授权 Vercel 访问 GitHub。输入项目名 `waline-for-blog` 后，Vercel 会自动完成三件事：

1. 在自己的 GitHub 账号下创建一份模板仓库；
2. 把仓库导入 Vercel 项目；
3. 执行第一次部署，并生成一个 `*.vercel.app` 服务地址。

第一次部署开始后，打开 Vercel 中刚创建的项目，进入 **Settings → Domains**，复制其中的 Production 域名，例如 `waline-for-blog-rho.vercel.app`。加上 `https://` 后得到完整服务地址 `https://waline-for-blog-rho.vercel.app`。本文后面出现的 `<你的 Waline 服务域名>` 和 `<你的 Vercel Production 服务地址>` 都指这个值；即使服务暂时因尚未配置存储而返回 500，域名本身也已经可以确定。

也就是说，不需要先寻找某个仓库手工 clone；先让 Vercel 从官方模板创建属于自己的仓库，再把它 clone 到本地继续调整：

```bash
git clone https://github.com/<你的账号>/waline-for-blog.git
cd waline-for-blog
npm install --save-exact @waline/vercel@1.41.3
```

这里把模板中的 Waline 依赖固定到本文实际使用的 `1.41.3`，命令会同步更新 `package.json` 和 `package-lock.json`。不要把版本写成 `latest` 或带 `^` 的范围；后文还会为这个精确版本加入 `patch-package` 补丁。

接着创建服务入口 `index.cjs`。最小配置只需加载 Waline 并导出应用：

```js
const Application = require('@waline/vercel');

module.exports = Application({
  plugins: [],
});
```

当前博客还在这里配置了自定义匿名头像，但它不是启动评论服务的必要条件，可以等基础链路跑通后再加。

再创建 `vercel.json`，让 Vercel 使用 `npm ci` 安装锁定依赖、用 Node.js 运行入口，并把除 `robots.txt` 之外的请求都交给 Waline。与 `npm install` 不同，`npm ci` 会先清理现有的 `node_modules`，再严格按照 `package-lock.json` 重新安装依赖，而且不会改动锁文件。这样可以避免 Vercel 复用残留依赖导致后文的 `patch-package` 补丁应用失败，并确保每次部署都使用相同的 Waline 版本。

```json
{
  "env": {
    "NODE_OPTIONS": "--experimental-require-module"
  },
  "installCommand": "npm ci",
  "builds": [
    {
      "src": "robots.txt",
      "use": "@vercel/static"
    },
    {
      "src": "index.cjs",
      "use": "@vercel/node",
      "config": {
        "includeFiles": [
          "node_modules/@mathjax/mathjax-newcm-font/**/*",
          "node_modules/mhchemparser/**/*",
          "node_modules/ip2region/data/**"
        ]
      }
    }
  ],
  "rewrites": [
    {
      "source": "/((?!robots\\.txt$).*)",
      "destination": "index.cjs"
    }
  ]
}
```

`includeFiles` 来自当前项目的实际配置，用于把 MathJax 字体、化学公式解析器和 IP 数据文件一起打包进 Vercel Function。若官方模板已经包含这些条目，应保留并合并其他调整，不要用更精简的示例覆盖它们。

为了避免搜索引擎收录独立的评论服务域名，再添加 `robots.txt`：

```text
User-agent: *
Disallow: /
```

部署前最好补一个 `.gitignore`：

```text
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

此时目录至少应包含以下文件：

```text
waline-for-blog/
├── .gitignore
├── index.cjs
├── package.json
├── package-lock.json
├── robots.txt
└── vercel.json
```

确认 `npm ci` 能完成安装后，提交并推送对模板的调整：

```bash
git add .
git commit -m "chore: configure Waline service"
git push
```

Vercel 已经关联这个仓库，推送后会自动重新部署；项目的 Framework Preset 保持 **Other**、Root Directory 保持 `./`，Install Command 使用仓库中配置的 `npm ci`。此时服务地址返回 500 并不一定表示部署失败：构建可能已经完成，只是 Waline 还没有拿到下一节要配置的存储信息。

## 2. 创建私有评论数据仓库和最小权限 Token

在 GitHub 选择 **New repository**，名称填写 `waline-data`，可见性选择 **Private**。这个仓库不需要部署、GitHub Actions 或 npm 项目；它只是 Waline 服务端读写评论数据的存储空间。

仓库建好后，到 GitHub 的 **Settings → Developer settings → Personal access tokens → Fine-grained tokens** 创建 Token：

- Resource owner：自己的 GitHub 账号；
- Repository access：只选择 `<你的账号>/waline-data`；
- Repository permissions：只开启 **Contents: Read and write**；
- 其他权限保持关闭。

点击 **Generate token** 后立即复制并暂存到密码管理器；GitHub 离开页面后不会再次显示完整 Token。这个权限范围符合最小权限原则：即使 Token 泄露，攻击面也被限制在一个私有数据仓库中。

接下来要把“数据放哪里”和“凭什么访问”交给 Waline：

| 刚创建的内容 | 下一步用途 |
| --- | --- |
| 私有仓库 `<你的账号>/waline-data` | 在下一节创建 `waline/*.csv`，作为评论、用户和计数数据的真实存储 |
| 仓库全名 `<你的账号>/waline-data` | 在 Vercel 中填写为 `GITHUB_REPO` |
| Fine-grained Token | 在 Vercel 中填写为 `GITHUB_TOKEN`，供服务端读写上述仓库 |
| CSV 所在目录 `waline` | 在 Vercel 中填写为 `GITHUB_PATH` |

因此不需要把 Token 写进仓库，也不需要把 `waline-data` clone 到 Vercel 项目。下一节先初始化 CSV 文件，第 4 节再把这三个值填入 Vercel；Redeploy 后，`waline-for-blog` 才能通过 GitHub API 读写评论数据。不要把 Token 放进 README、前端仓库、GitHub Actions Variables、`.env.example` 或截图。

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

打开 [Vercel Dashboard](https://vercel.com/dashboard)，进入前面创建的 `waline-for-blog` 项目，然后按下面的方式填写：

1. 打开项目的 **Settings → Environment Variables**；
2. 点击 **Add New** 或 **Add Environment Variable**；
3. 在 **Name** 中填写变量名，例如 `GITHUB_REPO`；
4. 在 **Value** 中只填写对应的值，例如 `inexistence/waline-data`，不要把整行 `GITHUB_REPO=...` 都粘进去；
5. **Environment** 只选择 **Production**；
6. 保存后继续添加下一项，每个变量单独占一条记录。

需要填写的 Name 与 Value 如下。这里展示的是本文站点的实际配置；复现时应把仓库名、博客域名和 Waline 服务域名替换成自己的值：

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

其中 `GITHUB_TOKEN` 填上一节生成的 Fine-grained Token。`JWT_TOKEN` 不是 GitHub 或 Vercel 提供的值，而是 Waline 用来签发管理员登录令牌的服务端密钥；在本地终端生成一段 32 字节随机值即可：

```bash
openssl rand -hex 32
```

命令会输出 64 个十六进制字符。将输出完整复制到 Vercel 的 `JWT_TOKEN`，不要加引号、不要重复使用其他账号密码，也不要保存到仓库或 `.env.example`；如需留存，应放进密码管理器。更换这个值会让已有管理员登录状态失效，需要重新登录。

若 Vercel 界面提供 **Sensitive** 选项，为 `GITHUB_TOKEN`、`JWT_TOKEN` 和之后添加的 `TURNSTILE_SECRET` 开启它，使保存后的值不可再次读取。不要给变量名添加引号，也不要在值前后留下空格。

它们分别解决四类问题：

- **存储**：`GITHUB_REPO`、`GITHUB_TOKEN`、`GITHUB_PATH` 告诉 Waline 到哪里读写数据；
- **站点身份**：`SITE_NAME`、`SITE_URL`、`SERVER_URL` 让服务知道自己属于哪个博客；
- **安全与隐私**：`JWT_TOKEN` 用于管理员身份验证，`SECURE_DOMAINS` 限制可调用接口的域名，`DISABLE_REGION` 和 `DISABLE_USERAGENT` 避免记录地点与设备信息；
- **留言策略**：`IPQPS=60` 限制同一 IP 的提交频率，`COMMENT_AUDIT=false` 表示评论立即公开。

全部保存后，进入项目的 **Deployments**，找到最新一条标有 **Production** 的部署，打开右侧菜单并选择 **Redeploy**。确认重新部署完成且状态变为 **Ready**；环境变量只会注入新部署，刷新旧地址本身不会让刚保存的配置生效。

## 5. 初始化 Waline 管理员

服务能正常访问后，打开 Waline 服务域名末尾的 `/ui/` 路径，例如：

```text
https://<你的 Waline 服务域名>/ui/
```

Waline 没有预设的管理员账号或密码，也不使用 GitHub、Vercel 的登录密码。首次进入时选择“注册”，自行设置昵称、邮箱和一组独立的强密码；**第一个注册成功的账号会自动成为管理员**。

本次没有配置 SMTP，因此首次注册不需要邮件验证，但也无法通过邮件自助找回密码。密码应保存到密码管理器，不能写入仓库、环境变量、文档或截图。登录后就可以在「评论」页面查看、审核、回复或删除留言。

## 6. 在 Astro 中接入文章评论和留言板

初始化管理员只代表服务端已经可用，博客此时还不会自动出现评论区。Waline 官方的[快速上手](https://waline.js.org/guide/get-started/)给出了基础 HTML 接入方式；本文在此基础上将客户端封装成 Astro 组件。`init()` 的返回实例、销毁方法和初始化参数可以对照[客户端 API](https://waline.js.org/reference/client/api.html)，`serverURL`、`path`、`turnstileKey` 等选项则以[组件属性文档](https://waline.js.org/reference/client/props.html)为准。

接下来回到 `inexistence.github.io` 仓库，安装与本文实现对应的 Waline 客户端：

```bash
cd ../inexistence.github.io
npm install --save-exact @waline/client@3.15.2
```

这会同时更新博客仓库的 `package.json` 和 `package-lock.json`。然后需要完成五处前端改动：

1. 新建 `src/components/Waline.astro`，封装客户端初始化与销毁；
2. 在 `src/pages/posts/[slug].astro` 的正文后挂载文章评论；
3. 新建 `src/pages/guestbook.astro`，挂载独立留言板；
4. 在 `src/styles/global.css` 中用 Waline 的 CSS 变量和 `.wl-*` 选择器适配博客主题；
5. 在 `.env.example` 和 `src/env.d.ts` 中声明公开的服务地址与 Turnstile Site Key。

可复用组件的核心是导入 Waline 样式和 `init`，再从 Astro 的公开环境变量读取服务地址：

```astro
---
import '@waline/client/style';

interface Props {
  path: string;
}

const { path } = Astro.props;
const serverURL = import.meta.env.PUBLIC_WALINE_SERVER_URL;
const turnstileKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY;
---

<div
  data-waline
  data-path={path}
  data-server-url={serverURL}
  data-turnstile-key={turnstileKey}
></div>

<script>
  import { init } from '@waline/client';

  const host = document.querySelector<HTMLElement>('[data-waline]');

  if (host?.dataset.serverUrl && host.dataset.path) {
    init({
      el: host,
      serverURL: host.dataset.serverUrl,
      path: host.dataset.path,
      lang: 'zh-CN',
      ...(host.dataset.turnstileKey
        ? { turnstileKey: host.dataset.turnstileKey }
        : {}),
    });
  }
</script>
```

上面是最小实现。当前博客的完整组件还会在 Astro 站内导航前销毁旧实例、页面加载后重新初始化，避免多个评论区重复挂载；同时限制表单字段、关闭不使用的功能，并接入 Turnstile。

路径要选择稳定且与标题无关的值：

```text
文章：/posts/{slug}/
留言板：/guestbook/
```

文章页传入当前文章 ID：

```astro
<Waline path={`/posts/${post.id}/`} />
```

留言板则使用固定路径：

```astro
<Waline path="/guestbook/" />
```

于是改文章标题、描述或分类时，旧评论不会丢失关联。

`.env.example` 只保留公开配置的占位值：

```text
PUBLIC_WALINE_SERVER_URL=https://your-waline-project.vercel.app
PUBLIC_TURNSTILE_SITE_KEY=your-turnstile-site-key
```

`src/env.d.ts` 则为 Astro 的环境变量补上类型声明：

```ts
interface ImportMetaEnv {
  readonly PUBLIC_WALINE_SERVER_URL?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

真实值不要写进 `.env.example`；本地开发放进被 Git 忽略的 `.env`，生产值由后面的 GitHub Actions Variables 注入。

文章页在正文后加入“岛民留言”区域；`/guestbook/` 则是一个独立页面。外层继续使用现有的 `animal-island-ui`：

- `Divider` 负责内容分界；
- `Tag` 标识评论区；
- `Card` 承载整个 Waline 区域。

Waline 内部的昵称、邮箱、编辑器和提交按钮由客户端生成，不能直接用 React 的 `Input`、`Button` 组件替换，否则会断开 Waline 的状态、验证和提交逻辑。正确做法是保留其功能结构，通过 Waline 的 CSS 变量和 `.wl-*` 选择器把纸张底色、棕色文字、圆角和薄荷色按钮对齐到现有主题。

## 7. 把服务地址交给 GitHub Pages

打开博客的 GitHub 仓库，进入 **Settings → Secrets and variables → Actions → Variables**，点击 **New repository variable**，先新增服务地址：

```text
Name: WALINE_SERVER_URL
Value: <你的 Vercel Production 服务地址>
```

例如本文的 Value 是 `https://waline-for-blog-rho.vercel.app`。读者应使用自己在 Vercel 项目 **Settings → Domains** 中看到的生产地址。

配置 Turnstile 后，还要在同一个页面新增 Site Key：

```text
Name: TURNSTILE_SITE_KEY
Value: <Cloudflare 的 Site Key>
```

这两项都是构建后会发送给浏览器的公开配置，因此使用 Actions **Variables**，不是 Secrets。最终应有：

| GitHub Actions Variable | 值 |
| --- | --- |
| `WALINE_SERVER_URL` | `https://waline-for-blog-rho.vercel.app` |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile 的公开 Site Key |

然后编辑博客仓库的 `.github/workflows/deploy.yml`，在运行 `npm run build` 的步骤中通过 `env` 将它们映射给 Astro：

```yaml
- name: Build
  env:
    PUBLIC_WALINE_SERVER_URL: ${{ vars.WALINE_SERVER_URL }}
    PUBLIC_TURNSTILE_SITE_KEY: ${{ vars.TURNSTILE_SITE_KEY }}
  run: npm run build
```

保存 Variables 后，旧的 Pages 构建不会自动获得新值。进入仓库的 **Actions**，打开 `Deploy Astro site to Pages` 工作流，选择 **Run workflow**；也可以推送一次博客提交触发新部署。等待工作流成功后，再打开生产页面检查评论区。如果 `WALINE_SERVER_URL` 没有配置，前端不会发起失败请求，而会显示“留言区正在准备中”的提示。

本地预览也只需填公开地址：

```bash
cp .env.example .env
npm run dev
```

`.env` 中填写：

```text
PUBLIC_WALINE_SERVER_URL=https://waline-for-blog-rho.vercel.app
PUBLIC_TURNSTILE_SITE_KEY=
```

`PUBLIC_TURNSTILE_SITE_KEY` 在本地可以暂时留空。Waline 默认允许来自 `localhost` 和 `127.0.0.1` 的请求，因此未启用 Turnstile 时，本地页面可以直接调用线上服务。启用 Turnstile 后，本地验证方式见下一节。

## 8. Turnstile：在公开前补上防垃圾留言

没有人机验证时，Waline 也能正常运行，但公开站点更容易收到机器人留言。Cloudflare Turnstile 可以在不要求访客登录的前提下增加一道验证。

### 在 Cloudflare 创建小组件

打开 [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)，选择 **Add widget**，然后填写：

1. **Widget name**：填写便于识别的名称，例如 `my-blog-waline`；
2. **Hostname Management**：分别添加博客域名和 Waline 服务域名；
3. **Widget mode**：选择 **Managed**；
4. 其余选项保持默认，点击 **Create**。

Hostnames 只填主机名，不要带 `https://`、端口或路径：

```text
<你的博客域名>
<你的 Waline 服务域名>
```

例如本文对应的是 `inexistence.github.io` 和 `waline-for-blog-rho.vercel.app`；如果 Vercel 为你的项目生成了其他域名，应以自己在 Vercel 项目 **Settings → Domains** 中看到的生产域名为准，不能照抄本文的地址。

创建成功后，Cloudflare 会显示 **Site Key** 和 **Secret Key**。先把两者分别复制到密码管理器；Secret Key 离开页面后不应再公开。

### 把两个 Key 填入 Vercel

回到 Vercel 的 `waline-for-blog` 项目，进入 **Settings → Environment Variables**，新增两条 Production 变量：

| Name | Value | Sensitive |
| --- | --- | --- |
| `TURNSTILE_KEY` | Cloudflare 的 Site Key | 否 |
| `TURNSTILE_SECRET` | Cloudflare 的 Secret Key | 是 |

每一行都要分别保存。然后进入 **Deployments**，对最新的 Production 部署执行 **Redeploy**；这一步让 Waline 服务端获得 Secret Key，并开始验证访客提交的 Turnstile Token。

### 把 Site Key 填入博客仓库

打开博客的 GitHub 仓库，进入 **Settings → Secrets and variables → Actions → Variables**，选择 **New repository variable**：

```text
Name: TURNSTILE_SITE_KEY
Value: <Cloudflare 的 Site Key>
```

Site Key 本来就会发送给浏览器，因此这里使用公开的 Actions Variable，不要误放 Secret Key。博客工作流会把它映射为 `PUBLIC_TURNSTILE_SITE_KEY`，再由 `Waline.astro` 传给客户端的 `turnstileKey` 选项。

保存后重新运行 `Deploy Astro site to Pages`，或推送一次博客提交触发新的 Pages 部署。至此，浏览器使用 Site Key 显示验证，Waline 服务端使用 Secret Key 校验结果，两端缺一不可。

Cloudflare 不建议让生产 Site Key 接受 `localhost` 或 `127.0.0.1`。本地联调可以暂时留空 `PUBLIC_TURNSTILE_SITE_KEY`，只检查评论区加载；若要完整测试验证流程，则使用 Cloudflare 提供的测试 Site Key 和对应测试 Secret，或单独创建仅用于开发的小组件。

最后从真实文章页和留言板各提交一条测试留言，确认验证、立即公开、数据写入和管理员删除都正常。

## 9. 两个报错是如何定位的

如果前面的服务端配置一次成功，可以跳过这一节。实际配置时，下面两个错误很有代表性。

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

这说明 `GITHUB_PATH` 已生效，服务已经开始从 GitHub 读取文件，但目标 CSV 不存在，GitHub 响应中没有可解码的 `content`。按第 3 节预建 `Comment.csv`、`Counter.csv`、`Users.csv` 后，无需重新部署服务，下一次提交就会使用这些文件。

如果文件已经存在仍然报同类错误，应检查两项：Token 是否只选中了正确的 `waline-data` 仓库，以及 Vercel 中的 `GITHUB_REPO` 是否拼写正确。

## 10. GitHub CSV 与后台管理：第三个坑

完成注册后，我又遇到了一个看起来很矛盾的现象：`Comment.csv` 已经有数据，文章和留言板前台也能显示评论，但 Waline 的 `/ui/` 管理页却是一张空表。

这不是新问题。Waline 的 [Issue #205：GitHub 存储的评论后台无法显示](https://github.com/walinejs/waline/issues/205) 和更早的 [Issue #152](https://github.com/walinejs/waline/issues/152) 都记录了相同组合：Vercel 部署、GitHub CSV 存储、前台读取正常、后台列表为空。维护者当时也说明，后台管理会频繁调用 GitHub API，容易受频率和文件读取限制影响，因此不建议把 GitHub 存储当作高频后台管理方案。

### 为什么前台有评论，后台却为空

本次使用的 `@waline/vercel@1.41.3` 还包含一个可以稳定复现的分页错误。GitHub 存储适配器把后台传入的 `limit` 和 `offset` 当成了 `Array.prototype.slice()` 的两个参数：

```js
data = data.slice(limit ?? 0, offset ?? data.length);
```

但 `slice()` 接收的是 `slice(开始下标, 结束下标)`，不是 `slice(条数, 偏移量)`。后台第一页通常传入 `limit=10`、`offset=0`，于是实际执行 `slice(10, 0)`，结果必然是空数组。前台读取评论走的是另一条查询逻辑，所以仍能正常显示。

正确逻辑应从 `offset` 开始，结束位置为 `offset + limit`：

```js
data = data.slice(offset ?? 0, (offset ?? 0) + (limit ?? data.length));
```

### 用 `patch-package` 固化修复

不要直接修改依赖后就提交 `node_modules`，因为 Vercel 每次构建都会重新安装依赖。应在 `waline-for-blog` 仓库中把改动保存成补丁：

```bash
npm install --save-dev --save-exact patch-package@8.0.0
```

确认 `package.json` 固定 Waline 版本，并增加 `postinstall`：

```json
{
  "scripts": {
    "postinstall": "patch-package"
  },
  "dependencies": {
    "@waline/vercel": "1.41.3"
  },
  "devDependencies": {
    "patch-package": "8.0.0"
  }
}
```

然后在本地安装目录的 `node_modules/@waline/vercel/src/service/storage/github.js` 中找到错误的 `data.slice(...)`，只做上面展示的一行修正，再生成补丁：

```bash
npx patch-package @waline/vercel
```

命令会创建 `patches/@waline+vercel+1.41.3.patch`。本文仓库中的同名补丁还包含减少 GitHub CSV 重复读取的缓存优化，但修复后台空列表所必需的最小改动就是上面这一行。

最终必须一起提交四项：

- `package.json`；
- `package-lock.json`；
- `patches/@waline+vercel+1.41.3.patch`；
- 保持 `vercel.json` 的 Install Command 为 `npm ci`。

先在本地运行 `npm ci`。它会清理 `node_modules`、重新安装锁定版本，并在 `postinstall` 阶段自动应用补丁；安装成功才能证明补丁不依赖旧的本地文件。

### 部署与验证

提交并推送上述文件后，Vercel 会自动构建。打开安装日志，确认 `patch-package` 没有报告 `Failed to apply patch`，然后进入 `/ui/` 的评论页面检查列表。

如果补丁应用失败，先确认 Waline 仍是精确的 `1.41.3`，并确认清单、锁文件和补丁都已提交；再对失败部署执行 **Redeploy**，关闭 **Use existing Build Cache**，让 Vercel 使用全新的依赖目录。不要跳过 `postinstall`，也不要把修改后的 `node_modules` 提交到仓库。

这个补丁只解决当前版本明确的分页空列表问题，不会改变 GitHub API 的频率与文件大小限制。它适合个人博客和低频评论；如果评论量或后台操作明显增加，应考虑迁移到数据库型存储。升级 Waline 前也应先确认上游是否已经修复分页问题，验证新版后台后再删除旧补丁，不能把 `1.41.3` 的补丁直接套到其他版本。

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
