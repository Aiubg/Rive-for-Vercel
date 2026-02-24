import type { RequestHandler } from '@sveltejs/kit';

type ChangelogItem = {
	version: string;
	title: string;
	description: string;
	date: string;
	slug: string;
};

const changelog: ChangelogItem[] = [
	{
		version: '1.0.0',
		title: 'Rivo 正式发布',
		description: '基于 SvelteKit 的 Rivo AI 聊天助手正式上线，支持多模型对话与工具调用。',
		date: '2025-01-01T00:00:00Z',
		slug: 'rivo-1-0-0'
	},
	{
		version: '1.1.0',
		title: '新增 DeepSeek 模型支持',
		description: '接入 DeepSeek 系列模型，提供更稳定的对话体验与推理能力。',
		date: '2025-02-01T00:00:00Z',
		slug: 'rivo-1-1-0'
	},
	{
		version: '1.2.0',
		title: '文件与渲染体验升级',
		description: '优化文件管理、Markdown 渲染与可视化展示，提升整体可用性。',
		date: '2025-03-01T00:00:00Z',
		slug: 'rivo-1-2-0'
	}
];

export const GET: RequestHandler = async ({ url }) => {
	const origin = `${url.protocol}//${url.host}`;

	const itemsXml = changelog
		.map((item) => {
			const link = `${origin}/changelog/${item.slug}`;
			return `<item>
    <title>${escapeXml(item.title)}</title>
    <link>${link}</link>
    <guid>${link}</guid>
    <description>${escapeXml(item.description)}</description>
    <pubDate>${new Date(item.date).toUTCString()}</pubDate>
  </item>`;
		})
		.join('\n');

	const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Rivo 更新日志</title>
    <link>${origin}/</link>
    <description>Rivo 产品更新与版本发布信息</description>
    <language>zh-CN</language>
    <ttl>60</ttl>
${itemsXml}
  </channel>
</rss>`;

	return new Response(rss, {
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
			'Cache-Control': 'max-age=0, s-maxage=3600'
		}
	});
};

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
