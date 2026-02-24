import { DEFAULT_CHAT_MODEL, chatModels } from '$lib/ai/model-registry';
import { SelectedModel } from '$lib/hooks/selected-model.svelte.js';
import { dev } from '$app/environment';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
	const { user } = locals;
	const sidebarCollapsed = cookies.get('sidebar:state') !== 'true';

	let modelId = cookies.get('selected-model');
	if (!modelId || !chatModels.find((model) => model.id === modelId)) {
		modelId = DEFAULT_CHAT_MODEL;
		cookies.set('selected-model', modelId, {
			path: '/',
			expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev
		});
	}

	return {
		user,
		sidebarCollapsed,
		selectedChatModel: new SelectedModel(modelId)
	};
};
