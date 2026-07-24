---
title: 这个博客是怎么搭起来的 · How I Built This Blog
published: 2026-06-28
description: 基于 Astro + fuwari 模板,调成了蓝调时刻的配色。Built on Astro + the fuwari template, tuned to blue hour colors.
image: "/images/lake-mirror.jpg"
tags: [学习, 安利]
category: 技术开发
draft: false
---

> 这是一篇「技术开发」板块的示例文章,也是这个博客本身的说明书。
> A sample post for the *Tech* section — and the story of this very blog.

## 技术栈 · Stack

- **框架**:[Astro](https://astro.build/) — 静态优先,加载飞快
- **模板**:[fuwari](https://github.com/saicaca/fuwari) — 动画流畅、功能齐全的博客模板
- **样式**:Tailwind CSS + 一层「蓝调时刻」自定义主题
- **搜索**:Pagefind,纯静态全文搜索,不需要服务器

::github{repo="saicaca/fuwari"}

## 蓝调主题做了什么 · The Blue Hour Layer

1. **暮色深蓝主色**:主色调 hue 设为 258,亮色模式是清晨蓝调,暗色模式是入夜蓝调
2. **天光渐变**:亮色模式页面顶部有一层极淡的天光,往下慢慢消失
3. **星点背景**:暗色模式的底色上散着细小星点,还有几粒会缓慢明灭
4. **自然摄影**:横幅和文章封面都是蓝调时刻的山川湖泊(来自 Pexels 免费图库)

主题色的核心其实只有一行配置:

```typescript
// src/config.ts
themeColor: {
  hue: 258, // 暮色深蓝
},
```

:::tip[写文章]
新建文章只需要运行 `pnpm new-post 文件名`,然后在生成的 markdown 里填内容就行。
:::

## 部署 · Deploy

推到 GitHub 后接入 Vercel / Netlify,每次 push 自动构建发布,个人博客免费额度完全够用。

*Push to GitHub, connect Vercel or Netlify, and every commit deploys itself. The free tier is plenty for a personal blog.*
