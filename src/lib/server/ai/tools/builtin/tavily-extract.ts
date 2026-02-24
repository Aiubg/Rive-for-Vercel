import { env as privateEnv } from '$env/dynamic/private';
import { logger } from '$lib/utils/logger';
import type { ToolRecord } from '$lib/server/ai/tools/types';

export const tavilyExtractTool: ToolRecord = {
	definition: {
		name: 'tavily_extract',
		description:
			'Extract the full content of one or more web pages. Use this when you need to read the full text of a specific article or webpage found during search.',
		parameters: {
			type: 'object',
			properties: {
				urls: {
					type: 'array',
					items: { type: 'string' },
					description: 'A list of URLs to extract content from.'
				}
			},
			required: ['urls']
		}
	},
	metadata: {
		tags: ['extract', 'web']
	},
	executor: async (args) => {
		const { urls } = args as { urls: string[] };

		logger.debug('[tavily_extract] urls', { urls });

		const apiKey = privateEnv.TAVILY_API_KEY;

		if (!apiKey || apiKey === '****') {
			return { error: 'Tavily API key is not configured.' };
		}

		const rawMax = Number(privateEnv.TAVILY_EXTRACT_MAX_CHARS ?? 20000);
		const maxChars = Number.isFinite(rawMax) ? Math.min(Math.max(rawMax, 1000), 200000) : 20000;

		try {
			const response = await fetch('https://api.tavily.com/extract', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`
				},
				body: JSON.stringify({ urls })
			});

			if (!response.ok) {
				const errorText = await response.text();
				logger.error('[tavily_extract] Tavily API error', {
					status: response.status,
					body: errorText
				});
				return { error: 'Tavily extract request failed.' };
			}

			const json = (await response.json()) as {
				results: Array<{
					url: string;
					raw_content: string;
				}>;
				failed_results: Array<{
					url: string;
					error: string;
				}>;
			};

			return {
				results: json.results.map((r) => {
					const content = typeof r.raw_content === 'string' ? r.raw_content : '';
					const truncated = content.length > maxChars ? content.slice(0, maxChars) : content;
					return {
						url: r.url,
						content: truncated
					};
				}),
				failedResults: json.failed_results
			};
		} catch (error) {
			logger.error('[tavily_extract] Execution failed', error);
			return { error: error instanceof Error ? error.message : String(error) };
		}
	}
};
