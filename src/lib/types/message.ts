import type { UIMessage } from 'ai';
import type { Attachment } from '$lib/types/attachment';

export interface ToolInvocation {
	state: 'call' | 'result';
	toolCallId: string;
	toolName: string;
	args: unknown;
	result?: unknown;
}

export interface MessagePart {
	type: 'text' | 'reasoning' | 'tool-invocation' | 'dynamic-tool' | string;
	text?: string | null;
	state?: string;
	toolCallId?: string;
	toolName?: string;
	input?: unknown;
	output?: unknown;
	toolInvocation?: ToolInvocation;
}

export type UIMessageWithTree = UIMessage & {
	attachments?: Attachment[];
	parentId?: string | null;
	parts?: MessagePart[];
};
