import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	appendRunEvent,
	getGenerationRunById,
	updateGenerationRunStatus,
	getRunEventsAfterSeq,
	updateMessagePartsById
} from '$lib/server/db/queries';
import { handleServerError } from '$lib/server/utils';
import { runExecutor } from '$lib/server/ai/run-executor';
import { runEventBus } from '$lib/server/ai/run-event-bus';
import type { Message } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ params, locals: { user } }) => {
	if (!user) {
		throw error(401, 'common.unauthorized');
	}

	const runId = params.runId;
	const runRes = await getGenerationRunById({ id: runId });
	if (runRes.isErr()) {
		if (runRes.error._tag === 'DbEntityNotFoundError') {
			throw error(404, 'common.not_found');
		}
		handleServerError(runRes.error, 'common.internal_server_error', { runId });
	}
	const run = runRes.value;
	if (run.userId !== user.id) {
		throw error(403, 'common.forbidden');
	}

	await updateGenerationRunStatus({ runId, status: 'canceled' }).match(
		() => undefined,
		(e) => handleServerError(e, 'common.internal_server_error', { runId })
	);

	runExecutor.cancel(runId);

	const finishEv = await appendRunEvent({ runId, chunkJson: JSON.stringify({ type: 'finish' }) });
	if (finishEv.isOk()) {
		runEventBus.emit({ runId, seq: finishEv.value.seq, chunk: finishEv.value.chunk });
	}

	// Persist current message state so it doesn't disappear on refresh
	const eventsRes = await getRunEventsAfterSeq({ runId, afterSeq: 0 });
	if (eventsRes.isOk()) {
		const events = eventsRes.value;
		const parts: Message['parts'] = [];

		for (const ev of events) {
			let rec: unknown;
			try {
				rec = JSON.parse(ev.chunk);
			} catch {
				continue;
			}

			if (typeof rec !== 'object' || rec === null) {
				continue;
			}
			const recObj = rec as Record<string, unknown>;
			const type = typeof recObj.type === 'string' ? recObj.type : undefined;

			if (type === 'text-start') {
				parts.push({ type: 'text', text: '' });
			} else if (type === 'text-delta') {
				const delta = typeof recObj.delta === 'string' ? recObj.delta : '';
				let lastPart = parts[parts.length - 1];
				if (lastPart?.type !== 'text') {
					lastPart = { type: 'text', text: '' };
					parts.push(lastPart);
				}
				lastPart.text += delta;
			} else if (type === 'text-end') {
				const finalText =
					(typeof recObj.text === 'string' ? recObj.text : undefined) ??
					(typeof recObj.delta === 'string' ? recObj.delta : undefined) ??
					'';
				if (finalText) {
					const lastPart = parts[parts.length - 1];
					if (lastPart?.type === 'text') {
						lastPart.text = finalText;
					}
				}
			} else if (type === 'reasoning-start') {
				parts.push({ type: 'reasoning', text: '' });
			} else if (type === 'reasoning-delta') {
				const delta =
					(typeof recObj.delta === 'string' ? recObj.delta : undefined) ??
					(typeof recObj.reasoningDelta === 'string' ? recObj.reasoningDelta : undefined) ??
					(typeof recObj.reasoning === 'string' ? recObj.reasoning : undefined) ??
					'';
				let lastPart = parts[parts.length - 1];
				if (lastPart?.type !== 'reasoning') {
					lastPart = { type: 'reasoning', text: '' };
					parts.push(lastPart);
				}
				lastPart.text += delta;
			}
			// Note: Tool invocations are complex to reconstruct fully from events if they were interrupted,
			// but for the "disappearing message" bug, preserving text and reasoning is the priority.
		}

		if (parts.length > 0) {
			await updateMessagePartsById({ messageId: run.assistantMessageId, parts });
		}
	}

	return new Response(null, { status: 204 });
};
