import { logger } from '$lib/utils/logger';
import { fetchWithTimeout } from '$lib/utils/network';
import type { Share } from '$lib/types/db';
import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

const contextKey = Symbol('SharesState');

export type ShareWithChat = Share & { chat: { title: string } };

export class SharesState {
	shares = $state<ShareWithChat[]>([]);
	loading = $state(false);
	#loadCount = 0;
	#getControllers = new SvelteMap<string, AbortController>();
	#generateControllers = new SvelteMap<string, AbortController>();
	#revokeControllers = new SvelteMap<string, AbortController>();

	async load() {
		const currentCount = ++this.#loadCount;
		this.loading = true;
		try {
			const res = await fetchWithTimeout('/api/shares', { timeout: 10000, retries: 1 });
			if (res.ok) {
				const result = await res.json();
				if (currentCount === this.#loadCount) {
					this.shares = result;
				}
			}
		} catch (e) {
			logger.error('Failed to load shares', e);
		} finally {
			if (currentCount === this.#loadCount) {
				this.loading = false;
			}
		}
	}

	async getForChat(chatId: string): Promise<Share | null> {
		this.#getControllers.get(chatId)?.abort();
		const controller = new AbortController();
		this.#getControllers.set(chatId, controller);

		try {
			const res = await fetchWithTimeout(`/api/chat/share?chatId=${chatId}`, {
				timeout: 5000,
				retries: 1,
				signal: controller.signal
			});
			if (res.ok) {
				return await res.json();
			}
		} catch (e) {
			if ((e as Error).name === 'AbortError') return null;
			logger.error('Failed to load share for chat', e);
		} finally {
			if (this.#getControllers.get(chatId) === controller) {
				this.#getControllers.delete(chatId);
			}
		}
		return null;
	}

	async generate(chatId: string): Promise<Share | null> {
		this.#generateControllers.get(chatId)?.abort();
		const controller = new AbortController();
		this.#generateControllers.set(chatId, controller);

		try {
			const res = await fetchWithTimeout('/api/chat/share', {
				method: 'POST',
				body: JSON.stringify({ chatId }),
				timeout: 10000,
				retries: 1,
				signal: controller.signal
			});
			if (res.ok) {
				return await res.json();
			}
		} catch (e) {
			if ((e as Error).name === 'AbortError') return null;
			logger.error('Failed to generate share', e);
		} finally {
			if (this.#generateControllers.get(chatId) === controller) {
				this.#generateControllers.delete(chatId);
			}
		}
		return null;
	}

	async revoke(shareId: string) {
		this.#revokeControllers.get(shareId)?.abort();
		const controller = new AbortController();
		this.#revokeControllers.set(shareId, controller);

		try {
			const res = await fetchWithTimeout(`/api/shares/${shareId}`, {
				method: 'DELETE',
				timeout: 5000,
				retries: 1,
				signal: controller.signal
			});
			if (res.ok) {
				this.shares = this.shares.filter((s) => s.id !== shareId);
				return true;
			}
		} catch (e) {
			if ((e as Error).name === 'AbortError') return false;
			logger.error('Failed to revoke share', e);
		} finally {
			if (this.#revokeControllers.get(shareId) === controller) {
				this.#revokeControllers.delete(shareId);
			}
		}
		return false;
	}

	setContext() {
		setContext(contextKey, this);
	}

	static fromContext(): SharesState {
		return getContext(contextKey);
	}
}
