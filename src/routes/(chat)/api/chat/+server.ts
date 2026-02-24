import { logger } from '$lib/utils/logger';
import { myProvider } from '$lib/server/ai/models';
import { systemPrompt } from '$lib/server/ai/prompts';
import { getModelRequestPreset } from '$lib/ai/model-registry';
import {
	convertToCoreMessagesWithResolvedImages,
	generateTitleFromUserMessage,
	mapModelProviderErrorToErrorKey,
	validateModelApiKey,
	validateModelVisionCompatibility
} from '$lib/server/ai/utils';
import {
	deleteChatById,
	getChatById,
	getMessageById,
	saveChat,
	saveMessages
} from '$lib/server/db/queries';
import type { Chat } from '$lib/server/db/schema';
import { extractTextFromMessage, getMostRecentUserMessage } from '$lib/utils/chat';
import { allowAnonymousChats } from '$lib/utils/constants';
import { ChatRequestSchema, DeleteChatSchema } from '$lib/utils/zod';
import { verifyChatOwnership, handleServerError, parseJsonBody } from '$lib/server/utils';
import { error } from '@sveltejs/kit';
import {
	streamText,
	stepCountIs,
	type UIMessage,
	type UIMessagePart,
	type UIDataTypes,
	type UITools
} from 'ai';
import { selectTools, buildToolContext } from '$lib/server/ai/tools/selection';
import { toAiTools } from '$lib/server/ai/tools/ai-adapter';
import type { Attachment } from '$lib/types/attachment';
import { ok, safeTry } from 'neverthrow';
import type { RequestHandler } from './$types';
import { getCitationMetrics } from '$lib/utils/citations';

export const POST: RequestHandler = async ({ request, locals: { user }, cookies, url }) => {
	const parsed = await parseJsonBody(request, ChatRequestSchema);
	if (parsed instanceof Response) {
		return parsed;
	}
	const { id, messages, parentId, assistantMessageId, personalization } = parsed;
	const selectedChatModel = cookies.get('selected-model');

	if (!user && !allowAnonymousChats) {
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

	if (user) {
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

				const title = yield* generateTitleFromUserMessage({
					message: { id: userMessage.id, role: 'user', content: contentForTitle }
				});

				chat = yield* saveChat({ id, userId: user.id, title });
			} else {
				chat = chatResult.value;
				if (chat.userId !== user.id) {
					throw error(403, 'common.forbidden');
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
					}
				]
			});

			return ok(undefined);
		}).orElse((e) => {
			handleServerError(e, 'common.internal_server_error', {
				id,
				parentId,
				assistantMessageId
			});
		});
	}

	const coreMessages = await convertToCoreMessagesWithResolvedImages(messages);
	let nextSearchResultId = 1;
	const allocateSearchResultId = () => nextSearchResultId++;

	const selectionCtx = {
		modelId: selectedChatModel,
		userId: user?.id,
		chatId: id,
		allocateSearchResultId
	};
	const selectedToolRecords = selectTools(selectionCtx);
	const tools =
		selectedToolRecords.length > 0
			? toAiTools(selectedToolRecords, () => buildToolContext(selectionCtx))
			: undefined;

	const sendReasoning = true;

	const now = new Date();
	const localeHeader = request.headers.get('accept-language') ?? '';
	const primaryLocale = localeHeader.split(',')[0] || undefined;
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const requestUrl = url.toString();
	const modelRequestPreset = getModelRequestPreset(selectedChatModel);

	try {
		const result = streamText({
			model: myProvider.languageModel(selectedChatModel),
			system: systemPrompt({
				selectedChatModel,
				personalization,
				context: {
					nowIso: now.toISOString(),
					timeZone,
					locale: primaryLocale,
					url: requestUrl
				}
			}),
			messages: coreMessages,
			...(tools ? { tools, stopWhen: stepCountIs(30) } : {}),
			...(modelRequestPreset?.providerOptions
				? { providerOptions: modelRequestPreset.providerOptions }
				: {})
		});

		return result.toUIMessageStreamResponse({
			originalMessages: messages as unknown as UIMessage[],
			sendReasoning,
			onFinish: async ({ responseMessage }) => {
				if (!responseMessage || responseMessage.role !== 'assistant') return;
				const mappedParts = (
					Array.isArray(responseMessage.parts) ? responseMessage.parts : []
				) as UIMessagePart<UIDataTypes, UITools>[];
				const metrics = getCitationMetrics(mappedParts as unknown[]);
				logger.debug('[citation] response metrics', {
					chatId: id,
					modelId: selectedChatModel,
					sourceCount: metrics.sourceCount,
					markerCount: metrics.markerCount,
					fallbackLikely: metrics.fallbackLikely
				});
				if (!user) return;
				const assistantId =
					assistantMessageId && assistantMessageId.length > 0
						? assistantMessageId
						: responseMessage.id && responseMessage.id.length > 0
							? responseMessage.id
							: crypto.randomUUID();
				try {
					const result = await saveMessages({
						messages: [
							{
								id: assistantId,
								chatId: id,
								role: 'assistant',
								parts: mappedParts,
								attachments: [],
								createdAt: new Date(),
								parentId: userMessage.id
							}
						]
					});
					if (result.isErr()) {
						logger.error('Failed to save assistant message', result.error);
					}
				} catch (e) {
					logger.error('Unexpected error saving assistant message', e);
				}
			}
		});
	} catch (e) {
		const mappedErrorKey = mapModelProviderErrorToErrorKey(e);
		if (mappedErrorKey) {
			handleServerError(e, mappedErrorKey, { id, selectedChatModel }, 400);
		}
		handleServerError(e, 'chat.model_request_failed', { id, selectedChatModel }, 502);
	}
};

export const DELETE: RequestHandler = async ({ locals: { user }, request }) => {
	const parsed = await parseJsonBody(request, DeleteChatSchema);
	if (parsed instanceof Response) {
		return parsed;
	}
	const { id } = parsed;

	await verifyChatOwnership({ chatId: id, user });

	return await deleteChatById({ id }).match(
		() => new Response(null, { status: 204 }),
		(err) => {
			handleServerError(err, 'common.internal_server_error', { id });
		}
	);
};
