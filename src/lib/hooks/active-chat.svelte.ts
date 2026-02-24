import { getContext, setContext } from 'svelte';
import type { ChatState } from '$lib/hooks/chat-state.svelte';

const contextKey = Symbol('ActiveChat');

/**
 * ActiveChat class holds the reference to the currently active ChatState.
 * This allows multiple components to access the active chat without prop drilling.
 */
export class ActiveChat {
	/** The current ChatState instance */
	state = $state<ChatState | null>(null);
	/** Whether the share modal is currently open */
	shareModalOpen = $state(false);

	/** Sets the ActiveChat instance in Svelte context */
	setContext() {
		setContext(contextKey, this);
	}

	/** Retrieves the ActiveChat instance from Svelte context */
	static fromContext(): ActiveChat {
		return getContext(contextKey);
	}
}
