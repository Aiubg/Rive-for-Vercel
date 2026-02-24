<script lang="ts">
	import { cn } from '$lib/utils/shadcn';
	import { onMount } from 'svelte';
	import { LocalStorage } from '$lib/hooks/local-storage.svelte';
	import { t } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { toast } from 'svelte-sonner';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import * as InputGroup from '$lib/components/ui/input-group';
	import AttachmentList from '$lib/components/multimodal/attachment-list.svelte';
	import AttachmentUploader from '$lib/components/multimodal/attachment-uploader.svelte';
	import { getChatDraftStorageKey } from '$lib/components/multimodal/draft-storage';
	import SubmitControls from '$lib/components/multimodal/submit-controls.svelte';
	import TextareaAutosize from '$lib/components/multimodal/textarea-autosize.svelte';
	import { modelSupportsVision } from '$lib/ai/model-registry';
	import { SelectedModel } from '$lib/hooks/selected-model.svelte';
	import type { ChatState } from '$lib/hooks/chat-state.svelte';
	import type { Attachment } from '$lib/types/attachment';

	let {
		chatState,
		class: c
	}: {
		chatState: ChatState;
		class?: string;
	} = $props();

	const sidebar = useSidebar();
	let mounted = $state(false);
	let textareaRef = $state(null) as HTMLTextAreaElement | null;
	const newChatDraftStorageKey = getChatDraftStorageKey();
	const draftStorageKey = $derived(getChatDraftStorageKey(chatState.chat?.id));
	let storedInput = $state<LocalStorage<string> | null>(null);
	let storedInputKey = $state('');
	const loading = $derived(chatState.status === 'streaming' || chatState.status === 'submitted');
	const hasText = $derived(chatState.input.trim().length > 0);
	const hasAttachments = $derived(chatState.attachments.length > 0);
	const hasImageAttachments = $derived(
		chatState.attachments.some((attachment) => attachment.contentType?.startsWith('image/'))
	);
	const selectedChatModel = SelectedModel.fromContext();
	const supportsVisionInput = $derived(modelSupportsVision(selectedChatModel.value));
	const hasUnsupportedImageAttachments = $derived(hasImageAttachments && !supportsVisionInput);
	const uploadsInProgress = $derived(chatState.uploadQueue.size > 0);
	const canSend = $derived(
		(hasText || hasAttachments) && !uploadsInProgress && !hasUnsupportedImageAttachments
	);
	const submitStatus = $derived(
		chatState.status === 'submitted'
			? 'submitting'
			: chatState.status === 'streaming'
				? 'streaming'
				: 'idle'
	);

	const showWelcome = $derived(mounted && chatState.visibleMessages.length === 0);
	const chatInputMinLines = $derived(sidebar.isMobile ? 1 : 2);

	function setInput(value: string) {
		chatState.input = value;
	}

	async function submitForm(event?: Event) {
		try {
			await chatState.handleSubmit(event, {
				commitUserImmediately: chatState.visibleMessages.length > 0
			});

			if (!sidebar.isMobile) {
				textareaRef?.focus();
			}
		} catch (_e) {
			// Error is already handled by toast in state.handleSubmit
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			if (loading) {
				return;
			}
			if (canSend) {
				submitForm();
			} else if (hasUnsupportedImageAttachments) {
				toast.error(get(t)('models.vision_not_supported'));
			}
		}
	}

	function handleFocus() {
		textareaRef?.focus();
	}

	function handleFileChange(files: File[]) {
		chatState.handleFileChange(files);
	}

	function handleSelectRecentAttachment(attachment: Attachment) {
		chatState.addAttachments([attachment]);
	}

	function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;

		const files: File[] = [];
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item?.kind === 'file') {
				const file = item.getAsFile();
				if (file) {
					files.push(file);
				}
			}
		}

		if (files.length > 0) {
			event.preventDefault();
			const imageFiles = files.filter(
				(file) =>
					file.type.toLowerCase().startsWith('image/') ||
					/\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name)
			);
			const blockedByVision = !supportsVisionInput && imageFiles.length > 0;
			if (blockedByVision) {
				toast.error(get(t)('models.vision_not_supported'));
			}
			const acceptedFiles = blockedByVision
				? files.filter(
						(file) =>
							!(
								file.type.toLowerCase().startsWith('image/') ||
								/\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name)
							)
					)
				: files;
			if (acceptedFiles.length > 0) {
				chatState.handleFileChange(acceptedFiles);
			}
		}
	}

	function handleSend() {
		if (hasUnsupportedImageAttachments) {
			toast.error(get(t)('models.vision_not_supported'));
			return;
		}
		void submitForm();
	}

	function handleStop() {
		chatState.stop();
	}

	$effect(() => {
		const nextKey = draftStorageKey;
		if (storedInput && storedInputKey === nextKey) {
			return;
		}

		if (
			storedInput &&
			storedInputKey === newChatDraftStorageKey &&
			nextKey !== newChatDraftStorageKey
		) {
			storedInput.delete();
		}

		storedInput?.destroy();
		storedInput = new LocalStorage(nextKey, '');
		storedInputKey = nextKey;

		if (mounted) {
			chatState.input = storedInput.value;
		}
	});

	onMount(() => {
		mounted = true;
		chatState.input = storedInput?.value ?? '';
		return () => {
			storedInput?.destroy();
			storedInput = null;
			storedInputKey = '';
		};
	});

	$effect.pre(() => {
		if (!mounted || !storedInput) return;
		if (chatState.input === '') {
			storedInput.delete();
			return;
		}
		storedInput.value = chatState.input;
	});

	function handleRemoveAttachment(url: string) {
		chatState.removeAttachment(url);
	}
</script>

<div class="relative flex w-full flex-col gap-4">
	{#if showWelcome}
		<div class="absolute inset-x-0 bottom-full mb-6 pb-4">
			<p
				class="text-foreground flex items-center justify-center gap-2 text-center text-2xl select-none"
			>
				<span>{$t('chat.welcome')}</span>
			</p>
		</div>
	{/if}

	<InputGroup.Root
		class="input-group-chat bg-chat-input rounded-dialog h-auto flex-col items-stretch overflow-hidden"
		onclick={handleFocus}
	>
		<div class="flex flex-col gap-2">
			{#if hasAttachments || uploadsInProgress}
				<div class="px-3 pt-3">
					<AttachmentList
						attachments={chatState.attachments}
						uploadQueue={chatState.uploadQueue}
						onremove={handleRemoveAttachment}
					/>
				</div>
			{/if}

			<TextareaAutosize
				bind:ref={textareaRef}
				id="chat-input"
				name="prompt"
				aria-label={$t('chat.input_aria_label')}
				placeholder={$t('chat.placeholder')}
				bind:value={() => chatState.input, setInput}
				class={cn('text-base', c)}
				minLines={chatInputMinLines}
				maxHeight={400}
				autofocus={!sidebar.isMobile}
				onkeydown={handleKeyDown}
				onpaste={handlePaste}
			/>
		</div>

		<InputGroup.Addon align="block-end" class="w-full justify-between border-t-0 p-2">
			<AttachmentUploader
				disabled={loading}
				onchange={handleFileChange}
				onselectrecent={handleSelectRecentAttachment}
			/>
			<div class="flex w-fit flex-row items-center justify-end gap-2">
				<SubmitControls status={submitStatus} {canSend} onsend={handleSend} onstop={handleStop} />
			</div>
		</InputGroup.Addon>
	</InputGroup.Root>
</div>
