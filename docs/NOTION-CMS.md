# Notion 博客后台

博客在 Vercel 构建前从 Notion 的“博客文章（Notion CMS）”数据库同步内容。

## 一次性配置

1. 在 Notion Developer Portal 创建一个 Internal connection，并开启读取内容权限。
2. 在该 connection 的 Content access 中授权“博客文章（Notion CMS）”数据库。
3. 在 Vercel 项目的 Settings → Environment Variables 中添加：
   - `NOTION_TOKEN`：Notion connection 的 Installation access token。
   - `NOTION_DATA_SOURCE_ID`：`f31ead98-19cb-41bf-be47-5449d4a20555`。
4. 重新部署项目。

密钥只放在 Vercel 环境变量或本地 `.env.local` 中，不能提交到 Git。

## 日常使用

- 在 Notion 数据库中新建页面，填写正文和属性。
- `Slug` 只能包含小写字母、数字和连字符，并且必须唯一。
- `状态` 为“已发布”的文章才会出现在生产博客；“草稿”不会同步。
- “封面图片”可以直接上传图片；如果为空，则使用“封面”字段中的站内路径或完整 URL。
- 编辑完成后，在 Vercel 中 Redeploy，或推送一次 Git 提交以触发新构建。

## 本地验证

复制 `.env.example` 为 `.env.local`，填入 `NOTION_TOKEN` 后运行：

```bash
pnpm sync:notion
pnpm build
```

同步会将 Notion 上传的图片下载到 `public/notion-assets/`，避免临时签名 URL 过期。
