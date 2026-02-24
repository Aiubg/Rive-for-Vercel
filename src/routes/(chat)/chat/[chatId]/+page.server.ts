import {
	getChatById,
	getMessagesByChatId,
	getActiveGenerationRunByChatId,
	getRunEventsAfterSeq,
	getGenerationRunsByChatId,
	updateMessagePartsById
} from '$lib/server/db/queries';
import { aggregateRunEventsToParts } from '$lib/server/ai/utils';
import { error } from '@sveltejs/kit';
import { ok, safeTry } from 'neverthrow';
import { handleServerError } from '$lib/server/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params: { chatId }, locals: { user } }) => {
	return safeTry(async function* () {
		const chat = yield* getChatById({ id: chatId }).mapErr(() => error(404, 'common.not_found'));
		if (chat.visibility === 'private') {
			if (!user || chat.userId !== user.id) {
				throw error(404, 'common.not_found');
			}
		}
		const messages = yield* getMessagesByChatId({ id: chatId });

		const hasToolParts = (parts: unknown) =>
			Array.isArray(parts) &&
			parts.some((p) => p && (p.type === 'tool-invocation' || p.type === 'dynamic-tool'));

		let activeRun = null;

		if (user) {
			const activeRunResult = yield* getActiveGenerationRunByChatId({
				chatId,
				userId: user.id
			});

			if (activeRunResult) {
				const run = activeRunResult;
				const events = yield* getRunEventsAfterSeq({ runId: run.id, afterSeq: 0 });

				if (events.length > 0) {
					const latestParts = aggregateRunEventsToParts(events);
					const lastEvent = events[events.length - 1];
					const lastSeq = lastEvent ? lastEvent.seq : 0;

					const assistantMessageIndex = messages.findIndex((m) => m.id === run.assistantMessageId);
					const assistantMessage =
						assistantMessageIndex !== -1 ? messages[assistantMessageIndex] : undefined;
					if (assistantMessage) {
						messages[assistantMessageIndex] = {
							...assistantMessage,
							parts: latestParts
						};
					}

					activeRun = {
						id: run.id,
						assistantMessageId: run.assistantMessageId,
						cursor: lastSeq
					};
				} else {
					activeRun = {
						id: run.id,
						assistantMessageId: run.assistantMessageId,
						cursor: 0
					};
				}
			}
		}

		const missingToolParts = messages.filter(
			(m) => m.role === 'assistant' && !hasToolParts(m.parts)
		);
		if (missingToolParts.length > 0) {
			const runs = yield* getGenerationRunsByChatId({ chatId });
			const runByAssistantId = new Map(runs.map((run) => [run.assistantMessageId, run.id]));

			for (const msg of missingToolParts) {
				const runId = runByAssistantId.get(msg.id);
				if (!runId) continue;
				const events = yield* getRunEventsAfterSeq({ runId, afterSeq: 0 });
				if (events.length === 0) continue;
				const latestParts = aggregateRunEventsToParts(events);
				if (latestParts.length === 0) continue;
				msg.parts = latestParts as typeof msg.parts;
				yield* updateMessagePartsById({ messageId: msg.id, parts: latestParts });
			}
		}

		return ok({ chat, messages, activeRun });
	}).match(
		(result) => result,
		(e) => handleServerError(e, 'common.internal_server_error', { chatId })
	);
};
