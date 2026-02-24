import { streamText, stepCountIs, type UIMessage } from 'ai';
import { logger } from '$lib/utils/logger';
import { myProvider } from '$lib/server/ai/models';
import { systemPrompt } from '$lib/server/ai/prompts';
import { getModelRequestPreset } from '$lib/ai/model-registry';
import {
	convertToCoreMessagesWithResolvedImages,
	mapModelProviderErrorToErrorKey,
	validateModelApiKey,
	validateModelVisionCompatibility
} from '$lib/server/ai/utils';
import { selectTools, buildToolContext } from '$lib/server/ai/tools/selection';
import { toAiTools } from '$lib/server/ai/tools/ai-adapter';
import { env as privateEnv } from '$env/dynamic/private';
import {
	appendRunEvent,
	getGenerationRunById,
	updateChatUnreadById,
	updateGenerationRunStatus,
	updateMessagePartsById
} from '$lib/server/db/queries';
import { runEventBus } from '$lib/server/ai/run-event-bus';
import { getCitationMetrics } from '$lib/utils/citations';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

async function* iterateReadableStream<T>(stream: ReadableStream<T>): AsyncGenerator<T> {
	const reader = stream.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			yield value;
		}
	} finally {
		await reader.cancel().catch(() => {});
	}
}

type QueueItem = { runId: string; chatId: string };

class RunExecutor {
	private queue: QueueItem[] = [];
	private queuedRunIds = new Set<string>();
	private runningCount = 0;
	private activeChatIds = new Set<string>();
	private draining = false;
	private drainRequested = false;
	private abortControllersByRunId = new Map<string, AbortController>();
	private maxConcurrency = parseMaxConcurrency(privateEnv.RUN_EXECUTOR_MAX_CONCURRENCY);

	enqueue(runId: string, chatId: string) {
		if (this.queuedRunIds.has(runId)) return;
		if (this.abortControllersByRunId.has(runId)) return;
		this.queue.push({ runId, chatId });
		this.queuedRunIds.add(runId);
		void this.drain();
	}

	cancel(runId: string) {
		const ctrl = this.abortControllersByRunId.get(runId);
		if (ctrl) {
			ctrl.abort();
		}
	}

	private async emitRunControlEvent(
		runId: string,
		payload: { type: string; errorText?: string }
	): Promise<void> {
		const chunkJson = JSON.stringify(payload);
		const ev = await appendRunEvent({ runId, chunkJson });
		if (ev.isErr()) {
			logger.error('Failed to append control run event', ev.error);
			return;
		}
		runEventBus.emit({ runId, seq: ev.value.seq, chunk: ev.value.chunk });
	}

	private async emitRunFailureEvents(runId: string, errorKey: string): Promise<void> {
		await this.emitRunControlEvent(runId, { type: 'error', errorText: errorKey });
		await this.emitRunControlEvent(runId, { type: 'finish' });
	}

	private async drain() {
		if (this.draining) {
			this.drainRequested = true;
			return;
		}
		this.draining = true;
		try {
			while (this.runningCount < this.maxConcurrency) {
				const idx = this.queue.findIndex((item) => !this.activeChatIds.has(item.chatId));
				if (idx === -1) return;
				const item = this.queue.splice(idx, 1)[0];
				if (!item) return;

				this.queuedRunIds.delete(item.runId);
				this.runningCount += 1;
				this.activeChatIds.add(item.chatId);

				void this.execute(item.runId).finally(() => {
					this.runningCount -= 1;
					this.activeChatIds.delete(item.chatId);
					void this.drain();
				});
			}
		} finally {
			this.draining = false;
			if (this.drainRequested) {
				this.drainRequested = false;
				void this.drain();
			}
		}
	}

	private async execute(runId: string) {
		const runRes = await getGenerationRunById({ id: runId });
		if (runRes.isErr()) {
			logger.error('Failed to load run', runRes.error);
			return;
		}
		const run = runRes.value;
		if (run.status !== 'queued') {
			return;
		}

		const validation = validateModelApiKey(run.modelId);
		if (!validation.isValid) {
			const errorKey = validation.error || 'models.missing_api_key';
			await updateGenerationRunStatus({
				runId,
				status: 'failed',
				error: errorKey
			});
			await this.emitRunFailureEvents(runId, errorKey);
			return;
		}

		const visionValidation = validateModelVisionCompatibility(
			run.modelId,
			run.messages as Array<{ role?: unknown; attachments?: unknown }>
		);
		if (!visionValidation.isValid) {
			const errorKey = visionValidation.error || 'models.vision_not_supported';
			await updateGenerationRunStatus({
				runId,
				status: 'failed',
				error: errorKey
			});
			await this.emitRunFailureEvents(runId, errorKey);
			return;
		}

		const abortController = new AbortController();
		this.abortControllersByRunId.set(runId, abortController);

		await updateGenerationRunStatus({ runId, status: 'running' });

		try {
			const coreMessages = await convertToCoreMessagesWithResolvedImages(
				run.messages as unknown as UIMessage[]
			);
			let nextSearchResultId = 1;
			const allocateSearchResultId = () => nextSearchResultId++;
			const selectionCtx = {
				modelId: run.modelId,
				userId: run.userId,
				chatId: run.chatId,
				allocateSearchResultId
			};
			const selectedToolRecords = selectTools(selectionCtx);
			const tools =
				selectedToolRecords.length > 0
					? toAiTools(selectedToolRecords, () => buildToolContext(selectionCtx))
					: undefined;

			const now = new Date();
			const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const modelRequestPreset = getModelRequestPreset(run.modelId);

			const result = streamText({
				model: myProvider.languageModel(run.modelId),
				system: systemPrompt({
					selectedChatModel: run.modelId,
					personalization: run.personalization as never,
					context: {
						nowIso: now.toISOString(),
						timeZone,
						locale: undefined,
						url: undefined
					}
				}),
				messages: coreMessages,
				...(tools ? { tools, stopWhen: stepCountIs(30) } : {}),
				...(modelRequestPreset?.providerOptions
					? { providerOptions: modelRequestPreset.providerOptions }
					: {}),
				abortSignal: abortController.signal
			});

			const uiResponse = (
				result as unknown as {
					toUIMessageStreamResponse: (options: {
						originalMessages: UIMessage[];
						sendReasoning?: boolean;
						onFinish?: (args: { responseMessage?: UIMessage; isAborted?: boolean }) => void;
					}) => Response;
				}
			).toUIMessageStreamResponse({
				originalMessages: run.messages as unknown as UIMessage[],
				sendReasoning: true,
				onFinish: async ({ responseMessage, isAborted }) => {
					if (isAborted) return;
					if (!responseMessage || responseMessage.role !== 'assistant') return;
					const parts = Array.isArray(responseMessage.parts) ? responseMessage.parts : [];
					const metrics = getCitationMetrics(parts as unknown[]);
					logger.debug('[citation] run completion metrics', {
						runId,
						chatId: run.chatId,
						modelId: run.modelId,
						sourceCount: metrics.sourceCount,
						markerCount: metrics.markerCount,
						fallbackLikely: metrics.fallbackLikely
					});
					const upd = await updateMessagePartsById({
						messageId: run.assistantMessageId,
						parts: parts as never
					});
					if (upd.isErr()) {
						logger.error('Failed to persist final assistant parts', upd.error);
					}
				}
			});

			if (!uiResponse.body) {
				throw new Error('Empty UI stream response body');
			}

			const decoder = new TextDecoder();
			let buffer = '';

			for await (const value of iterateReadableStream(uiResponse.body)) {
				buffer += decoder.decode(value, { stream: true });
				const parts = buffer.split('\n\n');
				buffer = parts.pop() ?? '';

				for (const part of parts) {
					const lines = part.split('\n').map((l) => l.trim());
					for (const line of lines) {
						if (line === '') continue;
						if (!line.startsWith('data:')) continue;
						const dataStr = line.slice(5).trim();
						if (dataStr === '') continue;
						let parsed: JsonValue | null = null;
						try {
							parsed = JSON.parse(dataStr) as JsonValue;
						} catch {
							continue;
						}

						const safeChunk = truncateEventChunk(parsed, dataStr);
						const ev = await appendRunEvent({ runId, chunkJson: safeChunk });
						if (ev.isErr()) {
							logger.error('Failed to append run event', ev.error);
							continue;
						}
						runEventBus.emit({ runId, seq: ev.value.seq, chunk: ev.value.chunk });
					}
				}
			}

			if (!abortController.signal.aborted) {
				await updateGenerationRunStatus({ runId, status: 'succeeded' });
				const unreadRes = await updateChatUnreadById({
					chatId: run.chatId,
					userId: run.userId,
					unread: true
				});
				if (unreadRes.isErr()) {
					logger.error('Failed to update chat unread status', unreadRes.error);
				}
			}
		} catch (e) {
			const isAborted = abortController.signal.aborted;
			if (isAborted) {
				await updateGenerationRunStatus({ runId, status: 'canceled' });
			} else {
				logger.error('Run execution failed', e);
				const errorKey = mapModelProviderErrorToErrorKey(e) || 'run.failed';
				await updateGenerationRunStatus({ runId, status: 'failed', error: errorKey });
				await this.emitRunFailureEvents(runId, errorKey);
			}
		} finally {
			this.abortControllersByRunId.delete(runId);
		}
	}
}

function parseMaxConcurrency(raw: string | undefined) {
	const n = Number(raw);
	if (!Number.isFinite(n)) return 5;
	const i = Math.trunc(n);
	if (i <= 0) return 5;
	return Math.min(i, 8);
}

export const runExecutor = new RunExecutor();

function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number) {
	const n = Number(raw);
	if (!Number.isFinite(n)) return fallback;
	const i = Math.trunc(n);
	if (i < min) return min;
	if (i > max) return max;
	return i;
}

const MAX_EVENT_CHARS = parseBoundedInt(privateEnv.RUN_EVENT_MAX_CHARS, 60000, 4000, 200000);
const TOOL_EVENT_MAX_CHARS = parseBoundedInt(
	privateEnv.RUN_EVENT_TOOL_MAX_CHARS,
	20000,
	2000,
	100000
);
const MAX_EVENT_STRING_CHARS = parseBoundedInt(
	privateEnv.RUN_EVENT_MAX_STRING_CHARS,
	4000,
	200,
	20000
);
const MAX_EVENT_ARRAY_LENGTH = parseBoundedInt(privateEnv.RUN_EVENT_MAX_ARRAY_LENGTH, 30, 5, 200);
const MAX_EVENT_DEPTH = parseBoundedInt(privateEnv.RUN_EVENT_MAX_DEPTH, 6, 2, 12);

function truncateJsonValue(value: JsonValue, depth: number): JsonValue {
	if (typeof value === 'string') {
		return value.length > MAX_EVENT_STRING_CHARS ? value.slice(0, MAX_EVENT_STRING_CHARS) : value;
	}
	if (typeof value !== 'object' || value === null) {
		return value;
	}
	if (depth >= MAX_EVENT_DEPTH) {
		return value;
	}
	if (Array.isArray(value)) {
		const sliced = value.slice(0, MAX_EVENT_ARRAY_LENGTH);
		return sliced.map((item) => truncateJsonValue(item as JsonValue, depth + 1));
	}
	const out: Record<string, JsonValue> = {};
	for (const [key, val] of Object.entries(value)) {
		out[key] = truncateJsonValue(val as JsonValue, depth + 1);
	}
	return out;
}

function truncateEventChunk(parsed: JsonValue, original: string): string {
	const type =
		parsed && typeof parsed === 'object' && 'type' in parsed && typeof parsed.type === 'string'
			? parsed.type
			: '';
	const limit = type.startsWith('tool-') ? TOOL_EVENT_MAX_CHARS : MAX_EVENT_CHARS;
	if (original.length <= limit) {
		return original;
	}
	const truncated = truncateJsonValue(parsed, 0);
	const json = JSON.stringify(truncated);
	if (json.length <= limit) {
		return json;
	}
	return JSON.stringify({ type: type || 'event', truncated: true });
}
