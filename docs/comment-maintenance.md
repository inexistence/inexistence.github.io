# 评论系统维护手册

本文是 INEXISTENCE 评论与留言板的日常操作手册。系统架构、首次配置和变量含义请先阅读 [评论系统说明](comments.md)。

## 公开维护参考

这份手册位于公开仓库，因此只保留公开服务和通用平台入口。Waline 管理后台、私有数据仓库与专属设置页的完整地址只记录在私有 `waline-data` 仓库的 README「维护入口」中。

| 用途 | 地址 | 说明 |
| --- | --- | --- |
| Waline 公开服务 | <https://waline-for-blog-rho.vercel.app/> | 用于确认服务是否可访问；不是评论管理页面。 |
| Vercel 控制台 | <https://vercel.com/dashboard> | 找到 `waline-for-blog-rho` 项目，查看 Logs、环境变量与部署。 |
| Waline 服务仓库 | <https://github.com/inexistence/waline-for-blog> | 服务代码、部署配置与 GitHub CSV 补丁。 |
| 博客前端仓库 | <https://github.com/inexistence/inexistence.github.io> | 评论区样式、客户端配置与文档。 |
| Pages 部署工作流 | <https://github.com/inexistence/inexistence.github.io/actions> | 重新发布博客前端。 |
| Turnstile 控制台 | <https://dash.cloudflare.com/?to=/:account/turnstile> | 管理小组件、域名与 Site Key。 |
| GitHub fine-grained Token | <https://github.com/settings/personal-access-tokens> | 创建、轮换或撤销仅用于 `waline-data` 的 Token。 |

## 快速定位

| 想做什么 | 去哪里 |
| --- | --- |
| 查看、删除或管理评论 | 私有 `waline-data` README「维护入口」中的 Waline 管理后台。 |
| 查看 Waline 服务日志、修改服务端变量、Redeploy | Vercel 的 `waline-for-blog-rho` 项目 |
| 查看或恢复评论数据 | 私有 GitHub 仓库 `inexistence/waline-data` |
| 修改评论区页面、样式或客户端逻辑 | `inexistence/inexistence.github.io` 仓库 |
| 修改 Waline 服务代码或服务端说明 | `inexistence/waline-for-blog` 仓库 |
| 修改 Turnstile 小组件 | Cloudflare Dashboard → Turnstile |

## 初始化 Waline 管理员

管理后台地址记录在私有 `waline-data` README 的「维护入口」中。

Waline 没有默认账号或密码，也不使用 GitHub 或 Vercel 的登录密码。服务首次可用后，在后台选择“注册”，自行设置管理员昵称、邮箱和独立密码。**第一个后台注册账号会自动成为管理员**。

当前不配置 SMTP，因此首次注册不需要邮件验证，但也不能通过邮件自助找回密码。请把管理员密码保存到密码管理器中；不要把密码写入仓库、环境变量示例、截图或维护文档。

当前使用 GitHub CSV 存储，适合低频、小规模的日常管理。若后台评论表为空，先不要删除 CSV 或重新创建管理员账号，按下方“故障处理”的对应项排查。

## 日常检查

每月或发现异常时，检查以下项目：

1. 打开文章页和 `/guestbook/`，确认评论区加载正常。
2. 在 Waline 管理后台检查待处理、垃圾或异常评论，按需删除。
3. 在 Vercel 的 **Logs** 查看是否连续出现 `500`、GitHub API 权限或 Turnstile 验证错误。
4. 查看私有 `waline-data` 仓库是否有新的 CSV 提交，确认数据持续写入。
5. 不在公开页面、提交记录或截图中暴露 `GITHUB_TOKEN`、`JWT_TOKEN`、`TURNSTILE_SECRET`。

## 常见变更流程

### 修改博客评论区样式或前端逻辑

在 `inexistence.github.io` 修改页面、Waline 组件或 CSS 后：

```bash
npm run build
git add .
git commit -m "Update comment UI"
git push origin master
```

GitHub Pages 工作流完成后验证一篇文章与 `/guestbook/`。

### 修改 Waline 服务端变量

1. 在 Vercel 项目 **Settings → Environment Variables** 修改变量。
2. 变量必须配置在 **Production** 环境。
3. 前往 **Deployments**，对最新 Production 部署执行 **Redeploy**。
4. 打开 Waline 服务地址确认不再返回 500，再提交测试留言。

常见的服务端变量包括 `GITHUB_REPO`、`GITHUB_PATH=waline`、`GITHUB_TOKEN`、`JWT_TOKEN`、`TURNSTILE_KEY` 和 `TURNSTILE_SECRET`。

### 修改公开前端变量

公开变量在博客仓库的 **Settings → Secrets and variables → Actions → Variables** 中维护：

| Variable | 用途 |
| --- | --- |
| `WALINE_SERVER_URL` | Waline 的 Vercel 服务地址。 |
| `TURNSTILE_SITE_KEY` | Turnstile 的公开 Site Key。 |

修改后运行一次 `Deploy Astro site to Pages`。不要把 Secret Key 写到这里。

### 修改 Turnstile

在 Cloudflare Turnstile 中保持以下 Hostnames：

```text
inexistence.github.io
waline-for-blog-rho.vercel.app
localhost
```

更换 Site Key 或 Secret Key 后：

1. 在 Vercel 更新 `TURNSTILE_KEY` 和/或 `TURNSTILE_SECRET`，然后 Redeploy Waline。
2. 在 GitHub Actions Variables 更新 `TURNSTILE_SITE_KEY`，然后重新部署 Pages。
3. 用真实文章页和留言板各提交一次测试留言。

### 修改岛民头像池

匿名留言头像由博客 `public/assets/avatars/` 与 Waline 服务仓库 `index.cjs` 共同决定。服务根据昵称与邮箱组合后的 SHA-256 哈希稳定选择一张头像，不会把邮箱传给第三方头像服务。

1. 在博客仓库添加、删除或替换头像文件；文件应使用稳定的文件名。
2. 在 `waline-for-blog/index.cjs` 同步更新 `avatarFiles` 数组。
3. **先**推送并完成 GitHub Pages 部署，确认新图片可访问。
4. **再**推送 Waline 服务并等待 Vercel Production 部署完成。
5. 打开文章页与留言板，强制刷新确认同一昵称和邮箱组合始终显示同一头像。

不要手动在 `Comment.csv` 中添加头像列；已注册用户如需个人头像，应在 Waline 后台「用户」中单独设置。

## 数据与备份

评论数据在私有 `waline-data` 仓库的以下文件中：

```text
waline/Comment.csv
waline/Counter.csv
waline/Users.csv
```

- 不要修改 CSV 表头或手动改写运行中的内容。
- GitHub 提交历史已经提供版本回溯；重要修改前可先在 GitHub 创建 Tag，或在本地额外备份整个私有仓库。
- 需要恢复误删数据时，优先在 GitHub 找到正确提交并恢复文件内容，再到 Vercel Redeploy（仅服务变量未变时通常无需 Redeploy）。

## 密钥轮换

### GitHub Token

建议每年轮换一次，或怀疑泄露时立即轮换：

1. 创建新的 fine-grained Token，只授权 `waline-data` 的 **Contents: Read and write**。
2. 在 Vercel 更新 `GITHUB_TOKEN`，Redeploy 并提交一条测试留言。
3. 确认数据写入正常后，在 GitHub 撤销旧 Token。

### JWT Token 与 Turnstile Secret

- `JWT_TOKEN` 或 `TURNSTILE_SECRET` 怀疑泄露时，先在 Vercel 更新并 Redeploy，再撤销或替换原有值。
- JWT Token 变更后，已登录的 Waline 管理后台会话可能失效，需要重新登录。

## 故障处理

| 现象 | 优先检查 | 处理 |
| --- | --- | --- |
| 评论区显示“留言区正在准备中” | `WALINE_SERVER_URL` | 在 GitHub Actions Variables 补充服务地址并重新部署 Pages。 |
| Waline 服务地址返回 500 | Vercel Logs 与环境变量 | 核对 `GITHUB_REPO`、`GITHUB_TOKEN`、`GITHUB_PATH=waline`，然后 Redeploy。 |
| `The "path" argument must be of type string` | `GITHUB_PATH` | 在 Vercel 添加 `GITHUB_PATH=waline` 并 Redeploy。 |
| `Received undefined` 或 Buffer 错误 | 私有数据仓库 | 确认三个 CSV 文件存在且表头未被修改。 |
| CSV 已写入、前台评论可见，但 `/ui/` 评论表为空 | Waline 服务仓库与最新 Vercel 部署 | 这是 GitHub CSV 管理列表的已知问题。确认 `@waline/vercel` 固定为 `1.41.3`，并保留 `patches/@waline+vercel+1.41.3.patch`、`package-lock.json` 和 `postinstall`；推送后等待 Production 部署完成并强制刷新后台。若仍异常，先以私有 `waline-data` 的 CSV 和 Vercel Logs 为准，不要删除数据。 |
| Turnstile 无法通过或域名错误 | Cloudflare Hostnames、两端 Key | 确认 Hostnames 和 Site Key / Secret Key 的位置正确，然后分别重新部署 Waline 与 Pages。 |
| 评论写入失败、401 或 404 | GitHub Token 与仓库名 | 检查 Token 仍有效、只选中 `waline-data`，且有 Contents 读写权限。 |

## 回滚

- **博客前端**：在 GitHub Actions 中重新运行某次成功的 Pages 部署，或恢复博客仓库的对应提交后推送。
- **Waline 服务**：在 Vercel 的 Deployments 中选择上一次成功版本并 Promote / Redeploy。
- **评论数据**：在私有 `waline-data` 仓库中从 Git 历史恢复相应 CSV 文件。

先恢复可用服务，再检查评论数据；不要用删除整个数据仓库的方式解决单条评论问题。

## 旧 Giscus 清理条件

仅当下列条件全部满足时，才删除原有仅用于评论的 Giscus Discussion、分类和 App 授权：

- 文章评论和留言板均已成功提交测试留言；
- Turnstile 验证正常；
- 管理员可以删除留言；
- 评论持续写入私有 `waline-data` 仓库；
- Vercel 与 GitHub Pages 均已稳定运行一段时间。
