import { WOLFRAM_ALPHA_APP_ID } from '$env/static/private';
import { logger } from '$lib/utils/logger';
import type { ToolRecord } from '$lib/server/ai/tools/types';

export const wolframAlphaTool: ToolRecord = {
	definition: {
		name: 'wolfram_alpha',
		description:
			'Access Wolfram Alpha for complex scientific, mathematical queries, and real-time data analysis. Use this ONLY for complex problems that the standard calculator cannot handle, such as symbolic math, physics, chemistry, or specialized data.',
		parameters: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The natural language query or mathematical expression to evaluate.'
				}
			},
			required: ['query']
		}
	},
	metadata: {
		tags: ['science', 'math', 'knowledge', 'advanced']
	},
	executor: async (args) => {
		const { query } = args as { query: string };
		logger.debug(`[wolfram_alpha] query: ${query}`);

		if (!WOLFRAM_ALPHA_APP_ID || WOLFRAM_ALPHA_APP_ID === '****') {
			return { error: 'Wolfram Alpha AppID is not configured.' };
		}

		try {
			// Using the LLM API for better results while remaining efficient for LLMs
			const url = new URL('https://api.wolframalpha.com/v1/llm-api');
			url.searchParams.append('appid', WOLFRAM_ALPHA_APP_ID);
			url.searchParams.append('input', query);

			const response = await fetch(url.toString());

			if (!response.ok) {
				const errorText = await response.text();
				return { error: `Wolfram Alpha API error: ${errorText || response.statusText}` };
			}

			const result = await response.text();
			return { result };
		} catch (error) {
			logger.error('[wolfram_alpha] Execution failed', error);
			return { error: error instanceof Error ? error.message : String(error) };
		}
	}
};
