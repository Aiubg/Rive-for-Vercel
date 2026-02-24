import { logger } from '$lib/utils/logger';
import { fetchWithTimeout } from '$lib/utils/network';
import { getContext, setContext } from 'svelte';

export class SynchronizedCookie {
	#contextKey: symbol;
	#key: string;
	#value = $state<string>()!;
	#lastRequestId = 0;
	#syncController: AbortController | null = null;

	constructor(key: string, value: string) {
		this.#key = key;
		this.#value = value;
		this.#contextKey = Symbol.for(`SynchronizedCookie:${key}`);
	}

	get key() {
		return this.#key;
	}

	get value() {
		return this.#value;
	}

	set value(v: string) {
		this.update(v);
	}

	update(v: string, silent = false) {
		if (this.#value === v) return;

		if (!silent) {
			const requestId = ++this.#lastRequestId;
			this.#syncController?.abort();
			const controller = new AbortController();
			this.#syncController = controller;
			fetchWithTimeout(`/api/synchronized-cookie/${this.#key}`, {
				method: 'POST',
				body: JSON.stringify({ value: v }),
				headers: {
					'Content-Type': 'application/json'
				},
				timeout: 5000,
				retries: 1,
				signal: controller.signal
			})
				.then(() => {
					if (this.#syncController === controller) {
						this.#syncController = null;
					}
					if (requestId !== this.#lastRequestId) {
						logger.debug(`SynchronizedCookie(${this.#key}): Stale request ignored`);
					}
				})
				.catch((err) => {
					if (this.#syncController === controller) {
						this.#syncController = null;
					}
					if (err instanceof Error && err.name === 'AbortError') {
						return;
					}
					if (requestId === this.#lastRequestId) {
						logger.error(`Failed to sync cookie: ${this.#key}`, err);
					}
				});
		}
		this.#value = v;
	}

	setContext() {
		setContext(this.#contextKey, this);
	}

	static fromContext(key: string): SynchronizedCookie {
		return getContext(Symbol.for(`SynchronizedCookie:${key}`));
	}
}
