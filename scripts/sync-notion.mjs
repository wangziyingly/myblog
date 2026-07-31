#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

try {
	process.loadEnvFile?.(".env.local");
} catch {
	// Vercel injects variables directly; a local .env.local file is optional.
}

const NOTION_API_VERSION = process.env.NOTION_API_VERSION || "2026-03-11";
const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_TOKEN = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
const NOTION_DATA_SOURCE_ID =
	process.env.NOTION_DATA_SOURCE_ID || "f31ead98-19cb-41bf-be47-5449d4a20555";
const SITE_ORIGIN =
	process.env.SITE_ORIGIN || "https://myblog-lime-one.vercel.app";

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const postsDir = path.join(projectRoot, "src", "content", "posts");
const assetsDir = path.join(projectRoot, "public", "notion-assets");
const manifestPath = path.join(postsDir, ".notion-manifest.json");

if (!NOTION_TOKEN) {
	const message = "[notion] 未找到 NOTION_TOKEN，保留仓库中的文章并跳过同步。";
	if (process.env.VERCEL === "1" || process.env.CI === "true") {
		throw new Error(`${message} 请在部署环境中配置 NOTION_TOKEN。`);
	}
	console.warn(message);
	process.exit(0);
}

const headers = {
	Authorization: `Bearer ${NOTION_TOKEN}`,
	"Content-Type": "application/json",
	"Notion-Version": NOTION_API_VERSION,
};

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notionRequest(endpoint, options = {}, attempt = 0) {
	const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
		...options,
		headers: {
			...headers,
			...options.headers,
		},
	});

	if ((response.status === 429 || response.status >= 500) && attempt < 3) {
		const retryAfter = Number(response.headers.get("retry-after"));
		await sleep(
			Number.isFinite(retryAfter) ? retryAfter * 1000 : 500 * 2 ** attempt,
		);
		return notionRequest(endpoint, options, attempt + 1);
	}

	if (!response.ok) {
		const details = await response.text();
		throw new Error(`Notion API ${response.status}: ${details.slice(0, 800)}`);
	}

	return response.json();
}

async function queryPublishedPages() {
	const pages = [];
	let startCursor;

	do {
		const body = {
			filter: {
				property: "状态",
				select: { equals: "已发布" },
			},
			sorts: [
				{ property: "置顶", direction: "descending" },
				{ property: "发布日期", direction: "descending" },
			],
			page_size: 100,
		};
		if (startCursor) body.start_cursor = startCursor;

		const result = await notionRequest(
			`/data_sources/${NOTION_DATA_SOURCE_ID}/query`,
			{
				method: "POST",
				body: JSON.stringify(body),
			},
		);
		pages.push(...result.results);
		startCursor = result.has_more ? result.next_cursor : undefined;
	} while (startCursor);

	return pages;
}

function richTextToPlain(items = []) {
	return items.map((item) => item.plain_text || "").join("");
}

function getProperty(page, name) {
	return page.properties?.[name];
}

function getText(page, name) {
	const property = getProperty(page, name);
	if (!property) return "";
	if (property.type === "title") {
		return richTextToPlain(property.title);
	}
	if (property.type === "rich_text") {
		return richTextToPlain(property.rich_text);
	}
	return "";
}

function getSelect(page, name) {
	return getProperty(page, name)?.select?.name || "";
}

function getMultiSelect(page, name) {
	return (
		getProperty(page, name)?.multi_select?.map((option) => option.name) || []
	);
}

function getDate(page, name) {
	return getProperty(page, name)?.date?.start || "";
}

function getCheckbox(page, name) {
	return getProperty(page, name)?.checkbox === true;
}

function getFileUrl(page, name) {
	const first = getProperty(page, name)?.files?.[0];
	if (!first) return "";
	return first.file?.url || first.external?.url || "";
}

function assertValidSlug(slug, title) {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
		throw new Error(
			`文章“${title}”的 Slug“${slug}”无效；仅允许小写字母、数字和连字符。`,
		);
	}
}

function yamlString(value) {
	return JSON.stringify(String(value ?? ""));
}

function yamlArray(values) {
	return `[${values.map(yamlString).join(", ")}]`;
}

function extensionFrom(contentType, url) {
	const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
	const byType = {
		"image/avif": ".avif",
		"image/gif": ".gif",
		"image/jpeg": ".jpg",
		"image/png": ".png",
		"image/svg+xml": ".svg",
		"image/webp": ".webp",
	};
	if (byType[normalized]) return byType[normalized];

	try {
		const ext = path.extname(new URL(url).pathname).toLowerCase();
		if (/^\.(avif|gif|jpe?g|png|svg|webp)$/.test(ext)) {
			return ext === ".jpeg" ? ".jpg" : ext;
		}
	} catch {
		// Use the fallback below.
	}
	return ".jpg";
}

async function downloadImage(url, slug, basename) {
	if (!url) return "";
	if (url.startsWith("/")) return url;
	if (url.startsWith(`${SITE_ORIGIN}/`)) {
		return url.slice(SITE_ORIGIN.length);
	}

	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const extension = extensionFrom(response.headers.get("content-type"), url);
		const targetDir = path.join(assetsDir, slug);
		const targetPath = path.join(targetDir, `${basename}${extension}`);
		await mkdir(targetDir, { recursive: true });
		await writeFile(targetPath, Buffer.from(await response.arrayBuffer()));
		return `/notion-assets/${slug}/${basename}${extension}`;
	} catch (error) {
		console.warn(
			`[notion] 图片下载失败，保留远程地址：${url} (${error.message})`,
		);
		return url;
	}
}

async function localizeMarkdownImages(markdown, slug) {
	const matches = [
		...markdown.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g),
	];
	let output = markdown;

	for (let index = 0; index < matches.length; index += 1) {
		const [source, alt, url] = matches[index];
		const localUrl = await downloadImage(url, slug, `image-${index + 1}`);
		output = output.replace(source, `![${alt}](${localUrl})`);
	}
	return output;
}

function normalizeNotionMarkdown(markdown) {
	return markdown
		.replace(/\r\n/g, "\n")
		.replace(/<empty-block\/>/g, "")
		.replace(/<table_of_contents[^>]*\/>/g, "")
		.replace(/<callout[^>]*>\n([\s\S]*?)\n<\/callout>/g, (_, body) =>
			body
				.split("\n")
				.map((line) => `> ${line.replace(/^\t/, "")}`)
				.join("\n"),
		)
		.replace(/\s*\{color="[^"]+"\}\s*$/gm, "")
		.replace(
			new RegExp(
				`\\]\\(${SITE_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/[^)]+)\\)`,
				"g",
			),
			"]($1)",
		)
		.trim();
}

async function fetchPageMarkdown(pageId) {
	const result = await notionRequest(`/pages/${pageId}/markdown`);
	if (result.truncated) {
		throw new Error(`Notion 页面 ${pageId} 内容被截断，请拆分超大页面后重试。`);
	}
	return result.markdown || "";
}

async function buildPost(page) {
	const title = getText(page, "标题");
	const slug = getText(page, "Slug").trim();
	const published = getDate(page, "发布日期");

	if (!title || !published) {
		throw new Error(`已发布文章缺少标题或发布日期：${page.url}`);
	}
	assertValidSlug(slug, title);

	let markdown = normalizeNotionMarkdown(await fetchPageMarkdown(page.id));
	markdown = await localizeMarkdownImages(markdown, slug);

	const uploadedCover = getFileUrl(page, "封面图片");
	const coverSource = uploadedCover || getText(page, "封面");
	const cover = await downloadImage(coverSource, slug, "cover");
	const updated = getDate(page, "更新日期");

	const frontmatter = [
		"---",
		`title: ${yamlString(title)}`,
		`published: ${published.slice(0, 10)}`,
		...(updated ? [`updated: ${updated.slice(0, 10)}`] : []),
		"draft: false",
		`description: ${yamlString(getText(page, "摘要"))}`,
		`image: ${yamlString(cover)}`,
		`tags: ${yamlArray(getMultiSelect(page, "标签"))}`,
		`category: ${yamlString(getSelect(page, "分类"))}`,
		`lang: ${yamlString(getSelect(page, "语言"))}`,
		`pinned: ${getCheckbox(page, "置顶")}`,
		"---",
		"",
	].join("\n");

	return {
		slug,
		content: `${frontmatter}${markdown}\n`,
	};
}

async function readPreviousManifest() {
	try {
		const parsed = JSON.parse(await readFile(manifestPath, "utf8"));
		return Array.isArray(parsed.slugs) ? parsed.slugs : [];
	} catch {
		return [];
	}
}

async function main() {
	const pages = await queryPublishedPages();
	if (pages.length === 0 && process.env.NOTION_ALLOW_EMPTY !== "1") {
		throw new Error("Notion 没有返回任何已发布文章；为避免误删，已停止同步。");
	}

	await mkdir(postsDir, { recursive: true });
	await rm(assetsDir, { recursive: true, force: true });
	await mkdir(assetsDir, { recursive: true });

	const posts = await Promise.all(pages.map(buildPost));
	const slugs = posts.map((post) => post.slug);
	if (new Set(slugs).size !== slugs.length) {
		throw new Error("Notion 中存在重复 Slug，请修正后重试。");
	}

	for (const post of posts) {
		await writeFile(
			path.join(postsDir, `${post.slug}.md`),
			post.content,
			"utf8",
		);
	}

	const previousSlugs = await readPreviousManifest();
	for (const oldSlug of previousSlugs) {
		if (
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(oldSlug) &&
			!slugs.includes(oldSlug)
		) {
			await rm(path.join(postsDir, `${oldSlug}.md`), {
				force: true,
			});
		}
	}

	await writeFile(
		manifestPath,
		`${JSON.stringify({ slugs: slugs.sort() }, null, 2)}\n`,
		"utf8",
	);
	console.log(`[notion] 已同步 ${posts.length} 篇已发布文章。`);
}

await main();
