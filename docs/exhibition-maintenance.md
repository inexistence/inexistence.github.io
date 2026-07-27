# 岛屿展厅维护

岛屿展厅是独立的摄影互动展，不和文章建立关系。一个已发布展览必须有 8 到 12 张作品；构建阶段会检查顺序、岛民 ID 和台词是否完整。

## 新建一期展览

1. 将已导出且不含 EXIF 的摄影作品放在 `public/assets/exhibitions/<展览-id>/`。不要复用文章配图，也不要把私密地点写进文件名。
2. 在 `src/content/exhibitions/` 创建一个 Markdown 文件。文件名就是展览 ID；`cover` 指向其中一张作品，`featured: true` 会让它显示在首页。
3. 在 `src/content/photographs/` 每张作品创建一个 Markdown 文件。`exhibition` 填展览 ID，`order` 从 1 连续编号，`image` 和 `alt` 指向真实作品。
4. 每张作品都要为十位现有岛民各写一句 `dialogue`。访客会从十位中任选两位，所以不要删除任何一位的台词。
5. `pairDialogue` 是可选的。每期建议每张至少配置 2 组不同的搭档对话；不需要覆盖所有 45 种组合，未配置时仍会按顺序显示两人的独立评论。
6. 先把展览设为 `draft: true`，完成检查后再发布。

## 图片与隐私

- 使用用于网页发布的导出副本，不上传相机原图；导出时移除 EXIF、GPS 和器材信息。
- 普通摄影作品使用 `ResponsiveImage.astro` 自动生成 AVIF/WebP 候选；新增或替换后运行 `npm run images:ensure`，并提交生成的 `src/generated/responsive-images.json`。
- 不要把展览图加入 CSS 背景 token。展厅作品以普通响应式图片输出。

## 岛民台词

台词要同时保留两层：动森原角色的说话气质为主，站内的专业身份只作为观察角度。十位角色的稳定语气规则写在 `src/lib/islanders.ts` 的 `exhibitionVoice` 字段中。

- 让每句只讲一个画面细节，优先控制在 12–28 个汉字；气泡里的文字会逐字出现。
- 不要照抄原作口头禅或现成对白；使用短句、关注点和幽默感来建立角色感。
- 专属对话应是两位角色真正“接话”，而不是把两句独立评论排在一起。

`first-empty-room` 是首期正式摄影展。新增或替换照片时，保留 8 个照片内容文件的结构即可；每替换一张，改该文件的 `image`、`alt`、十位台词和搭档对话，不需要修改页面代码。

完成后运行：

```bash
npm run check
npm run build
```
