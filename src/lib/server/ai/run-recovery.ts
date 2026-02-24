import { failAllActiveGenerationRuns } from '$lib/server/db/queries';
import { logger } from '$lib/utils/logger';

let recoveryPromise: Promise<void> | null = null;

export function ensureRunRecovery() {
	if (recoveryPromise) return recoveryPromise;
	recoveryPromise = (async () => {
		const res = await failAllActiveGenerationRuns();
		if (res.isErr()) {
			logger.error('Failed to recover generation runs', res.error);
			return;
		}
		if (res.value > 0) {
			logger.info('Recovered generation runs', { count: res.value });
		}
	})();
	return recoveryPromise;
}
