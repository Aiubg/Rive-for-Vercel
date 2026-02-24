import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { getContext, setContext } from 'svelte';
import type { ChatHistory } from '$lib/hooks/chat-history.svelte';

const contextKey = Symbol('NewChatTrigger');

export class NewChatTrigger {
	value = $state(0);
	chatHistory: ChatHistory | undefined;

	constructor(chatHistory?: ChatHistory) {
		this.chatHistory = chatHistory;
	}

	increment = () => {
		this.value++;
	};

	/**
	 * Triggers a new chat: increments the trigger value, resets active chat, and navigates to home.
	 */
	trigger = async () => {
		this.increment();
		if (this.chatHistory) {
			this.chatHistory.setActiveChatId(null);
		}
		await goto(resolve('/'));
	};

	setContext() {
		setContext(contextKey, this);
	}
	static fromContext(): NewChatTrigger {
		return getContext(contextKey);
	}
}
