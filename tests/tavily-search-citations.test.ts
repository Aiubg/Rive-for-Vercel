import { afterEach, describe, expect, it, vi } from 'vitest';
import { tavilySearchTool } from '$lib/server/ai/tools/builtin/tavily-search';
import type { ToolContext } from '$lib/server/ai/tools/types';

type TavilySearchOutput = {
	results?: Array<{ id: number }>;
	error?: string;
};

const originalApiKey = process.env.TAVILY_API_KEY;

afterEach(() => {
	vi.unstubAllGlobals();
	if (typeof originalApiKey === 'string') {
		process.env.TAVILY_API_KEY = originalApiKey;
	} else {
		delete process.env.TAVILY_API_KEY;
	}
});

describe('tavily_search citation ids', () => {
	it('allocates unique result ids across multiple tool calls in one run', async () => {
		process.env.TAVILY_API_KEY = 'test-key';

		const mockResponse = {
			ok: true,
			json: async () => ({
				results: [
					{ title: 'Doc A', url: 'https://example.com/a', content: 'A', score: 0.9 },
					{ title: 'Doc B', url: 'https://example.com/b', content: 'B', score: 0.8 }
				]
			})
		};

		const fetchMock = vi.fn().mockResolvedValue(mockResponse);
		vi.stubGlobal('fetch', fetchMock);

		let nextId = 1;
		const ctx: ToolContext = {
			env: 'dev',
			allocateSearchResultId: () => nextId++
		};

		const first = (await tavilySearchTool.executor(
			{ query: 'first query', maxResults: 2 },
			ctx
		)) as TavilySearchOutput;
		const second = (await tavilySearchTool.executor(
			{ query: 'second query', maxResults: 2 },
			ctx
		)) as TavilySearchOutput;

		expect(first.error).toBeUndefined();
		expect(second.error).toBeUndefined();
		expect(first.results?.map((r) => r.id)).toEqual([1, 2]);
		expect(second.results?.map((r) => r.id)).toEqual([3, 4]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
