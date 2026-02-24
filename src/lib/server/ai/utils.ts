import { generateText, type ModelMessage, type TextPart, type ImagePart, type UIMessage } from 'ai';
import { myProvider } from '$lib/server/ai/models';
import { AIInternalError, type AIError } from '$lib/server/errors/ai';
import { fromPromise, ok, safeTry, type ResultAsync } from 'neverthrow';
import { env as privateEnv } from '$env/dynamic/private';
import { MODEL_REGISTRY, modelSupportsVision } from '$lib/ai/model-registry';
import type { Attachment } from '$lib/types/attachment';
import type { MessagePart } from '$lib/types/message';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { parseUploadUrl } from '$lib/server/files/upload-store';

export function generateTitleFromUserMessage({
	message
}: {
	message: { id: string; role: 'user'; content: string };
}): ResultAsync<string, AIError> {
	return safeTry(async function* () {
		const result = yield* fromPromise(
			generateText({
				model: myProvider.languageModel('title-model'),
				system: `You are a title generator. Create a concise, precise title that summarizes the intent of the user's first message.
          - Output only the title text, no explanations or extra content.
          - Summarize the core topic or intent; do not copy the original wording.
          - For greetings, thanks, acknowledgements, small talk, test messages, emoji-only, or very short inputs, use a generic category label instead of echoing the text.
            Examples: 你好 -> 用户问候; 谢谢 -> 用户致谢; OK -> User Acknowledgement; test -> Test Message.
          - Max 10 words; shorter is better if accurate.
          - Do not use punctuation like quotes, colons, or periods.
          - Match the user's language.`,
				prompt: message.content
			}),
			(e) => new AIInternalError({ cause: e })
		);

		const title = result.text.replace(/^(Title|Summary|标题|摘要):\s*/i, '').trim();
		return ok(title);
	});
}

export function validateModelApiKey(selectedChatModel: string): {
	isValid: boolean;
	error?: string;
} {
	const registryItem = MODEL_REGISTRY.find((m) => m.id === selectedChatModel);
	if (!registryItem) {
		return {
			isValid: false,
			error: 'models.invalid_model'
		};
	}

	const { provider } = registryItem;
	const requiredEnvByProvider: Record<string, string> = {
		openrouter: 'OPENROUTER_API_KEY',
		groq: 'GROQ_API_KEY',
		xai: 'XAI_API_KEY',
		google: 'GOOGLE_GENERATIVE_AI_API_KEY',
		anthropic: 'ANTHROPIC_API_KEY',
		deepseek: 'DEEPSEEK_API_KEY',
		openai: 'OPENAI_API_KEY',
		siliconflow: 'SILICONFLOW_API_KEY'
	};

	const envName = requiredEnvByProvider[provider as keyof typeof requiredEnvByProvider];
	if (envName && !privateEnv[envName]) {
		return {
			isValid: false,
			error: 'models.missing_api_key'
		};
	}

	return { isValid: true };
}

type MessageWithAttachments = {
	role?: unknown;
	attachments?: unknown;
};

function isImageAttachment(attachment: unknown): boolean {
	if (!attachment || typeof attachment !== 'object') return false;
	const contentType = (attachment as { contentType?: unknown }).contentType;
	return typeof contentType === 'string' && contentType.toLowerCase().startsWith('image/');
}

export function hasImageAttachments(messages: MessageWithAttachments[]): boolean {
	return messages.some((message) => {
		if (message.role !== 'user') return false;
		return (
			Array.isArray(message.attachments) && message.attachments.some((a) => isImageAttachment(a))
		);
	});
}

export function validateModelVisionCompatibility(
	selectedChatModel: string,
	messages: MessageWithAttachments[]
): {
	isValid: boolean;
	error?: string;
} {
	if (hasImageAttachments(messages) && !modelSupportsVision(selectedChatModel)) {
		return {
			isValid: false,
			error: 'models.vision_not_supported'
		};
	}

	return { isValid: true };
}

function extractErrorMessages(value: unknown, out: string[], depth = 0): void {
	if (depth > 3 || value === null || value === undefined) return;

	if (typeof value === 'string') {
		if (value.length > 0) out.push(value);
		return;
	}

	if (value instanceof Error) {
		if (value.message) out.push(value.message);
		extractErrorMessages((value as { cause?: unknown }).cause, out, depth + 1);
		return;
	}

	if (typeof value === 'object') {
		const rec = value as Record<string, unknown>;
		if (typeof rec.message === 'string' && rec.message.length > 0) {
			out.push(rec.message);
		}
		if (typeof rec.error === 'string' && rec.error.length > 0) {
			out.push(rec.error);
		}
		extractErrorMessages(rec.cause, out, depth + 1);
	}
}

export function mapModelProviderErrorToErrorKey(e: unknown): string | null {
	const messages: string[] = [];
	extractErrorMessages(e, messages);
	const joined = messages.join('\n').toLowerCase();
	if (!joined) return null;

	if (
		joined.includes('no endpoints found that support image input') ||
		joined.includes('does not support image input') ||
		joined.includes('image input is not supported')
	) {
		return 'models.vision_not_supported';
	}

	return null;
}

type TextIncomingPart = { type: 'text'; text?: string };
type ReasoningIncomingPart = { type: 'reasoning'; text?: string };
type ToolInvocationIncomingPart = {
	type: 'tool-invocation';
	toolInvocation?: {
		toolCallId: string;
		toolName: string;
		args: unknown;
		state: 'call' | 'result';
		result?: unknown;
	};
};
type DynamicToolIncomingPart = {
	type: 'dynamic-tool';
	toolCallId: string;
	toolName: string;
	input: unknown;
	state: string;
	output?: unknown;
};
type GenericIncomingPart = { type: string; [key: string]: unknown };

type IncomingMessage = {
	id: string;
	role: 'system' | 'user' | 'assistant' | 'data' | 'tool';
	content?: string | unknown[];
	parts?: Array<
		| TextIncomingPart
		| ReasoningIncomingPart
		| ToolInvocationIncomingPart
		| DynamicToolIncomingPart
		| GenericIncomingPart
	>;
	attachments?: Attachment[];
};

async function toInlineImageUrlIfLocal(attachment: Attachment): Promise<Attachment> {
	if (!attachment.url || !attachment.contentType?.startsWith('image/')) {
		return attachment;
	}

	const fileName = parseUploadUrl(attachment.url);
	if (!fileName) {
		return attachment;
	}

	try {
		const fileBuffer = await readFile(join('static', 'uploads', fileName));
		return {
			...attachment,
			url: `data:${attachment.contentType};base64,${fileBuffer.toString('base64')}`
		};
	} catch {
		return attachment;
	}
}

export async function convertToCoreMessagesWithResolvedImages(
	messages: Array<IncomingMessage>
): Promise<ModelMessage[]> {
	const resolvedMessages = await Promise.all(
		messages.map(async (message) => {
			if (message.role !== 'user' || !Array.isArray(message.attachments)) {
				return message;
			}

			const resolvedAttachments = await Promise.all(
				message.attachments.map((attachment) => toInlineImageUrlIfLocal(attachment))
			);

			return {
				...message,
				attachments: resolvedAttachments
			};
		})
	);

	return convertToCoreMessages(resolvedMessages);
}

export function convertToCoreMessages(messages: Array<IncomingMessage>): ModelMessage[] {
	return messages
		.filter((m) => m.role === 'system' || m.role === 'user' || m.role === 'assistant')
		.flatMap((message): ModelMessage[] => {
			if (message.role === 'system') {
				let text = '';

				if (typeof message.content === 'string') {
					text = message.content;
				} else if (Array.isArray(message.content)) {
					text = message.content
						.filter((part): part is string => typeof part === 'string')
						.join('\n');
				}

				return [
					{
						role: 'system',
						content: text
					}
				];
			}

			const parts = Array.isArray(message.parts) ? message.parts : [];
			const textParts: TextPart[] = [];
			const imageParts: ImagePart[] = [];

			for (const part of parts) {
				const rawTextValue = (part as Record<string, unknown>)['text'];
				const rawText = typeof rawTextValue === 'string' ? rawTextValue : '';

				if (part.type === 'text') {
					textParts.push({ type: 'text', text: rawText });
				} else if (part.type === 'reasoning') {
					textParts.push({
						type: 'text',
						text: `<thought>\n${rawText}\n</thought>`
					});
				}
			}

			if (
				textParts.length === 0 &&
				typeof message.content === 'string' &&
				message.content.length > 0
			) {
				textParts.push({ type: 'text', text: message.content });
			}

			if (message.role === 'user' && Array.isArray(message.attachments)) {
				for (const attachment of message.attachments) {
					if (attachment.url && attachment.contentType?.startsWith('image/')) {
						imageParts.push({
							type: 'image',
							image: attachment.url,
							mediaType: attachment.contentType
						});
					} else if (attachment.content) {
						const sizeKB = attachment.size ? (attachment.size / 1024).toFixed(2) : 'unknown';
						const type = attachment.contentType || 'text/plain';
						const lastMod = attachment.lastModified
							? new Date(attachment.lastModified).toISOString()
							: 'unknown';
						textParts.push({
							type: 'text',
							text: `[File Attachment: ${attachment.name}]\n[Metadata: Type=${type}, Size=${sizeKB}KB, Hash=${attachment.hash || 'N/A'}, LastModified=${lastMod}]\n[Content Start]\n${attachment.content}\n[Content End]`
						});
					}
				}
			}

			if (message.role === 'user') {
				const userContentParts: Array<TextPart | ImagePart> = [...textParts, ...imageParts];

				return [
					{
						role: 'user',
						content: userContentParts.length > 0 ? userContentParts : ''
					}
				];
			}

			return [
				{
					role: 'assistant',
					content: textParts.length > 0 ? textParts : ''
				}
			];
		});
}

type RunEventInput = { chunk: string };

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object') return null;
	return value as Record<string, unknown>;
}

function readString(rec: Record<string, unknown>, key: string): string | undefined {
	const v = rec[key];
	return typeof v === 'string' ? v : undefined;
}

export function aggregateRunEventsToParts(events: RunEventInput[]): UIMessage['parts'] {
	const parts: MessagePart[] = [];

	for (const event of events) {
		let rec: Record<string, unknown> | null;
		try {
			rec = asRecord(JSON.parse(event.chunk));
		} catch {
			continue;
		}
		if (!rec) continue;

		const type = readString(rec, 'type');
		if (!type) continue;

		if (type === 'reasoning-start') {
			const last = parts.at(-1);
			if (!last || last.type !== 'reasoning') {
				parts.push({ type: 'reasoning', text: '' });
			}
		} else if (type === 'reasoning-delta') {
			const delta =
				readString(rec, 'delta') ??
				readString(rec, 'reasoningDelta') ??
				readString(rec, 'reasoning') ??
				'';
			if (delta) {
				let lastPart = parts[parts.length - 1];
				if (!lastPart || lastPart.type !== 'reasoning') {
					lastPart = { type: 'reasoning', text: '' };
					parts.push(lastPart);
				}
				lastPart.text = `${lastPart.text ?? ''}${delta}`;
			}
		} else if (type === 'text-start') {
			const last = parts.at(-1);
			if (!last || last.type !== 'text') {
				parts.push({ type: 'text', text: '' });
			}
		} else if (type === 'text-delta') {
			const delta = readString(rec, 'delta') ?? '';
			if (delta) {
				let lastPart = parts[parts.length - 1];
				if (!lastPart || lastPart.type !== 'text') {
					lastPart = { type: 'text', text: '' };
					parts.push(lastPart);
				}
				lastPart.text = `${lastPart.text ?? ''}${delta}`;
			}
		} else if (type === 'text-end') {
			const finalText = readString(rec, 'text') ?? readString(rec, 'delta') ?? '';
			if (finalText) {
				const lastPart = parts[parts.length - 1];
				if (lastPart?.type === 'text') {
					lastPart.text = finalText;
				}
			}
		} else if (type === 'tool-input-start') {
			const toolCallId = readString(rec, 'toolCallId');
			const toolName = readString(rec, 'toolName') ?? '';
			if (toolCallId) {
				parts.push({
					type: 'tool-invocation',
					toolInvocation: {
						toolCallId,
						toolName,
						args: {},
						state: 'call'
					}
				});
			}
		} else if (type === 'tool-input-delta') {
			const toolCallId = readString(rec, 'toolCallId');
			const inputTextDelta = readString(rec, 'inputTextDelta');
			if (!toolCallId || !inputTextDelta) continue;
			const part = parts.find(
				(p) => p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === toolCallId
			);
			if (part?.toolInvocation) {
				if (typeof part.toolInvocation.args !== 'string') {
					part.toolInvocation.args = inputTextDelta;
				} else {
					part.toolInvocation.args += inputTextDelta;
				}
			}
		} else if (type === 'tool-input-available') {
			const toolCallId = readString(rec, 'toolCallId');
			if (!toolCallId) continue;
			const part = parts.find(
				(p) => p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === toolCallId
			);
			if (part?.toolInvocation) {
				part.toolInvocation.args = rec['input'];
			}
		} else if (type === 'tool-output-available') {
			const toolCallId = readString(rec, 'toolCallId');
			if (!toolCallId) continue;
			const part = parts.find(
				(p) => p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === toolCallId
			);
			if (part?.toolInvocation) {
				part.toolInvocation.state = 'result';
				part.toolInvocation.result = rec['output'];
			}
		}
	}

	return parts as unknown as UIMessage['parts'];
}
