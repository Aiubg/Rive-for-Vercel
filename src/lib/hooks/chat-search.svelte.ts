import { getContext, setContext } from 'svelte';
import { fetchWithTimeout } from '$lib/utils/network';
import { SvelteDate } from 'svelte/reactivity';

type ChatSearchApiResult = {
	chatId: string;
	chatTitle: string;
	messageId?: string | null;
	messageSnippet: string;
	createdAt: string;
};

export type ChatSearchResult = {
	chatId: string;
	chatTitle: string;
	messageId?: string;
	messageSnippet: string;
	createdAt: SvelteDate;
};

export class ChatSearchState {
	#isOpen = $state(false);
	#requestId = 0;
	#abortController: AbortController | null = null;
	query = $state('');
	results = $state<ChatSearchResult[]>([]);
	isLoading = $state(false);
	error = $state<string | null>(null);

	get isOpen() {
		return this.#isOpen;
	}

	set isOpen(value: boolean) {
		this.#isOpen = value;
		if (!value) {
			this.query = '';
			this.results = [];
			this.error = null;
			this.isLoading = false;
			this.#abortController?.abort();
			this.#abortController = null;
		}
	}

	async search(q: string) {
		this.query = q;
		const trimmed = q.trim();
		if (!trimmed) {
			this.#abortController?.abort();
			this.#abortController = null;
			this.results = [];
			this.error = null;
			this.isLoading = false;
			return;
		}

		this.isLoading = true;
		this.error = null;
		const requestId = ++this.#requestId;
		this.#abortController?.abort();
		this.#abortController = new AbortController();

		try {
			const response = await fetchWithTimeout(`/api/chat/search?q=${encodeURIComponent(q)}`, {
				timeout: 8000,
				retries: 0,
				signal: this.#abortController.signal
			});
			if (requestId !== this.#requestId) return;
			if (!response.ok) {
				let errorKey = 'common.request_failed';
				try {
					const rawText = await response.text();
					if (rawText) {
						try {
							const parsed = JSON.parse(rawText) as { message?: unknown };
							if (parsed && typeof parsed.message === 'string') {
								errorKey = parsed.message;
							} else {
								errorKey = rawText;
							}
						} catch {
							errorKey = rawText;
						}
					}
				} catch {
					// ignore
				}
				throw new Error(errorKey);
			}
			const data = (await response.json()) as { results: ChatSearchApiResult[] };
			if (requestId !== this.#requestId) return;
			this.results = data.results.map((r) => ({
				chatId: r.chatId,
				chatTitle: r.chatTitle,
				messageId: r.messageId ?? undefined,
				messageSnippet: r.messageSnippet,
				createdAt: new SvelteDate(r.createdAt)
			}));
		} catch (err) {
			if (requestId !== this.#requestId) return;
			if (err instanceof Error && err.name === 'AbortError') return;
			const raw = err instanceof Error ? err.message : 'common.unknown_error';
			this.error = raw.includes('.') ? raw : 'common.request_failed';
			this.results = [];
		} finally {
			if (requestId === this.#requestId) {
				this.isLoading = false;
				this.#abortController = null;
			}
		}
	}

	open() {
		this.isOpen = true;
	}

	close() {
		this.isOpen = false;
	}

	toggle() {
		this.isOpen = !this.isOpen;
	}
}

const CHAT_SEARCH_KEY = Symbol('CHAT_SEARCH');

export function setChatSearchContext() {
	const state = new ChatSearchState();
	setContext(CHAT_SEARCH_KEY, state);
	return state;
}

export function getChatSearchContext() {
	return getContext<ChatSearchState>(CHAT_SEARCH_KEY);
}
