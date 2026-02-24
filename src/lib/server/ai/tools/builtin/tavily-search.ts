import { env as privateEnv } from '$env/dynamic/private';
import { logger } from '$lib/utils/logger';
import type { ToolRecord } from '$lib/server/ai/tools/types';

type TavilyResult = {
	id: number;
	title: string;
	url: string;
	snippet: string;
	publishedAt?: string;
	score?: number;
};

export const tavilySearchTool: ToolRecord = {
	definition: {
		name: 'tavily_search',
		description:
			'Search the web for up-to-date information, news, and facts. Use this tool when you need real-time data or information not in your training set.',
		parameters: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The natural language search query.'
				},
				searchDepth: {
					type: 'string',
					enum: ['basic', 'advanced'],
					description: 'The depth of the search. "basic" is faster, "advanced" is more thorough.',
					default: 'basic'
				},
				topic: {
					type: 'string',
					enum: ['general', 'news'],
					description: 'The category of search. Use "news" for current events.',
					default: 'general'
				},
				maxResults: {
					type: 'number',
					description: 'Maximum number of results to return.',
					minimum: 1,
					maximum: 10,
					default: 5
				},
				includeAnswer: {
					type: 'boolean',
					description:
						'Whether to include a short AI-generated answer based on the search results.',
					default: false
				},
				includeImages: {
					type: 'boolean',
					description: 'Whether to include images related to the search query.',
					default: false
				}
			},
			required: ['query']
		}
	},
	metadata: {
		tags: ['search', 'web']
	},
	executor: async (args, ctx) => {
		const {
			query,
			searchDepth = 'basic',
			topic = 'general',
			maxResults = 5,
			includeAnswer = false,
			includeImages = false
		} = args as {
			query: string;
			searchDepth?: 'basic' | 'advanced';
			topic?: 'general' | 'news';
			maxResults?: number;
			includeAnswer?: boolean;
			includeImages?: boolean;
		};

		logger.debug('[tavily_search] query', {
			query,
			searchDepth,
			topic,
			maxResults,
			includeAnswer,
			includeImages
		});

		const apiKey = privateEnv.TAVILY_API_KEY;

		if (!apiKey || apiKey === '****') {
			return { error: 'Tavily API key is not configured.' };
		}

		const body = {
			query,
			search_depth: searchDepth,
			topic,
			max_results: Math.min(Math.max(maxResults, 1), 10),
			include_answer: includeAnswer,
			include_images: includeImages,
			include_raw_content: false,
			include_domains: [] as string[],
			exclude_domains: [] as string[]
		};

		const rawSnippetMax = Number(privateEnv.TAVILY_SEARCH_SNIPPET_MAX_CHARS ?? 800);
		const snippetMax = Number.isFinite(rawSnippetMax)
			? Math.min(Math.max(rawSnippetMax, 120), 5000)
			: 800;

		try {
			const response = await fetch('https://api.tavily.com/search', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`
				},
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				const errorText = await response.text();
				logger.error('[tavily_search] Tavily API error', {
					status: response.status,
					body: errorText
				});
				return { error: 'Tavily search request failed.' };
			}

			const json = (await response.json()) as {
				answer?: string;
				images?: string[];
				results?: Array<{
					title: string;
					url: string;
					content: string;
					published_date?: string;
					score: number;
				}>;
			};

			const results: TavilyResult[] =
				json.results?.map((r, index) => {
					const raw = typeof r.content === 'string' ? r.content : '';
					const snippet = raw.length > snippetMax ? raw.slice(0, snippetMax) : raw;
					const allocatedId = ctx.allocateSearchResultId?.();
					const id =
						typeof allocatedId === 'number' && Number.isFinite(allocatedId) && allocatedId > 0
							? Math.trunc(allocatedId)
							: index + 1;
					return {
						id,
						title: r.title,
						url: r.url,
						snippet,
						publishedAt: r.published_date,
						score: r.score
					};
				}) ?? [];

			return {
				answer: json.answer,
				images: json.images,
				results
			};
		} catch (error) {
			logger.error('[tavily_search] Execution failed', error);
			return { error: error instanceof Error ? error.message : String(error) };
		}
	}
};
