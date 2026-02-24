import {
	generateTitleFromUserMessage,
	validateModelApiKey,
	validateModelVisionCompatibility
} from '$lib/server/ai/utils';
import {
	createGenerationRun,
	getChatById,
	getMessageById,
	saveChat,
	saveMessages,
	updateChatTitleById
} from '$lib/server/db/queries';
import type { Chat } from '$lib/server/db/schema';
import { extractTextFromMessage, getMostRecentUserMessage } from '$lib/utils/chat';
import { StartRunSchema } from '$lib/utils/zod';
import { handleServerError, parseJsonBody } from '$lib/server/utils';
import { error } from '@sveltejs/kit';
import type { UIDataTypes, UIMessage, UIMessagePart, UITools } from 'ai';
import { ok, safeTry } from 'neverthrow';
import type { RequestHandler } from './$types';
import { runExecutor } from '$lib/server/ai/run-executor';
import type { Attachment } from '$lib/types/attachment';

export const POST: RequestHandler = async ({ request, locals: { user }, cookies }) => {
	const parsed = await parseJsonBody(request, StartRunSchema);
	if (parsed instanceof Response) {
		return parsed;
	}
	const { id, messages, parentId, assistantMessageId, personalization } = parsed;
	const selectedChatModel = cookies.get('selected-model');

	if (!user) {
		throw error(401, 'common.unauthorized');
	}

	if (!selectedChatModel) {
		throw error(400, 'models.no_model_selected');
	}

	const validation = validateModelApiKey(selectedChatModel);
	if (!validation.isValid) {
		throw error(400, validation.error || 'models.invalid_model');
	}

	const visionValidation = validateModelVisionCompatibility(
		selectedChatModel,
		messages as Array<{ role?: unknown; attachments?: unknown }>
	);
	if (!visionValidation.isValid) {
		throw error(400, visionValidation.error || 'models.vision_not_supported');
	}

	const userMessage = getMostRecentUserMessage(messages);
	if (!userMessage) {
		throw error(400, 'chat.no_user_message');
	}

	const runId = crypto.randomUUID();

	await safeTry(async function* () {
		const chatResult = await getChatById({ id });
		let chat: Chat;

		if (chatResult.isErr()) {
			if (chatResult.error._tag !== 'DbEntityNotFoundError') {
				return chatResult;
			}

			const contentForTitle =
				typeof userMessage.content === 'string'
					? userMessage.content
					: extractTextFromMessage(userMessage as unknown as UIMessage);

			const tempTitle =
				contentForTitle.length > 50 ? contentForTitle.slice(0, 47) + '...' : contentForTitle;
			chat = yield* saveChat({ id, userId: user.id, title: tempTitle || 'New Chat' });
			void (async () => {
				const titleResult = await generateTitleFromUserMessage({
					message: { id: userMessage.id, role: 'user', content: contentForTitle }
				});
				if (titleResult.isOk()) {
					await updateChatTitleById({ chatId: id, title: titleResult.value });
				}
			})();
		} else {
			chat = chatResult.value;
			if (chat.userId !== user.id) {
				throw error(403, 'common.forbidden');
			}
		}

		let effectiveParentId = parentId || null;
		if (effectiveParentId) {
			const parentCheck = await getMessageById({ id: effectiveParentId });
			if (parentCheck.isErr()) {
				if (parentCheck.error._tag === 'DbEntityNotFoundError') {
					effectiveParentId = null;
				} else {
					return parentCheck;
				}
			}
		}

		const userParts = (
			Array.isArray(userMessage.parts)
				? userMessage.parts.filter((p) => p.type === 'text' && typeof p.text === 'string')
				: []
		) as UIMessagePart<UIDataTypes, UITools>[];

		const userAttachments =
			'attachments' in userMessage &&
			Array.isArray((userMessage as { attachments?: Attachment[] }).attachments)
				? ((userMessage as { attachments?: Attachment[] }).attachments as Attachment[])
				: [];

		const assistantParts: UIMessage['parts'] = [];

		yield* saveMessages({
			messages: [
				{
					id: userMessage.id,
					chatId: id,
					role: 'user',
					parts: userParts,
					attachments: userAttachments,
					createdAt: new Date(),
					parentId: effectiveParentId
				},
				{
					id: assistantMessageId,
					chatId: id,
					role: 'assistant',
					parts: assistantParts,
					attachments: [],
					createdAt: new Date(),
					parentId: userMessage.id
				}
			]
		});

		yield* createGenerationRun({
			run: {
				id: runId,
				chatId: id,
				userId: user.id,
				status: 'queued',
				modelId: selectedChatModel,
				userMessageId: userMessage.id,
				assistantMessageId,
				messages: messages as unknown as UIMessage[],
				personalization: personalization ?? {},
				cursor: 0,
				createdAt: new Date(),
				startedAt: null,
				finishedAt: null,
				error: null
			}
		});

		return ok(undefined);
	}).match(
		() => undefined,
		(e) => handleServerError(e, 'common.internal_server_error', { id, runId })
	);

	runExecutor.enqueue(runId, id);

	return new Response(JSON.stringify({ runId, assistantMessageId }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
