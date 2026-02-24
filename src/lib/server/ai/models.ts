import type { LanguageModel } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createGroq } from '@ai-sdk/groq';
import { createXai } from '@ai-sdk/xai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { env as privateEnv } from '$env/dynamic/private';
import { MODEL_REGISTRY, type ModelRegistryItem } from '$lib/ai/model-registry';

const openrouter = createOpenRouter({
	apiKey: String(privateEnv.OPENROUTER_API_KEY || ''),
	headers: {
		...(privateEnv.OPENROUTER_SITE_URL
			? { 'HTTP-Referer': String(privateEnv.OPENROUTER_SITE_URL) }
			: {}),
		...(privateEnv.OPENROUTER_APP_NAME ? { 'X-Title': String(privateEnv.OPENROUTER_APP_NAME) } : {})
	}
});

const groq = createGroq({
	apiKey: String(privateEnv.GROQ_API_KEY || '')
});

const xai = createXai({
	apiKey: String(privateEnv.XAI_API_KEY || '')
});

const google = createGoogleGenerativeAI({
	apiKey: String(privateEnv.GOOGLE_GENERATIVE_AI_API_KEY || '')
});

const anthropic = createAnthropic({
	apiKey: String(privateEnv.ANTHROPIC_API_KEY || '')
});

const deepseek = createDeepSeek({
	apiKey: String(privateEnv.DEEPSEEK_API_KEY || '')
});

const openai = createOpenAI({
	apiKey: String(privateEnv.OPENAI_API_KEY || '')
});

const siliconflow = createOpenAICompatible({
	name: 'siliconflow',
	apiKey: String(privateEnv.SILICONFLOW_API_KEY || ''),
	baseURL: 'https://api.siliconflow.cn/v1'
});

const providers: Record<ModelRegistryItem['provider'], (modelId: string) => LanguageModel> = {
	openrouter: (modelId: string) => openrouter(modelId) as unknown as LanguageModel,
	groq: (modelId: string) => groq(modelId),
	xai: (modelId: string) => xai(modelId),
	google: (modelId: string) => google(modelId),
	anthropic: (modelId: string) => anthropic(modelId),
	deepseek: (modelId: string) => deepseek(modelId),
	openai: (modelId: string) => openai(modelId),
	siliconflow: (modelId: string) => siliconflow(modelId)
};

export const myProvider = {
	languageModel(id: string): LanguageModel {
		if (id === 'title-model') {
			const titleModelId = 'deepseek-chat';
			return deepseek(titleModelId);
		}

		const registryItem = MODEL_REGISTRY.find((item) => item.id === id);
		if (!registryItem) {
			throw new Error(`Unknown model id: ${id}`);
		}

		const providerFn = providers[registryItem.provider];
		if (!providerFn) {
			throw new Error(`Unsupported provider: ${registryItem.provider} for model ${id}`);
		}

		return providerFn(registryItem.model);
	}
};
