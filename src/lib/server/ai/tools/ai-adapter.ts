import type { ToolRecord, ToolContext } from '$lib/server/ai/tools/types';
import { dynamicTool, jsonSchema } from 'ai';
import type { JSONSchema7, JSONValue, ToolSet } from 'ai';

export function toAiTools(tools: ToolRecord[], buildCtx: () => ToolContext): ToolSet {
	const result: ToolSet = {};

	for (const tool of tools) {
		const { definition, executor } = tool;

		const inputSchema = jsonSchema(definition.parameters as JSONSchema7);

		result[definition.name] = dynamicTool({
			description: definition.description,
			inputSchema,
			execute: async (input) => {
				const ctx = buildCtx();
				const data = await executor(input as JSONValue, ctx);
				return data;
			}
		});
	}

	return result;
}
