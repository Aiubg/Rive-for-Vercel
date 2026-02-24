import { describe, expect, it } from 'vitest';
import { DEFAULT_CHAT_MODEL, MODEL_REGISTRY } from '$lib/ai/model-registry';
import { ToolRegistry } from '$lib/server/ai/tools/registry';
import { buildToolContext, selectTools } from '$lib/server/ai/tools/selection';
import { toAiTools } from '$lib/server/ai/tools/ai-adapter';

describe('tool calling system', () => {
	it('selects tools and executes calculator', async () => {
		const allTools = ToolRegistry.list();
		expect(allTools.length).toBeGreaterThan(0);
		expect(allTools.some((t) => t.definition.name === 'calculator')).toBe(true);
		expect(allTools.some((t) => t.definition.name === 'ui_card')).toBe(true);

		const selectionCtx = {
			modelId: MODEL_REGISTRY.find((m) => m.capabilities.toolUse)?.id ?? DEFAULT_CHAT_MODEL,
			userId: 'test-user',
			chatId: 'test-chat'
		};

		const selectedTools = selectTools(selectionCtx);
		expect(selectedTools.length).toBeGreaterThan(0);
		expect(selectedTools.some((t) => t.definition.name === 'calculator')).toBe(true);

		const toolContext = buildToolContext(selectionCtx);
		const aiTools = toAiTools(selectedTools, () => toolContext);

		const calculator = aiTools['calculator'];
		expect(calculator).toBeTruthy();
		if (!calculator?.execute) throw new Error('Missing calculator tool executor');

		const result = await calculator.execute(
			{
				calculations: [
					{ operation: 'add', a: 1, b: 2 },
					{ operation: 'multiply', a: 5, b: 10 }
				]
			},
			{ toolCallId: 'test-id', messages: [] }
		);
		expect(result.results).toHaveLength(2);
		expect(result.results[0].result).toBe(3);
		expect(result.results[1].result).toBe(50);

		const noTools = selectTools({ ...selectionCtx, agentId: 'title-generator' });
		expect(noTools).toHaveLength(0);
	});
});
