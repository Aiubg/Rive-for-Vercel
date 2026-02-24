import type { ToolRecord } from '$lib/server/ai/tools/types';
import { MODEL_REGISTRY } from '$lib/ai/model-registry';
import { calculatorTool } from '$lib/server/ai/tools/builtin/calculator';
import { wolframAlphaTool } from '$lib/server/ai/tools/builtin/wolfram';
import { tavilySearchTool } from '$lib/server/ai/tools/builtin/tavily-search';
import { tavilyExtractTool } from '$lib/server/ai/tools/builtin/tavily-extract';
import { bilibiliMusicTool } from '$lib/server/ai/tools/builtin/bilibili-music';
import { uiCardTool } from '$lib/server/ai/tools/builtin/ui-card';

type ToolManagerConfigItem = {
	name: string;
	enabled?: boolean;
	enabledModels?: string[];
	disabledModels?: string[];
};

const records: ToolRecord[] = [
	calculatorTool,
	wolframAlphaTool,
	tavilySearchTool,
	tavilyExtractTool,
	bilibiliMusicTool,
	uiCardTool
];

const managerConfig: ToolManagerConfigItem[] = [
	{ name: 'calculator', enabled: true },
	{ name: 'wolfram_alpha', enabled: true },
	{ name: 'tavily_search', enabled: true },
	{ name: 'tavily_extract', enabled: true },
	{ name: 'bilibili_music', enabled: true },
	{ name: 'ui_card', enabled: true }
];

function findConfig(name: string): ToolManagerConfigItem | undefined {
	return managerConfig.find((item) => item.name === name);
}

function isToolEnabledForModel(tool: ToolRecord, modelId: string): boolean {
	const registryItem = MODEL_REGISTRY.find((m) => m.id === modelId);
	if (!registryItem) return false;

	const config = findConfig(tool.definition.name);
	if (config && config.enabled === false) {
		return false;
	}

	let enabled = true;

	if (config && config.enabledModels && config.enabledModels.length > 0) {
		enabled = config.enabledModels.includes(modelId);
	}

	if (config && config.disabledModels && config.disabledModels.length > 0) {
		if (config.disabledModels.includes(modelId)) {
			enabled = false;
		}
	}

	return enabled;
}

export const ToolRegistry = {
	list(): ToolRecord[] {
		return records;
	},

	get(name: string): ToolRecord | undefined {
		return records.find((t) => t.definition.name === name);
	},

	listForModel(modelId: string): ToolRecord[] {
		return records.filter((t) => isToolEnabledForModel(t, modelId));
	},

	isEnabledForModel(toolName: string, modelId: string): boolean {
		const tool = this.get(toolName);
		if (!tool) return false;
		return isToolEnabledForModel(tool, modelId);
	}
};
