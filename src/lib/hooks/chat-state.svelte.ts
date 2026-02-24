import type { Chat as ChatClient } from '$lib/types/chat-client';
import type { MessagePart, UIMessageWithTree } from '$lib/types/message';
import type { Attachment } from '$lib/types/attachment';
import { ChatHistory } from '$lib/hooks/chat-history.svelte';
import { personalization } from '$lib/hooks/personalization.svelte';
import type { Chat as DbChat, User } from '$lib/types/db';
import { get } from 'svelte/store';
import { replaceState } from '$app/navigation';
import { resolve } from '$app/paths';
import { SvelteDate, SvelteMap, SvelteSet } from 'svelte/reactivity';
import {
	computeDefaultSelectedMessageIds,
	computeMessagesWithSiblings,
	extractTextFromMessage,
	getMessagePath
} from '$lib/utils/chat';
import { randomId } from '$lib/utils/misc';
import { fetchWithTimeout } from '$lib/utils/network';
import { logger } from '$lib/utils/logger';
import { t } from 'svelte-i18n';
import { toast } from 'svelte-sonner';
import type { SearchResult } from '$lib/hooks/search-sidebar.svelte';
import { getChatDraftStorageKey } from '$lib/components/multimodal/draft-storage';

type UploadResponse = {
	url?: unknown;
	pathname?: unknown;
	contentType?: unknown;
	content?: unknown;
	size?: unknown;
	message?: unknown;
	hash?: unknown;
	lastModified?: unknown;
};

type ChatStreamRecord = {
	type?: string;
	providerMetadata?: {
		openrouter?: {
			reasoning_details?: Array<{ text?: string }>;
		};
	};
	delta?: string;
	reasoningDelta?: string;
	reasoning?: string;
	text?: string;
	toolCallId?: string;
	toolName?: string;
	inputTextDelta?: string;
	input?: unknown;
	output?: unknown;
	errorText?: string;
};

/**
 * ChatState class manages the state and logic for a single chat conversation.
 * It handles message submission, file uploads, streaming responses, and branching logic.
 */
export class ChatState {
	/** Current authenticated user */
	user: User | undefined;
	/** Current chat database record */
	chat = $state<DbChat | undefined>(undefined);

	/** All messages in the conversation tree */
	allMessages = $state<UIMessageWithTree[]>([]);
	/** Mapping of parent message ID to selected child message ID for branching */
	selectedMessageIds = $state<Record<string, string>>({});
	/** Current status of the chat (ready, submitted, streaming, error) */
	status = $state<ChatClient['status']>('ready');
	/** Current text input value */
	input = $state('');
	/** List of uploaded attachments */
	attachments = $state<Attachment[]>([]);
	/** Queue of filenames currently being uploaded */
	uploadQueue = new SvelteSet<string>();

	private abortController: AbortController | null = null;
	private chatHistory = ChatHistory.fromContext();
	private _generatedChatId: string | null = null;
	private activeRunId: string | null = null;
	private uploadControllers = new SvelteMap<string, AbortController>();

	private fileRequestKey(file: File): string {
		return `${file.name}:${file.size}:${file.lastModified}`;
	}

	constructor(
		user: User | undefined,
		chat: DbChat | undefined,
		initialMessages: UIMessageWithTree[],
		options?: { chatId?: string }
	) {
		this.user = user;
		this.chat = chat;
		this.allMessages = initialMessages;
		this._generatedChatId = options?.chatId ?? null;

		const defaultIds = computeDefaultSelectedMessageIds(initialMessages);
		if (typeof window !== 'undefined' && chat?.id) {
			const saved = localStorage.getItem(`chat_path_${chat.id}`);
			if (saved) {
				try {
					this.selectedMessageIds = { ...defaultIds, ...JSON.parse(saved) };
				} catch (_e) {
					this.selectedMessageIds = defaultIds;
				}
			} else {
				this.selectedMessageIds = defaultIds;
			}
		} else {
			this.selectedMessageIds = defaultIds;
		}
	}

	private saveSelectedMessageIds() {
		if (typeof window !== 'undefined') {
			localStorage.setItem(`chat_path_${this.chatId}`, JSON.stringify(this.selectedMessageIds));
		}
	}

	/**
	 * Returns the linear path of messages currently visible based on branching selection.
	 */
	get visibleMessages() {
		return getMessagePath(this.allMessages, this.selectedMessageIds);
	}

	/**
	 * Returns messages along with their siblings for branch switching UI.
	 */
	get messagesWithSiblings() {
		return computeMessagesWithSiblings(this.allMessages, this.visibleMessages);
	}

	/**
	 * Extracts all unique search results from the entire message tree.
	 */
	get searchResults() {
		const results: SearchResult[] = [];
		const seenUrls = new SvelteSet<string>();

		for (const message of this.allMessages) {
			for (const part of message.parts ?? []) {
				const resultObj = part.toolInvocation?.result ?? part.output;
				if (
					(part.toolInvocation?.toolName === 'tavily_search' ||
						part.toolName === 'tavily_search') &&
					resultObj &&
					typeof resultObj === 'object' &&
					'results' in resultObj &&
					Array.isArray((resultObj as { results?: unknown[] }).results)
				) {
					for (const r of (resultObj as { results: SearchResult[] }).results) {
						if (r?.url && !seenUrls.has(r.url)) {
							results.push(r);
							seenUrls.add(r.url);
						}
					}
				}
			}
		}
		return results;
	}

	/**
	 * Returns the current chat ID, generating a random one if it's a new chat.
	 */
	get chatId() {
		if (this.chat) return this.chat.id;
		if (!this._generatedChatId) {
			this._generatedChatId = randomId();
		}
		return this._generatedChatId;
	}

	/**
	 * Uploads a file to the server.
	 * @param file The file to upload.
	 * @returns The uploaded attachment details or undefined on failure.
	 */
	async uploadFile(file: File): Promise<Attachment | undefined> {
		const uploadKey = this.fileRequestKey(file);
		this.uploadControllers.get(uploadKey)?.abort();
		const controller = new AbortController();
		this.uploadControllers.set(uploadKey, controller);

		const formData = new FormData();
		formData.append('file', file);
		try {
			const response = await fetchWithTimeout('/api/files/upload', {
				method: 'POST',
				body: formData,
				timeout: 30000,
				retries: 1,
				signal: controller.signal
			});
			if (response.ok) {
				const data: UploadResponse = await response.json();
				if (
					data &&
					typeof data.url === 'string' &&
					typeof data.pathname === 'string' &&
					typeof data.contentType === 'string'
				) {
					return {
						url: data.url,
						name: data.pathname,
						contentType: data.contentType,
						content: typeof data.content === 'string' ? data.content : undefined,
						size: typeof data.size === 'number' ? data.size : undefined,
						hash: typeof data.hash === 'string' ? data.hash : undefined,
						lastModified: typeof data.lastModified === 'number' ? data.lastModified : undefined
					};
				}
				toast.error(get(t)('upload.invalid_response'));
				return;
			}
			let errorKey = 'upload.failed';
			const rawText = await response.text().catch(() => '');
			if (rawText) {
				try {
					const parsed = JSON.parse(rawText) as { message?: unknown };
					if (parsed && typeof parsed.message === 'string') {
						errorKey = parsed.message;
					} else {
						errorKey = rawText;
					}
				} catch {
					errorKey = rawText;
				}
			}
			toast.error(get(t)(errorKey));
		} catch (error) {
			if ((error as Error).name === 'AbortError') return;
			logger.error('Error uploading file:', error);
			toast.error(get(t)('upload.retry_failed'));
		} finally {
			if (this.uploadControllers.get(uploadKey) === controller) {
				this.uploadControllers.delete(uploadKey);
			}
		}
	}

	/**
	 * Handles a list of files to be uploaded.
	 */
	async handleFileChange(files: File[]) {
		const fileNames = files.map((file) => file.name);
		fileNames.forEach((name) => this.uploadQueue.add(name));
		try {
			const uploaded = await Promise.all(files.map((f) => this.uploadFile(f)));
			const okAttachments = uploaded.filter((a): a is Attachment => a !== undefined);
			if (okAttachments.length > 0) {
				this.attachments = [...this.attachments, ...okAttachments];
			}
		} catch (error) {
			logger.error('File upload process failed', error);
		} finally {
			fileNames.forEach((name) => this.uploadQueue.delete(name));
		}
	}

	/**
	 * Removes an attachment from the current draft only.
	 * This is a local "unlink" action and must not delete the file from the library.
	 */
	async removeAttachment(url: string) {
		this.attachments = this.attachments.filter((a) => a.url !== url);
	}

	/**
	 * Adds or updates attachments on the current draft message.
	 * Existing attachments are deduplicated by URL and merged with incoming fields.
	 */
	addAttachments(nextAttachments: Attachment[]) {
		if (nextAttachments.length === 0) return;

		const merged = [...this.attachments];
		const indexByUrl = new SvelteMap<string, number>();
		for (let i = 0; i < merged.length; i++) {
			const url = merged[i]?.url;
			if (url) indexByUrl.set(url, i);
		}

		for (const incoming of nextAttachments) {
			if (!incoming?.url) continue;
			const existingIndex = indexByUrl.get(incoming.url);
			if (existingIndex === undefined) {
				indexByUrl.set(incoming.url, merged.length);
				merged.push(incoming);
				continue;
			}

			merged[existingIndex] = {
				...merged[existingIndex],
				...incoming
			};
		}

		this.attachments = merged;
	}

	/**
	 * Aborts the current streaming request.
	 */
	async stop() {
		const runId = this.activeRunId;
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
		if (runId) {
			try {
				await fetchWithTimeout(`/api/runs/${runId}/cancel`, {
					method: 'POST',
					timeout: 15000,
					retries: 0
				});
			} catch (_e) {
				// ignore
			}
		}
		this.activeRunId = null;
		this.status = 'ready';
	}

	disconnectStream() {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
	}

	private createUserMessage(text: string) {
		return {
			id: randomId(),
			role: 'user' as const,
			parts: [{ type: 'text' as const, text }],
			attachments: []
		};
	}

	private createAssistantMessage(id: string) {
		return {
			id,
			role: 'assistant' as const,
			parts: [],
			attachments: []
		};
	}

	/**
	 * Finalizes the streaming state and refreshes chat history.
	 */
	async finalizeStreaming() {
		if (this.status !== 'ready') {
			this.status = 'ready';
			this.chatHistory.clearUnread(this.chatId, { force: true });
			await this.chatHistory.refetch();
		}
	}

	/**
	 * Handles message submission.
	 * @param event Optional event object to prevent default behavior.
	 * @param options Submission options (content, attachments, etc.)
	 */
	async handleSubmit(
		event?: Event,
		options?: {
			experimental_attachments?: Attachment[];
			content?: string;
			preserveInput?: boolean;
			parentId?: string | null;
			regenerateMessageId?: string;
			commitUserImmediately?: boolean;
		}
	) {
		if (event) event.preventDefault();
		if (this.status === 'streaming' || this.status === 'submitted') return;
		const preserveInput = options?.preserveInput ?? false;
		const rawInput = options?.content ?? this.input ?? '';
		const content = rawInput.trim();
		const currentAttachments = options?.experimental_attachments ?? this.attachments;
		if (content.length === 0 && !options?.regenerateMessageId && currentAttachments.length === 0)
			return;

		const lastMessage = this.visibleMessages[this.visibleMessages.length - 1];

		let userMessage: UIMessageWithTree;
		if (options?.regenerateMessageId) {
			const target = this.allMessages.find((m) => m.id === options.regenerateMessageId);
			if (!target) throw new Error('chat.message_not_found');
			if (target.role === 'assistant') {
				if (!target.parentId) throw new Error('chat.message_not_found');
				const parent = this.allMessages.find((m) => m.id === target.parentId);
				if (!parent || parent.role !== 'user') throw new Error('chat.message_not_found');
				userMessage = parent;
			} else {
				userMessage = target;
			}
		} else {
			userMessage = {
				...this.createUserMessage(content),
				parentId: options?.parentId !== undefined ? options.parentId : lastMessage?.id || null,
				attachments: currentAttachments.map((a) => ({
					url: a.url,
					name: a.name,
					contentType: a.contentType,
					content: a.content,
					size: a.size,
					hash: a.hash,
					lastModified: a.lastModified
				}))
			};
		}

		const assistantMessageId = randomId();

		const parentId = userMessage.parentId;
		const previousMessages = [...this.allMessages];
		const previousSelectedMessageIds = { ...this.selectedMessageIds };
		const hadExistingChat = !!this.chat;
		const shouldClearNewChatDraft = !hadExistingChat && !options?.regenerateMessageId;

		if (options?.regenerateMessageId) {
			this.selectedMessageIds = {
				...this.selectedMessageIds,
				[userMessage.id]: assistantMessageId
			};
		}

		const commitUserImmediately = !!options?.commitUserImmediately && !options?.regenerateMessageId;
		let userCommittedEarly = false;

		if (commitUserImmediately) {
			this.allMessages = [...this.allMessages, userMessage];
			this.selectedMessageIds = {
				...this.selectedMessageIds,
				[userMessage.parentId || 'root']: userMessage.id
			};
			userCommittedEarly = true;

			if (!preserveInput && options?.content === undefined) {
				this.input = '';
				this.attachments = [];
			}
		}

		let runId: string | null = null;
		let initialStreamCursor = 0;
		let committed = false;
		const commitSubmission = () => {
			if (committed) return;
			const assistantMessage = {
				...this.createAssistantMessage(assistantMessageId),
				parentId: userMessage.id
			};

			if (!options?.regenerateMessageId) {
				if (userCommittedEarly) {
					this.allMessages = [...this.allMessages, assistantMessage];
					this.selectedMessageIds = {
						...this.selectedMessageIds,
						[userMessage.id]: assistantMessageId
					};
				} else {
					this.allMessages = [...this.allMessages, userMessage, assistantMessage];
					this.selectedMessageIds = {
						...this.selectedMessageIds,
						[userMessage.parentId || 'root']: userMessage.id,
						[userMessage.id]: assistantMessageId
					};
				}
			} else {
				this.allMessages = [...this.allMessages, assistantMessage];
				this.selectedMessageIds = {
					...this.selectedMessageIds,
					[userMessage.id]: assistantMessageId
				};
			}
			committed = true;

			if (!preserveInput && options?.content === undefined) {
				this.input = '';
				this.attachments = [];
			}
			if (typeof window !== 'undefined' && shouldClearNewChatDraft) {
				localStorage.removeItem(getChatDraftStorageKey());
			}

			if (this.user) {
				this.chatHistory.setGenerating(this.chatId, true);
				const existingChat = this.chatHistory.getChatDetails(this.chatId);
				if (!existingChat) {
					const now = new SvelteDate();
					this.chat = {
						id: this.chatId,
						pinned: false,
						unread: false,
						createdAt: now,
						updatedAt: now,
						title: get(t)('common.new_chat'),
						userId: this.user.id,
						visibility: 'private'
					};
					this.chatHistory.upsertChat(this.chat);
					this.chatHistory.triggerScrollToTop();
				} else {
					this.chat = {
						...existingChat,
						updatedAt: new SvelteDate()
					};
					this.chatHistory.upsertChat(this.chat);
					this.chatHistory.triggerScrollToTop();
				}
				this.chatHistory.setActiveChatId(this.chatId);
				this.saveSelectedMessageIds();
				replaceState(resolve(`/chat/${this.chatId}`), {});
			}

			this.status = 'streaming';
		};

		try {
			const currentVisibleMessages = getMessagePath(this.allMessages, this.selectedMessageIds);
			const parentIdx =
				parentId === null ? -1 : currentVisibleMessages.findIndex((m) => m.id === parentId);
			const baseMessages =
				parentId === null
					? []
					: parentIdx !== -1
						? currentVisibleMessages.slice(0, parentIdx + 1)
						: currentVisibleMessages;
			const nextMessages = [...baseMessages, userMessage];

			const payloadMessages = nextMessages.map((m) => ({
				id: m.id,
				role: m.role,
				content: extractTextFromMessage(m),
				parts: Array.isArray(m.parts) ? m.parts : [],
				attachments: m.attachments
			}));
			this.status = 'submitted';
			this.abortController = new AbortController();
			const outerAbortSignal = this.abortController.signal;

			const startRes = await fetchWithTimeout('/api/runs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: this.chatId,
					messages: payloadMessages,
					parentId: userMessage.parentId,
					assistantMessageId,
					personalization: personalization.value
				}),
				signal: outerAbortSignal,
				timeout: 15000
			});

			if (!startRes.ok) {
				let errorMessage = 'common.request_failed';
				try {
					const errorData = await startRes.json();
					errorMessage = errorData.message || errorMessage;
				} catch {
					try {
						const text = await startRes.text();
						if (text) errorMessage = text;
					} catch {
						// Ignore
					}
				}
				throw new Error(errorMessage);
			}
			const startJson = (await startRes.json().catch(() => null)) as { runId?: unknown } | null;
			runId = startJson && typeof startJson.runId === 'string' ? startJson.runId : null;
			if (!runId) {
				throw new Error('run.invalid_response');
			}

			this.activeRunId = runId;

			const cursor =
				typeof window !== 'undefined'
					? Number(localStorage.getItem(`run_cursor_${runId}`) ?? '0')
					: 0;
			const safeCursor = Number.isFinite(cursor) && cursor >= 0 ? cursor : 0;
			let streamCursor = safeCursor;
			initialStreamCursor = streamCursor;
			let streamErrorKey: string | null = null;

			let lastError: unknown = null;
			for (let attempt = 0; attempt < 3; attempt++) {
				const streamController = new AbortController();
				const connectTimeoutId = setTimeout(() => streamController.abort(), 10000);
				const signal = AbortSignal.any([outerAbortSignal, streamController.signal]);

				try {
					const streamRes = await fetch(`/api/runs/${runId}/stream?cursor=${streamCursor}`, {
						signal
					});
					if (!streamRes.ok || !streamRes.body) {
						let errorKey = 'run.stream_failed';
						try {
							const rawText = await streamRes.text();
							if (rawText) {
								try {
									const parsed = JSON.parse(rawText) as { message?: unknown };
									if (parsed && typeof parsed.message === 'string') {
										errorKey = parsed.message;
									} else {
										errorKey = rawText;
									}
								} catch {
									errorKey = rawText;
								}
							}
						} catch {
							// ignore
						}
						throw new Error(errorKey);
					}

					clearTimeout(connectTimeoutId);
					streamErrorKey = null;
					await this.processStream(
						streamRes.body,
						assistantMessageId,
						commitSubmission,
						(errorKey) => {
							streamErrorKey = errorKey;
						}
					);
					if (streamErrorKey) {
						throw new Error(streamErrorKey);
					}
					lastError = null;
					break;
				} catch (e: unknown) {
					clearTimeout(connectTimeoutId);
					lastError = e;

					const externalAborted =
						e instanceof DOMException && e.name === 'AbortError' && outerAbortSignal.aborted;
					if (externalAborted) {
						throw e;
					}

					const errorMessage = e instanceof Error ? e.message : '';
					const shouldRetry = errorMessage === 'run.stream_failed';
					if (attempt < 2 && shouldRetry) {
						const nextDelay = Math.pow(2, attempt) * 500;
						await new Promise((resolve) => setTimeout(resolve, nextDelay));
						const localCursorRaw =
							typeof window !== 'undefined'
								? Number(localStorage.getItem(`run_cursor_${runId}`) ?? String(streamCursor))
								: streamCursor;
						if (
							Number.isFinite(localCursorRaw) &&
							localCursorRaw >= 0 &&
							localCursorRaw > streamCursor
						) {
							streamCursor = localCursorRaw;
						}
						continue;
					}
				}
			}

			if (lastError) throw lastError;
		} catch (error: unknown) {
			const externalAborted =
				error instanceof DOMException &&
				error.name === 'AbortError' &&
				(!this.abortController || this.abortController.signal.aborted);
			if (externalAborted) {
				await this.finalizeStreaming();
			} else {
				if (!runId || !committed) {
					this.allMessages = previousMessages;
					this.selectedMessageIds = previousSelectedMessageIds;

					if (userCommittedEarly && !preserveInput && options?.content === undefined) {
						this.input = content;
						this.attachments = currentAttachments;
					}
				}
				if (!runId) {
					// handle error
				}

				let errorKey = 'common.unknown_error';
				if (error instanceof Error && typeof error.message === 'string' && error.message) {
					errorKey = error.message;
				}
				if (
					error instanceof DOMException &&
					error.name === 'AbortError' &&
					!this.abortController?.signal.aborted
				) {
					errorKey = 'run.stream_failed';
				}
				if (
					errorKey === 'Failed to fetch' ||
					errorKey.includes('NetworkError') ||
					errorKey.includes('Load failed') ||
					errorKey.includes('fetch')
				) {
					errorKey = runId ? 'run.stream_failed' : 'common.request_failed';
				}

				const willAttemptResume = !!runId && committed && errorKey === 'run.stream_failed';
				if (!willAttemptResume || !committed) {
					toast.error(get(t)(errorKey));
				}

				if (!committed && !hadExistingChat) {
					this.chatHistory.setGenerating(this.chatId, false);
					await this.chatHistory.deleteChat(this.chatId);
					this.chat = undefined;
				}

				if (runId && willAttemptResume) {
					const localCursorRaw =
						typeof window !== 'undefined'
							? Number(localStorage.getItem(`run_cursor_${runId}`) ?? String(initialStreamCursor))
							: initialStreamCursor;
					const resumeCursor =
						Number.isFinite(localCursorRaw) && localCursorRaw >= 0
							? localCursorRaw
							: initialStreamCursor;
					setTimeout(() => {
						void this.resumeActiveRun({ id: runId!, assistantMessageId, cursor: resumeCursor });
					}, 750);
				}
			}
			this.status = 'ready';
		} finally {
			this.abortController = null;
			this.activeRunId = null;
		}
	}

	/**
	 * Processes the incoming stream from the AI API.
	 * @param body Readable stream of bytes.
	 * @param assistantMessageId ID of the assistant message to update.
	 */
	private async processStream(
		body: ReadableStream<Uint8Array>,
		_assistantMessageId: string,
		onFirstRecord?: () => void,
		onError?: (errorKey: string) => void
	) {
		const reader = body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		let currentAssistantIndex = this.allMessages.findIndex((m) => m.id === _assistantMessageId);
		const runId = this.activeRunId;
		let rafPending = false;
		let lastFlushTime = 0;
		const FLUSH_INTERVAL = 100;
		let currentEventId: number | null = null;
		let sawFinish = false;
		let lastCursorPersistAt = 0;
		let lastPersistedCursor = 0;
		let firstRecordSeen = false;
		let shouldStopReading = false;

		const existingMessage =
			currentAssistantIndex !== -1 ? this.allMessages[currentAssistantIndex] : undefined;
		const existingPartsRaw = existingMessage?.parts ?? [];
		const existingParts = Array.isArray(existingPartsRaw)
			? (existingPartsRaw as MessagePart[])
			: [];
		const currentParts: MessagePart[] = [...existingParts];

		const lastTextPart = [...currentParts].reverse().find((p) => p.type === 'text') as
			| { type: 'text'; text?: string }
			| undefined;
		const lastReasoningPart = [...currentParts].reverse().find((p) => p.type === 'reasoning') as
			| { type: 'reasoning'; text?: string }
			| undefined;

		let currentText = typeof lastTextPart?.text === 'string' ? lastTextPart.text : '';
		let currentReasoning =
			typeof lastReasoningPart?.text === 'string' ? lastReasoningPart.text : '';

		const refreshAssistantIndex = () => {
			if (currentAssistantIndex === -1) {
				currentAssistantIndex = this.allMessages.findIndex((m) => m.id === _assistantMessageId);
			}
		};

		const flushAssistantUpdate = () => {
			refreshAssistantIndex();
			const currentMessage =
				currentAssistantIndex !== -1 ? this.allMessages[currentAssistantIndex] : undefined;
			if (currentMessage) {
				this.allMessages[currentAssistantIndex] = {
					...currentMessage,
					parts: [...currentParts] as UIMessageWithTree['parts']
				};
			}
		};

		const scheduleFlush = (force = false) => {
			const now = Date.now();
			if (force || now - lastFlushTime >= FLUSH_INTERVAL) {
				if (rafPending) return;
				rafPending = true;
				requestAnimationFrame(() => {
					flushAssistantUpdate();
					lastFlushTime = Date.now();
					rafPending = false;
				});
			} else {
				if (rafPending) return;
				rafPending = true;
				setTimeout(
					() => {
						requestAnimationFrame(() => {
							flushAssistantUpdate();
							lastFlushTime = Date.now();
							rafPending = false;
						});
					},
					FLUSH_INTERVAL - (now - lastFlushTime)
				);
			}
		};

		try {
			while (true) {
				if (this.abortController?.signal.aborted) {
					await reader.cancel().catch(() => {});
					break;
				}
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const parts = buffer.split('\n\n');
				buffer = parts.pop() ?? '';

				for (const part of parts) {
					const lines = part.split('\n').map((l) => l.trim());
					for (const line of lines) {
						if (line === '') continue;
						if (line.startsWith('id:')) {
							const raw = line.slice(3).trim();
							const parsed = Number(raw);
							currentEventId = Number.isFinite(parsed) ? parsed : null;
							continue;
						}
						let dataStr = line;
						if (line.startsWith('data:')) {
							dataStr = line.slice(5).trim();
						}
						if (dataStr === '') continue;

						let rec: ChatStreamRecord;
						try {
							rec = JSON.parse(dataStr) as ChatStreamRecord;
						} catch {
							continue;
						}
						const type = rec.type;
						const shouldTriggerCommit =
							type === 'text-start' ||
							type === 'text-delta' ||
							type === 'text-end' ||
							type === 'reasoning-start' ||
							type === 'reasoning-delta' ||
							type === 'tool-input-start' ||
							type === 'tool-input-delta' ||
							type === 'tool-input-available' ||
							type === 'tool-output-available';
						if (!firstRecordSeen && shouldTriggerCommit) {
							firstRecordSeen = true;
							if (onFirstRecord) {
								onFirstRecord();
								refreshAssistantIndex();
							}
						}

						if (
							typeof window !== 'undefined' &&
							this.activeRunId &&
							currentEventId !== null &&
							currentEventId > 0
						) {
							const now = Date.now();
							if (
								currentEventId > lastPersistedCursor &&
								(now - lastCursorPersistAt >= 250 || currentEventId - lastPersistedCursor >= 25)
							) {
								localStorage.setItem(`run_cursor_${this.activeRunId}`, String(currentEventId));
								lastPersistedCursor = currentEventId;
								lastCursorPersistAt = now;
							}
						}

						if (rec.providerMetadata?.openrouter?.reasoning_details) {
							const details = rec.providerMetadata.openrouter.reasoning_details;
							if (Array.isArray(details)) {
								const reasoningText = details.map((d: { text?: string }) => d.text || '').join('');
								if (reasoningText && reasoningText.length > currentReasoning.length) {
									let lastPart = currentParts[currentParts.length - 1];
									if (lastPart?.type !== 'reasoning') {
										lastPart = { type: 'reasoning', text: '' };
										currentParts.push(lastPart);
									}
									const delta = reasoningText.slice(currentReasoning.length);
									currentReasoning = reasoningText;
									lastPart.text += delta;
									scheduleFlush();
								}
							}
						}

						if (type === 'reasoning-start') {
							const lastPart = currentParts[currentParts.length - 1];
							if (lastPart?.type !== 'reasoning') {
								currentParts.push({ type: 'reasoning', text: '' });
							}
						} else if (type === 'reasoning-delta') {
							const delta = rec.delta || rec.reasoningDelta || rec.reasoning || '';
							if (delta) {
								currentReasoning += delta;
								let lastPart = currentParts[currentParts.length - 1];
								if (lastPart?.type !== 'reasoning') {
									lastPart = { type: 'reasoning', text: '' };
									currentParts.push(lastPart);
								}
								lastPart.text += delta;
								scheduleFlush();
							}
						} else if (type === 'text-start') {
							currentText = '';
							currentParts.push({ type: 'text', text: '' });
							flushAssistantUpdate();
						} else if (type === 'text-delta') {
							const delta = rec.delta || '';
							if (delta) {
								currentText += delta;
								let lastPart = currentParts[currentParts.length - 1];
								if (lastPart?.type !== 'text') {
									lastPart = { type: 'text', text: '' };
									currentParts.push(lastPart);
								}
								lastPart.text += delta;
								scheduleFlush();
							}
						} else if (type === 'text-end') {
							const finalText = rec.text || rec.delta || '';
							if (finalText) {
								currentText = finalText;
								const lastPart = currentParts[currentParts.length - 1];
								if (lastPart?.type === 'text') {
									lastPart.text = currentText;
								}
								flushAssistantUpdate();
							}
						} else if (type === 'tool-input-start') {
							if (rec.toolCallId) {
								currentParts.push({
									type: 'tool-invocation',
									toolInvocation: {
										toolCallId: rec.toolCallId ?? '',
										toolName: rec.toolName ?? '',
										args: {},
										state: 'call'
									}
								});
								scheduleFlush();
							}
						} else if (type === 'tool-input-delta') {
							const invocationPart = currentParts.find(
								(p) =>
									p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === rec.toolCallId
							);
							if (invocationPart && invocationPart.toolInvocation) {
								const delta = typeof rec.inputTextDelta === 'string' ? rec.inputTextDelta : '';
								if (!delta) continue;
								if (typeof invocationPart.toolInvocation.args !== 'string') {
									invocationPart.toolInvocation.args = delta;
								} else {
									invocationPart.toolInvocation.args += delta;
								}
								scheduleFlush();
							}
						} else if (type === 'tool-input-available') {
							const invocationPart = currentParts.find(
								(p) =>
									p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === rec.toolCallId
							);
							if (invocationPart && invocationPart.toolInvocation) {
								invocationPart.toolInvocation.args = rec.input;
								scheduleFlush();
							}
						} else if (type === 'tool-output-available') {
							const invocationPart = currentParts.find(
								(p) =>
									p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === rec.toolCallId
							);
							if (invocationPart && invocationPart.toolInvocation) {
								invocationPart.toolInvocation.state = 'result';
								invocationPart.toolInvocation.result = rec.output;
								scheduleFlush();
							}
						} else if (type === 'error') {
							const errorKey =
								typeof rec.errorText === 'string' && rec.errorText.length > 0
									? rec.errorText
									: 'run.failed';
							onError?.(errorKey);
							sawFinish = true;
							shouldStopReading = true;
							if (runId) {
								localStorage.removeItem(`run_cursor_${runId}`);
							}
						} else if (type === 'finish') {
							sawFinish = true;
							shouldStopReading = true;
							if (runId) {
								localStorage.removeItem(`run_cursor_${runId}`);
							}
						}
						if (shouldStopReading) break;
					}
					if (shouldStopReading) break;
				}
				if (shouldStopReading) {
					await reader.cancel().catch(() => {});
					break;
				}
			}
		} finally {
			reader.releaseLock();
			if (sawFinish) {
				await this.finalizeStreaming();
			}
		}
	}

	/**
	 * Resumes an active run that was interrupted.
	 */
	async resumeActiveRun(options: { id: string; assistantMessageId: string; cursor: number }) {
		if (this.status === 'streaming' || this.status === 'submitted') return;
		this.activeRunId = options.id;
		this.status = 'streaming';
		this.abortController = new AbortController();
		const outerAbortSignal = this.abortController.signal;

		let streamCursor = options.cursor;
		const assistantMessageId = options.assistantMessageId;

		try {
			let lastError: unknown = null;
			for (let attempt = 0; attempt < 3; attempt++) {
				const streamController = new AbortController();
				const connectTimeoutId = setTimeout(() => streamController.abort(), 10000);
				const signal = AbortSignal.any([outerAbortSignal, streamController.signal]);

				try {
					const streamRes = await fetch(`/api/runs/${options.id}/stream?cursor=${streamCursor}`, {
						signal
					});
					if (!streamRes.ok || !streamRes.body) {
						let errorKey = 'run.stream_failed';
						try {
							const rawText = await streamRes.text();
							if (rawText) {
								try {
									const parsed = JSON.parse(rawText) as { message?: unknown };
									if (parsed && typeof parsed.message === 'string') {
										errorKey = parsed.message;
									} else {
										errorKey = rawText;
									}
								} catch {
									errorKey = rawText;
								}
							}
						} catch {
							// ignore
						}
						throw new Error(errorKey);
					}

					clearTimeout(connectTimeoutId);
					await this.processStream(streamRes.body, assistantMessageId);
					lastError = null;
					break;
				} catch (e: unknown) {
					clearTimeout(connectTimeoutId);
					lastError = e;

					const externalAborted =
						e instanceof DOMException && e.name === 'AbortError' && outerAbortSignal.aborted;
					if (externalAborted) {
						throw e;
					}

					if (attempt < 2) {
						const nextDelay = Math.pow(2, attempt) * 500;
						await new Promise((resolve) => setTimeout(resolve, nextDelay));
						const localCursorRaw =
							typeof window !== 'undefined'
								? Number(localStorage.getItem(`run_cursor_${options.id}`) ?? String(streamCursor))
								: streamCursor;
						if (
							Number.isFinite(localCursorRaw) &&
							localCursorRaw >= 0 &&
							localCursorRaw > streamCursor
						) {
							streamCursor = localCursorRaw;
						}
						continue;
					}
				}
			}

			if (lastError) throw lastError;
		} catch (error) {
			const externalAborted =
				error instanceof DOMException &&
				error.name === 'AbortError' &&
				(!this.abortController || this.abortController.signal.aborted);

			if (externalAborted) {
				await this.finalizeStreaming();
			} else {
				const localCursorRaw =
					typeof window !== 'undefined'
						? Number(localStorage.getItem(`run_cursor_${options.id}`) ?? String(streamCursor))
						: streamCursor;
				const resumeCursor =
					Number.isFinite(localCursorRaw) && localCursorRaw >= 0 ? localCursorRaw : streamCursor;
				setTimeout(() => {
					void this.resumeActiveRun({ id: options.id, assistantMessageId, cursor: resumeCursor });
				}, 1500);
			}
			this.status = 'ready';
		} finally {
			this.abortController = null;
			this.activeRunId = null;
		}
	}

	/**
	 * Selects a message by ID and updates the conversation path.
	 */
	async selectMessageById(messageId: string): Promise<void> {
		const message = this.allMessages.find((m) => m.id === messageId);
		if (!message) return;

		const path: string[] = [messageId];
		let currentParentId = message.parentId;
		while (currentParentId) {
			const parent = this.allMessages.find((m) => m.id === currentParentId);
			if (!parent) break;
			path.unshift(currentParentId);
			currentParentId = parent.parentId;
		}

		// Update selectedMessageIds for the path
		const newSelectedIds = { ...this.selectedMessageIds };
		let changed = false;
		let prevId = 'root';
		for (const id of path) {
			if (newSelectedIds[prevId] !== id) {
				newSelectedIds[prevId] = id;
				changed = true;
			}
			prevId = id;
		}
		if (!changed) return;
		this.selectedMessageIds = newSelectedIds;
		this.saveSelectedMessageIds();
	}

	/**
	 * Regenerates a message.
	 */
	async handleRegenerate(params: { messageId: string }): Promise<void> {
		await this.handleSubmit(undefined, {
			regenerateMessageId: params.messageId
		});
	}

	/**
	 * Edits a message and regenerates the conversation from that point.
	 */
	async handleEdit(params: { messageId: string; newContent: string }): Promise<void> {
		const messageIndex = this.allMessages.findIndex((m) => m.id === params.messageId);
		if (messageIndex === -1) return;

		const originalMessage = this.allMessages[messageIndex]!;
		const editedMessage: UIMessageWithTree = {
			...originalMessage,
			id: randomId(),
			role: originalMessage.role || 'user',
			parts: [{ type: 'text', text: params.newContent }]
		};

		this.allMessages = [...this.allMessages, editedMessage];
		await this.selectMessageById(editedMessage.id);
		await this.handleSubmit(undefined, {
			regenerateMessageId: editedMessage.id
		});
	}

	/**
	 * Switches to a different message branch.
	 */
	async handleSwitchBranch(parentId: string, messageId: string): Promise<void> {
		this.selectedMessageIds = {
			...this.selectedMessageIds,
			[parentId || 'root']: messageId
		};
		this.saveSelectedMessageIds();
	}

	/**
	 * Returns a client-compatible chat interface object.
	 */
	get chatClient(): ChatClient {
		return {
			id: this.chatId,
			messages: this.visibleMessages,
			status: this.status,
			input: this.input,
			append: async (payload) => {
				const experimental_attachments = (payload as { experimental_attachments?: Attachment[] })
					.experimental_attachments;
				await this.handleSubmit(undefined, {
					content: payload.content,
					experimental_attachments
				});
			},
			reload: async () => {
				const lastUserMessage = [...this.visibleMessages].reverse().find((m) => m.role === 'user');
				if (lastUserMessage) {
					await this.handleSubmit(undefined, {
						regenerateMessageId: lastUserMessage.id
					});
				}
			},
			handleSubmit: (event, options) => this.handleSubmit(event, options),
			stop: () => {
				void this.stop();
			}
		};
	}
}
