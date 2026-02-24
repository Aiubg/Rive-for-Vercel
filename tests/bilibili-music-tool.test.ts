import { afterEach, describe, expect, it, vi } from 'vitest';
import { bilibiliMusicTool } from '$lib/server/ai/tools/builtin/bilibili-music';
import type { ToolContext } from '$lib/server/ai/tools/types';

const defaultContext: ToolContext = {
	env: 'dev'
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('bilibili_music tool', () => {
	it('returns normalized search results', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				code: 200,
				message: '搜索解析成功',
				data: [
					{
						id: 'BV1abc',
						aid: 12345,
						bvid: 'BV1abc',
						artist: '歌手A',
						title: '歌曲A',
						duration: '03:15',
						play_count: 1024,
						link: 'https://www.bilibili.com/video/BV1abc'
					}
				],
				time: '2026-02-22 12:00:00'
			})
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = (await bilibiliMusicTool.executor(
			{
				operation: 'search',
				query: '歌曲A',
				page: 1,
				limit: 5
			},
			defaultContext
		)) as {
			error?: string;
			query?: string;
			results?: Array<{ bvid?: string; title?: string; playCount?: number }>;
		};

		expect(result.error).toBeUndefined();
		expect(result.query).toBe('歌曲A');
		expect(result.results).toHaveLength(1);
		expect(result.results?.[0]?.bvid).toBe('BV1abc');
		expect(result.results?.[0]?.title).toBe('歌曲A');
		expect(result.results?.[0]?.playCount).toBe(1024);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('returns validation error when media request has no bvid or aid', async () => {
		const result = (await bilibiliMusicTool.executor(
			{
				operation: 'media'
			},
			defaultContext
		)) as { error?: string };

		expect(result.error).toContain('Either "bvid" or "aid" is required');
	});

	it('returns upstream error when api code is not 200', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				code: 400,
				error: '搜索关键词不能为空'
			})
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = (await bilibiliMusicTool.executor(
			{
				operation: 'search',
				query: '   '
			},
			defaultContext
		)) as { error?: string };

		expect(result.error).toBe('Parameter "query" is required when operation=search.');

		const result2 = (await bilibiliMusicTool.executor(
			{
				operation: 'search',
				query: 'test'
			},
			defaultContext
		)) as { error?: string; status?: number };

		expect(result2.error).toBe('搜索关键词不能为空');
		expect(result2.status).toBe(400);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
