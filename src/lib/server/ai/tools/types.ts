import type { JSONValue } from 'ai';

export type ToolDefinition = {
	name: string;
	description: string;
	parameters: JSONValue;
};

export type ToolContext = {
	userId?: string;
	tenantId?: string;
	chatId?: string;
	env: 'dev' | 'prod';
	allocateSearchResultId?: () => number;
};

export type ToolExecutor = (args: JSONValue, ctx: ToolContext) => Promise<JSONValue>;

export type ToolMetadata = {
	tags?: string[];
	experimental?: boolean;
};

export type ToolRecord = {
	definition: ToolDefinition;
	executor: ToolExecutor;
	metadata: ToolMetadata;
};
