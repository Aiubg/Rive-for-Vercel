import { ChatHistory } from '$lib/hooks/chat-history.svelte';
import { SelectedModel } from '$lib/hooks/selected-model.svelte';
import type { Transport } from '@sveltejs/kit';

// Keep a concrete export to satisfy optimized client hook imports.
export const reroute = () => undefined;

export const transport: Transport = {
	SelectedModel: {
		encode: (value) => value instanceof SelectedModel && value.value,
		decode: (value) => new SelectedModel(typeof value === 'string' ? value : String(value ?? ''))
	},
	ChatHistory: {
		encode: (value) => value instanceof ChatHistory && value.chats,
		decode: (value) => new ChatHistory(Array.isArray(value) ? value : [])
	}
};
