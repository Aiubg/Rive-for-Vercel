import { ToolRegistry } from '$lib/server/ai/tools/registry';
import type { ToolRecord, ToolContext } from '$lib/server/ai/tools/types';
import { dev } from '$app/environment';

const isDev = dev || process.env.NODE_ENV !== 'production';

export type ToolSelectionContext = {
	modelId: string;
	env?: 'dev' | 'prod';
	agentId?: string;
	tenantId?: string;
	userId?: string;
	chatId?: string;
	allocateSearchResultId?: () => number;
};

export function selectTools(ctx: ToolSelectionContext): ToolRecord[] {
	const env = ctx.env || (isDev ? 'dev' : 'prod');

	let tools = ToolRegistry.listForModel(ctx.modelId);

	if (env === 'prod') {
		tools = tools.filter((t) => !t.metadata.experimental);
	}

	if (ctx.agentId === 'title-generator') {
		tools = [];
	}

	return tools;
}

export function buildToolContext(ctx: ToolSelectionContext): ToolContext {
	const env = ctx.env || (isDev ? 'dev' : 'prod');

	return {
		userId: ctx.userId,
		tenantId: ctx.tenantId,
		chatId: ctx.chatId,
		env,
		allocateSearchResultId: ctx.allocateSearchResultId
	};
}
