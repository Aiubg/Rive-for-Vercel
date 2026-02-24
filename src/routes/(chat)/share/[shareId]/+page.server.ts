import {
	getChatByShareId,
	getGenerationRunsByChatId,
	getRunEventsAfterSeq,
	updateMessagePartsById
} from '$lib/server/db/queries';
import { aggregateRunEventsToParts } from '$lib/server/ai/utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params: { shareId } }) => {
	const result = await getChatByShareId({ shareId });

	if (result.isErr()) {
		throw error(404, 'common.not_found');
	}

	const messages = result.value.messages;
	const hasToolParts = (parts: unknown) =>
		Array.isArray(parts) &&
		parts.some((p) => p && (p.type === 'tool-invocation' || p.type === 'dynamic-tool'));
	const missingToolParts = messages.filter((m) => m.role === 'assistant' && !hasToolParts(m.parts));
	if (missingToolParts.length > 0) {
		const runsResult = await getGenerationRunsByChatId({ chatId: result.value.chat.id });
		if (runsResult.isOk()) {
			const runByAssistantId = new Map(
				runsResult.value.map((run) => [run.assistantMessageId, run.id])
			);
			for (const msg of missingToolParts) {
				const runId = runByAssistantId.get(msg.id);
				if (!runId) continue;
				const eventsResult = await getRunEventsAfterSeq({ runId, afterSeq: 0 });
				if (eventsResult.isErr() || eventsResult.value.length === 0) continue;
				const latestParts = aggregateRunEventsToParts(eventsResult.value);
				if (latestParts.length === 0) continue;
				msg.parts = latestParts as typeof msg.parts;
				await updateMessagePartsById({ messageId: msg.id, parts: latestParts });
			}
		}
	}

	return {
		chat: result.value.chat,
		messages
	};
};
