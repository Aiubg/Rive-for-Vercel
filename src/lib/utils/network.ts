import { logger } from '$lib/utils/logger';

export interface FetchOptions extends RequestInit {
	timeout?: number;
	retries?: number;
}

function mergeAbortSignals(
	externalSignal: AbortSignal | null | undefined,
	timeoutSignal: AbortSignal
): AbortSignal {
	if (!externalSignal) return timeoutSignal;

	const anyFn = (
		AbortSignal as typeof AbortSignal & {
			any?: (signals: AbortSignal[]) => AbortSignal;
		}
	).any;

	if (typeof anyFn === 'function') {
		return anyFn([externalSignal, timeoutSignal]);
	}

	const controller = new AbortController();
	const abort = () => controller.abort();
	externalSignal.addEventListener('abort', abort, { once: true });
	timeoutSignal.addEventListener('abort', abort, { once: true });
	return controller.signal;
}

/**
 * Wrapper around fetch that supports timeout and retries with exponential backoff.
 *
 * @param input Request URL or Request object
 * @param options Fetch options plus timeout and retries
 * @returns Promise<Response>
 * @throws Error if the request fails after all retries or times out
 */
export async function fetchWithTimeout(
	input: RequestInfo | URL,
	options: FetchOptions = {}
): Promise<Response> {
	const { timeout = 10000, retries = 0, signal: externalSignal, ...fetchOptions } = options;
	const normalizedTimeout = Math.max(0, timeout);
	const normalizedRetries = Math.max(0, Math.floor(retries));

	let lastError: Error | null = null;

	for (let i = 0; i <= normalizedRetries; i++) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), normalizedTimeout);
		const signal = mergeAbortSignals(externalSignal, controller.signal);

		try {
			const response = await fetch(input, {
				...fetchOptions,
				signal
			});
			clearTimeout(timeoutId);
			return response;
		} catch (err) {
			clearTimeout(timeoutId);
			lastError = err as Error;

			if (lastError.name === 'AbortError') {
				if (externalSignal?.aborted) {
					throw lastError;
				}
				logger.warn(`Fetch to ${input} timed out (attempt ${i + 1}/${normalizedRetries + 1})`);
			} else {
				logger.error(`Fetch to ${input} failed (attempt ${i + 1}/${normalizedRetries + 1})`, err);
			}

			if (i < normalizedRetries && !externalSignal?.aborted) {
				// Exponential backoff
				await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000));
			}
		}
	}

	if (lastError) {
		if (lastError.name === 'AbortError') {
			throw lastError;
		}
		throw new Error('common.request_failed');
	}
	throw new Error('common.request_failed');
}
