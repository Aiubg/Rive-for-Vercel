import { logger } from '$lib/utils/logger';
import { fetchWithTimeout } from '$lib/utils/network';
import type { Chat } from '$lib/types/db';
import { getContext, setContext } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';

const contextKey = Symbol('ChatHistory');

/**
 * ChatHistory class manages the list of chats for the user.
 * It handles fetching, optimistic updates, and deletion of chats.
 */
export class ChatHistory {
	#loading = $state(false);
	#revalidating = $state(false);
	#loadCount = 0;
	#generatingPollTimer: ReturnType<typeof setInterval> | null = null;
	#updateControllers = new SvelteMap<string, AbortController>();
	#unreadControllers = new SvelteMap<string, AbortController>();
	#deleteController: AbortController | null = null;
	/** List of chat records */
	chats = $state<Chat[]>([]);
	/** Currently active chat ID */
	activeChatId = $state<string | null>(null);
	/** Incremental trigger to signal UI to scroll to top of chat list */
	shouldScrollToTop = $state(0);
	generatingByChatId = new SvelteSet<string>();

	/** Returns true if the initial history load is in progress */
	get loading() {
		return this.#loading;
	}

	/** Returns true if the history is being refreshed in the background */
	get revalidating() {
		return this.#revalidating;
	}

	/** Triggers a scroll to the top of the chat list */
	triggerScrollToTop = () => {
		this.shouldScrollToTop += 1;
	};

	constructor(chats: Promise<Chat[]> | Chat[]) {
		if (Array.isArray(chats)) {
			this.chats = chats;
			this.syncTransientState();
		} else {
			this.load(chats);
		}
	}

	private updateUnread = async (chatId: string, unread: boolean) => {
		this.#unreadControllers.get(chatId)?.abort();
		const controller = new AbortController();
		this.#unreadControllers.set(chatId, controller);
		try {
			const res = await fetchWithTimeout('/api/chat/unread', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ chatId, unread }),
				timeout: 5000,
				retries: 1,
				signal: controller.signal
			});
			if (!res.ok) {
				logger.error('Failed to update chat unread status', { chatId, unread });
			}
		} catch (error) {
			if ((error as Error).name === 'AbortError') return;
			logger.error('Failed to update chat unread status', error);
		} finally {
			if (this.#unreadControllers.get(chatId) === controller) {
				this.#unreadControllers.delete(chatId);
			}
		}
	};

	isGenerating = (chatId: string) => {
		return this.generatingByChatId.has(chatId);
	};

	isUnread = (chatId: string) => {
		return !!this.chats.find((c) => c.id === chatId)?.unread;
	};

	clearUnread = (chatId: string, options?: { force?: boolean }) => {
		const force = options?.force ?? false;
		if (!chatId) return;
		const chat = this.chats.find((c) => c.id === chatId);
		if (!force && !chat?.unread) return;

		this.chats = this.chats.map((chat) => (chat.id === chatId ? { ...chat, unread: false } : chat));
		void this.updateUnread(chatId, false);
	};

	private clearActiveChatUnread = () => {
		if (!this.activeChatId) return;
		const chat = this.chats.find((c) => c.id === this.activeChatId);
		if (!chat?.unread) return;
		this.clearUnread(this.activeChatId, { force: true });
	};

	private syncTransientState = () => {
		const chatIds = new SvelteSet(this.chats.map((chat) => chat.id));

		for (const id of this.generatingByChatId) {
			if (!chatIds.has(id)) {
				this.generatingByChatId.delete(id);
			}
		}
		this.clearActiveChatUnread();
	};

	private clearChatTransientState = (chatId: string) => {
		if (!chatId) return;
		this.generatingByChatId.delete(chatId);
	};

	setGenerating = (chatId: string, generating: boolean) => {
		if (!chatId) return;
		if (generating) {
			this.generatingByChatId.add(chatId);
		} else {
			this.generatingByChatId.delete(chatId);
		}
	};

	private setGeneratingChats = (chatIds: string[]) => {
		// Only track generating state for chats already present in sidebar history.
		// This avoids flashing a brand-new failed chat entry (appears then disappears)
		// when the run fails before the conversation is actually committed in UI.
		const knownChatIds = new SvelteSet(this.chats.map((chat) => chat.id));
		const filteredChatIds = chatIds.filter((id) => knownChatIds.has(id));

		const previous = new SvelteSet(this.generatingByChatId);
		this.generatingByChatId.clear();
		for (const id of filteredChatIds) this.generatingByChatId.add(id);

		let hasCompletedChat = false;
		for (const id of previous) {
			if (!this.generatingByChatId.has(id)) {
				hasCompletedChat = true;
				break;
			}
		}
		if (hasCompletedChat) {
			void this.refetch();
		}
	};

	#isPolling = false;

	startGeneratingPoll = () => {
		if (typeof window === 'undefined') return;
		if (this.#generatingPollTimer) return;

		const tick = async () => {
			if (this.#isPolling) return;
			if (typeof document !== 'undefined' && document.hidden) return;
			if (this.chats.length === 0) {
				this.setGeneratingChats([]);
				return;
			}
			this.#isPolling = true;
			try {
				const res = await fetchWithTimeout('/api/runs/active-chats', {
					method: 'GET',
					timeout: 8000,
					retries: 0
				});
				if (res.status === 401 || res.status === 403) {
					this.setGeneratingChats([]);
					this.stopGeneratingPoll();
					return;
				}
				if (!res.ok) return;
				const data = (await res.json().catch(() => null)) as { chatIds?: unknown } | null;
				const chatIds = data && Array.isArray(data.chatIds) ? data.chatIds : [];
				this.setGeneratingChats(chatIds.filter((c): c is string => typeof c === 'string'));
			} catch {
				// ignore
			} finally {
				this.#isPolling = false;
			}
		};

		void tick();
		this.#generatingPollTimer = setInterval(tick, 2000);
	};

	stopGeneratingPoll = () => {
		if (!this.#generatingPollTimer) return;
		clearInterval(this.#generatingPollTimer);
		this.#generatingPollTimer = null;
	};

	/**
	 * Loads chat history from a promise.
	 */
	async load(chatsPromise: Promise<Chat[]>) {
		const currentCount = ++this.#loadCount;
		this.#loading = true;
		this.#revalidating = true;
		try {
			const result = await chatsPromise;
			if (currentCount === this.#loadCount) {
				this.chats = result;
				this.syncTransientState();
			}
		} catch (err) {
			if (currentCount === this.#loadCount) {
				logger.error('Failed to load chat history', err);
				this.chats = [];
				this.syncTransientState();
			}
		} finally {
			if (currentCount === this.#loadCount) {
				this.#loading = false;
				this.#revalidating = false;
			}
		}
	}

	/**
	 * Finds chat details by ID.
	 */
	getChatDetails = (chatId: string) => {
		return this.chats.find((c) => c.id === chatId);
	};

	/**
	 * Sets the active chat ID.
	 */
	setActiveChatId = (chatId: string | null) => {
		this.activeChatId = chatId;
		if (chatId) {
			this.clearUnread(chatId, { force: true });
		}
	};

	/**
	 * Upserts a chat record into the history list.
	 */
	upsertChat = (next: Chat) => {
		const idx = this.chats.findIndex((c) => c.id === next.id);
		if (idx === -1) {
			this.chats = [next, ...this.chats];
			this.syncTransientState();
			return;
		}
		this.chats = this.chats.map((c, i) => (i === idx ? { ...c, ...next } : c));
		this.syncTransientState();
	};

	/**
	 * Updates the title of a chat both locally and on the server.
	 */
	updateTitle = async (chatId: string, title: string) => {
		const previousChats = this.chats;
		this.chats = this.chats.map((chat) => (chat.id === chatId ? { ...chat, title } : chat));

		this.#updateControllers.get(chatId)?.abort();
		const controller = new AbortController();
		this.#updateControllers.set(chatId, controller);

		try {
			const res = await fetchWithTimeout('/api/chat/title', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ chatId, title }),
				timeout: 5000,
				retries: 1,
				signal: controller.signal
			});
			if (!res.ok) {
				logger.error('Failed to update chat title', { chatId, title });
				await this.refetch();
			}
		} catch (error) {
			if ((error as Error).name === 'AbortError') return;
			logger.error('Failed to update chat title', error);
			this.chats = previousChats;
		} finally {
			if (this.#updateControllers.get(chatId) === controller) {
				this.#updateControllers.delete(chatId);
			}
		}
	};

	/**
	 * Updates the pinned status of a chat both locally and on the server.
	 */
	updatePinned = async (chatId: string, pinned: boolean) => {
		const previousChats = this.chats;
		this.chats = this.chats.map((chat) => (chat.id === chatId ? { ...chat, pinned } : chat));

		this.#updateControllers.get(chatId)?.abort();
		const controller = new AbortController();
		this.#updateControllers.set(chatId, controller);

		try {
			const res = await fetchWithTimeout('/api/chat/pinned', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ chatId, pinned }),
				timeout: 5000,
				retries: 1,
				signal: controller.signal
			});
			if (!res.ok) {
				logger.error('Failed to update chat pinned status', { chatId, pinned });
				await this.refetch();
			}
		} catch (error) {
			if ((error as Error).name === 'AbortError') return;
			logger.error('Failed to update chat pinned status', error);
			this.chats = previousChats;
		} finally {
			if (this.#updateControllers.get(chatId) === controller) {
				this.#updateControllers.delete(chatId);
			}
		}
	};

	/**
	 * Deletes a chat record both locally and on the server.
	 */
	deleteChat = async (chatId: string) => {
		const previousChats = this.chats;
		const previousGenerating = Array.from(this.generatingByChatId);
		this.#unreadControllers.get(chatId)?.abort();
		this.#unreadControllers.delete(chatId);
		this.chats = this.chats.filter((c) => c.id !== chatId);
		this.clearChatTransientState(chatId);
		try {
			const res = await fetchWithTimeout('/api/chat', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ id: chatId }),
				timeout: 5000,
				retries: 1
			});
			if (!res.ok) {
				logger.error('Failed to delete chat', { chatId });
				await this.refetch();
			}
		} catch (error) {
			logger.error('Failed to delete chat', error);
			this.chats = previousChats;
			this.generatingByChatId.clear();
			for (const id of previousGenerating) this.generatingByChatId.add(id);
			return false;
		}
		return true;
	};

	/**
	 * Deletes all chat records for the user.
	 */
	deleteAllChats = async () => {
		this.#deleteController?.abort();
		this.#deleteController = new AbortController();
		for (const controller of this.#unreadControllers.values()) {
			controller.abort();
		}
		this.#unreadControllers.clear();

		const previousChats = this.chats;
		const previousActiveChatId = this.activeChatId;
		const previousGenerating = Array.from(this.generatingByChatId);
		this.chats = [];
		this.setActiveChatId(null);
		this.generatingByChatId.clear();
		try {
			const res = await fetchWithTimeout('/api/history', {
				method: 'DELETE',
				timeout: 10000,
				retries: 1,
				signal: this.#deleteController.signal
			});
			if (!res.ok) {
				throw new Error();
			}
			return true;
		} catch (error) {
			if ((error as Error).name === 'AbortError') return false;
			logger.error('Failed to delete all chats', error);
			this.chats = previousChats;
			this.setActiveChatId(previousActiveChatId);
			this.generatingByChatId.clear();
			for (const id of previousGenerating) this.generatingByChatId.add(id);
			return false;
		} finally {
			this.#deleteController = null;
		}
	};

	/**
	 * Sets the ChatHistory instance in Svelte context.
	 */
	setContext() {
		setContext(contextKey, this);
	}

	/**
	 * Refetches the entire chat history from the server.
	 */
	async refetch() {
		const currentCount = ++this.#loadCount;
		this.#revalidating = true;
		try {
			const res = await fetchWithTimeout('/api/history', {
				timeout: 10000,
				retries: 2
			});
			if (res.ok) {
				const result = await res.json();
				if (currentCount === this.#loadCount) {
					this.chats = result;
					this.syncTransientState();
				}
			} else {
				logger.error('Failed to refetch chat history', { status: res.status });
			}
		} catch (err) {
			logger.error('Error refetching chat history', err);
		} finally {
			if (currentCount === this.#loadCount) {
				this.#revalidating = false;
			}
		}
	}

	/**
	 * Retrieves the ChatHistory instance from Svelte context.
	 */
	static fromContext(): ChatHistory {
		return getContext(contextKey);
	}
}
