<script lang="ts">
	import MessageReasoning from '$lib/components/message-reasoning.svelte';
	import ToolCall from '$lib/components/messages/tool-call.svelte';
	import { Markdown } from '$lib/components/markdown';
	import { cn } from '$lib/utils/shadcn';
	import {
		convertCitationMarkersToMarkdownLinks,
		extractSearchCitationsFromMessage
	} from '$lib/utils/citations';
	import type { MessagePart, UIMessageWithTree } from '$lib/types/message';

	type ReasoningGroup = {
		type: 'reasoning-group';
		parts: MessagePart[];
	};

	type ToolGroup = {
		type: 'tool-group';
		parts: MessagePart[];
	};

	type TextGroup = {
		type: 'text';
		text: string;
		part: MessagePart;
	};

	type PartGroup = ReasoningGroup | ToolGroup | TextGroup;

	let {
		message,
		messageLoading = false
	}: {
		message: UIMessageWithTree;
		messageLoading?: boolean;
	} = $props();

	const hasTextPart = $derived(
		Array.isArray(message.parts) &&
			message.parts.some((part) => {
				const p = part as { type?: string };
				const rawText = (p as { text?: string }).text;
				const text = typeof rawText === 'string' ? rawText.trim() : '';
				return p?.type === 'text' && text.length > 0;
			})
	);

	const messageCitations = $derived.by(() => {
		if (message.role !== 'assistant') return [];
		return extractSearchCitationsFromMessage(message);
	});

	const groupedParts = $derived.by(() => {
		const groups: PartGroup[] = [];
		let currentReasoningGroup: MessagePart[] = [];
		let currentToolGroup: MessagePart[] = [];
		const parts = (Array.isArray(message.parts) ? message.parts : []) as MessagePart[];

		const flushReasoning = () => {
			if (currentReasoningGroup.length > 0) {
				groups.push({
					type: 'reasoning-group',
					parts: [...currentReasoningGroup]
				});
				currentReasoningGroup = [];
			}
		};
		const flushTools = () => {
			if (currentToolGroup.length > 0) {
				groups.push({
					type: 'tool-group',
					parts: [...currentToolGroup]
				});
				currentToolGroup = [];
			}
		};

		for (const p of parts) {
			if (typeof p.type === 'string' && p.type.startsWith('step-')) {
				continue;
			}
			if (p.type === 'text') {
				const text = typeof p.text === 'string' ? p.text : '';
				if (text.trim().length === 0) {
					// Skip empty text parts so they don't break reasoning groups after refresh.
					continue;
				}
			}
			const isTool = p.type === 'dynamic-tool' || p.type === 'tool-invocation';
			const isReasoning = p.type === 'reasoning';

			if (isReasoning) {
				flushTools();
				currentReasoningGroup.push(p);
			} else if (isTool) {
				flushReasoning();
				currentToolGroup.push(p);
			} else if (p.type === 'text') {
				flushReasoning();
				flushTools();
				groups.push({
					type: 'text',
					text: typeof p.text === 'string' ? p.text : '',
					part: p
				});
			} else {
				// For other types, we might want to keep them as is or treat as reasoning if appropriate
				// For now, let's treat unknown types as separate to avoid breaking things
				flushReasoning();
				flushTools();
				// We'll just push it as a special group or handle it in the each loop
				groups.push({
					type: 'text', // fallback to text-like rendering if unknown
					text: typeof p.text === 'string' ? p.text : '',
					part: p
				});
			}
		}

		flushReasoning();
		flushTools();
		return groups;
	});
</script>

{#each groupedParts as group, i (`${message.id}-${i}`)}
	{#if group.type === 'reasoning-group'}
		<MessageReasoning parts={group.parts} loading={messageLoading && !hasTextPart} />
	{:else if group.type === 'tool-group'}
		<div
			class={cn('flex flex-row items-start gap-2', {
				'justify-end': message.role === 'user'
			})}
		>
			<div
				class={cn('bidi-plaintext flex min-w-0 flex-col gap-4 text-start wrap-break-word', {
					'message-user': message.role === 'user',
					'w-full': message.role === 'assistant'
				})}
			>
				{#each group.parts ?? [] as p, partIndex (`${message.id}-${i}-${p.toolCallId ?? p.toolInvocation?.toolCallId ?? partIndex}`)}
					{#if p.type === 'dynamic-tool'}
						<ToolCall
							toolInvocation={{
								state: p.state === 'output-available' ? 'result' : 'call',
								toolCallId: p.toolCallId ?? '',
								toolName: p.toolName ?? '',
								args: p.input,
								result: p.output
							}}
						/>
					{:else if p.type === 'tool-invocation'}
						<ToolCall
							toolInvocation={p.toolInvocation ?? {
								state: 'call',
								toolCallId: '',
								toolName: '',
								args: undefined,
								result: undefined
							}}
						/>
					{/if}
				{/each}
			</div>
		</div>
	{:else if group.type === 'text'}
		{@const p = group.part}
		{#if (message.role === 'assistant' && messageLoading && (p.text ?? '') === '') || (message.role === 'user' && (p.text ?? '').trim() === '')}
			<div class="hidden"></div>
		{:else}
			<div
				class={cn('flex flex-row items-start gap-2', {
					'justify-end': message.role === 'user'
				})}
			>
				<div
					class={cn('bidi-plaintext flex min-w-0 flex-col gap-4 text-start wrap-break-word', {
						'message-user': message.role === 'user',
						'w-full': message.role === 'assistant'
					})}
				>
					{#if message.role === 'user'}
						<div class="break-anywhere whitespace-pre-wrap">{p.text}</div>
					{:else}
						<Markdown
							md={convertCitationMarkersToMarkdownLinks(p.text ?? '')}
							streaming={messageLoading}
							citations={messageCitations}
						/>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
{/each}
