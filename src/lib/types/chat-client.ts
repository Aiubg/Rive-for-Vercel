import type { Attachment } from '$lib/types/attachment';
import type { UIMessageWithTree } from '$lib/types/message';

export type Chat = {
	id: string;
	messages: UIMessageWithTree[];
	status: 'ready' | 'submitted' | 'streaming' | 'error';
	input: string;
	append(payload: { role: 'user' | 'assistant' | 'system'; content: string }): Promise<void>;
	handleSubmit(
		event?: Event,
		options?: {
			experimental_attachments?: Attachment[];
			content?: string;
			preserveInput?: boolean;
			parentId?: string | null;
			regenerateMessageId?: string;
		}
	): Promise<void>;
	stop(): void;
	reload(): Promise<void>;
};
