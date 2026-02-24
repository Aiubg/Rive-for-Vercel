<script lang="ts">
	import { logger } from '$lib/utils/logger';
	import { cn } from '$lib/utils/shadcn';
	import { Button } from '$lib/components/ui/button';
	import MessageActions from '$lib/components/messages/message-actions.svelte';
	import MessageParts from '$lib/components/messages/message-parts.svelte';
	import PreviewAttachment from '$lib/components/preview-attachment.svelte';
	import TextareaAutosize from '$lib/components/multimodal/textarea-autosize.svelte';
	import { extractTextFromMessage, hasAttachments } from '$lib/utils/chat';
	import { copyToClipboard } from '$lib/utils/misc';
	import { fly } from 'svelte/transition';
	import { tick, untrack } from 'svelte';
	import type { UIMessageWithTree } from '$lib/types/message';
	import { t } from 'svelte-i18n';

	let {
		message,
		readonly,
		loading,
		messageLoading = false,
		enableIntro = true,
		totalVersions = 1,
		currentIndex = 0,
		onregenerate,
		onedit,
		onswitchversion
	}: {
		message: UIMessageWithTree;
		readonly: boolean;
		loading: boolean;
		messageLoading?: boolean;
		enableIntro?: boolean;
		totalVersions?: number;
		currentIndex?: number;
		onregenerate?: (payload: { message: UIMessageWithTree }) => void;
		onedit?: (payload: { message: UIMessageWithTree; text: string }) => void;
		onswitchversion?: (index: number) => void;
	} = $props();

	let mode = $state<'view' | 'edit'>('view');
	let editText = $state('');
	let originalText = $state('');
	let copiedIndex = $state<number | null>(null);
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	$effect(() => {
		untrack(() => {
			mode = 'view';
		});
	});

	$effect(() => {
		if (mode === 'edit') {
			const text = extractTextFromMessage(message);
			editText = text;
			originalText = text;
		}
	});

	const trimmedEditText = $derived(editText.trim());
	const trimmedOriginalText = $derived(originalText.trim());
	const canSubmitEdit = $derived(
		trimmedEditText.length > 0 && trimmedEditText !== trimmedOriginalText
	);

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			if (canSubmitEdit) {
				onedit?.({ message, text: editText });
				mode = 'view';
			}
		}
	}

	async function handleCopy() {
		try {
			const text = extractTextFromMessage(message);
			const success = await copyToClipboard(text);
			if (success) {
				copiedIndex = 999;
				setTimeout(() => {
					if (copiedIndex === 999) copiedIndex = null;
				}, 1500);
			}
		} catch (e) {
			logger.error('Failed to copy text', e);
		}
	}

	async function handleEdit() {
		mode = 'edit';
		await tick();
		textareaRef?.focus();
	}

	function handleCancel() {
		mode = 'view';
	}

	function handleSave() {
		if (!canSubmitEdit) return;
		onedit?.({ message, text: editText });
		mode = 'view';
	}

	function handleRegenerate() {
		onregenerate?.({ message });
	}

	function conditionalFly(node: Element, params: Record<string, unknown> | null | undefined) {
		const rec = (params ?? {}) as Record<string, unknown>;
		const enabled = rec.enabled !== false;
		if (!enabled) {
			return { duration: 0, css: () => '' };
		}
		const { enabled: _enabled, ...rest } = rec;
		return fly(node, rest as never);
	}
</script>

<div
	id="msg-{message.id}"
	class="group/message w-full"
	data-role={message.role}
	in:conditionalFly|global={{ enabled: enableIntro, opacity: 0, duration: 200 }}
>
	<div
		class={cn(
			'flex py-2 group-data-[role=user]/message:ms-auto group-data-[role=user]/message:max-w-2xl',
			{
				'w-full': mode === 'edit' || message.role === 'assistant',
				'group-data-[role=user]/message:w-fit': mode !== 'edit',
				'items-start': message.role === 'assistant'
			}
		)}
	>
		<div
			class={cn('flex w-full min-w-0 flex-col gap-2', {
				'items-end': message.role === 'user' && mode !== 'edit'
			})}
		>
			{#if hasAttachments(message) && message.attachments.length > 0}
				<div class="flex w-full max-w-full flex-wrap justify-end gap-2">
					{#each message.attachments as attachment (attachment.url)}
						<PreviewAttachment {attachment} />
					{/each}
				</div>
			{/if}

			{#if mode === 'edit'}
				<div class="flex flex-col gap-2">
					<div
						class="bg-muted ui-border-control ui-border-control-focus-within focus-within:ring-ring focus-within:bg-card rounded-surface w-full min-w-0 overflow-hidden transition-colors ring-inset focus-within:ring-2"
					>
						<TextareaAutosize
							bind:ref={textareaRef}
							bind:value={editText}
							class="w-full min-w-0 flex-none px-4 pt-3 pb-3 text-base"
							onkeydown={handleKeyDown}
							minHeight={84}
							maxHeight={400}
							autofocus
						/>
					</div>
					<div class="flex justify-end gap-2">
						<Button variant="outline" size="sm" onclick={handleCancel}>
							{$t('common.cancel')}
						</Button>
						<Button size="sm" disabled={!canSubmitEdit} onclick={handleSave}>
							{$t('chat.save_and_send')}
						</Button>
					</div>
				</div>
			{:else}
				<MessageParts {message} {messageLoading} />

				{#if !messageLoading || message.role === 'user'}
					<MessageActions
						{message}
						{readonly}
						{loading}
						{copiedIndex}
						{totalVersions}
						{currentIndex}
						oncopy={handleCopy}
						onedit={handleEdit}
						onregenerate={handleRegenerate}
						{onswitchversion}
					/>
				{/if}
			{/if}
		</div>
	</div>
</div>
