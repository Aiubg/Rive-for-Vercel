<script lang="ts">
	import { untrack, onMount } from 'svelte';
	import * as Resizable from '$lib/components/ui/resizable';
	import ChatHeader from '$lib/components/chat-header.svelte';
	import Messages from '$lib/components/messages.svelte';
	import MultimodalInput from '$lib/components/multimodal-input.svelte';
	import Spinner from '$lib/components/ui/spinner.svelte';
	import DragDropOverlay from '$lib/components/multimodal/drag-drop-overlay.svelte';
	import { ActiveChat } from '$lib/hooks/active-chat.svelte';
	import { ChatState } from '$lib/hooks/chat-state.svelte';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import { setSearchSidebarContext } from '$lib/hooks/search-sidebar.svelte';
	import { page } from '$app/state';
	import { t } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { toast } from 'svelte-sonner';
	import type { Chat as DbChat, User } from '$lib/types/db';
	import type { UIMessageWithTree } from '$lib/types/message';
	import type { Component } from 'svelte';
	import { modelSupportsVision } from '$lib/ai/model-registry';
	import { SelectedModel } from '$lib/hooks/selected-model.svelte';

	let {
		user,
		chat,
		initialMessages,
		activeRun
	}: {
		user: User | undefined;
		chat: DbChat | undefined;
		initialMessages: UIMessageWithTree[];
		activeRun?: { id: string; assistantMessageId: string; cursor: number } | null;
	} = $props();

	const sidebar = useSidebar();
	const sidebarState = setSearchSidebarContext();
	const activeChat = ActiveChat.fromContext();

	let paneGroup = $state<import('paneforge').PaneGroup>();
	let SearchResultsSidebar = $state<Component<Record<string, never>> | null>(null);

	let isDragging = $state(false);
	let dragCounter = 0;
	const selectedChatModel = SelectedModel.fromContext();
	const supportsVisionInput = $derived(modelSupportsVision(selectedChatModel.value));

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer?.types.includes('Files')) {
			dragCounter++;
			isDragging = true;
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter--;
		if (dragCounter <= 0) {
			isDragging = false;
			dragCounter = 0;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragging = false;
		dragCounter = 0;

		const files = Array.from(e.dataTransfer?.files || []);
		if (files.length > 0) {
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

	$effect(() => {
		const shouldLoad = sidebar.isMobile || sidebarState.isOpen;
		if (!shouldLoad || SearchResultsSidebar) return;
		void (async () => {
			const mod = await import('$lib/components/search-results-sidebar.svelte');
			SearchResultsSidebar = mod.default;
		})();
	});

	const chatState = new ChatState(
		untrack(() => user),
		untrack(() => chat),
		untrack(() => initialMessages),
		{ chatId: untrack(() => chat?.id) }
	);
	const visibleMessages = $derived(chatState.visibleMessages);
	const messagesWithSiblings = $derived(chatState.messagesWithSiblings);

	onMount(() => {
		activeChat.state = chatState;
		if (activeRun) {
			void chatState.resumeActiveRun(activeRun);
		}
		return () => {
			chatState.disconnectStream();
			activeChat.state = null;
		};
	});

	$effect(() => {
		const hash = page.url.hash.replace('#', '');
		if (hash) {
			untrack(() => {
				void chatState.selectMessageById(hash);
			});
		}
	});
</script>

{#snippet SearchSidebarContent()}
	{#if SearchResultsSidebar}
		<SearchResultsSidebar />
	{:else}
		<div class="flex-center h-full w-full p-6">
			<Spinner class="text-primary size-8 border-4" />
		</div>
	{/if}
{/snippet}

<div
	class="flex h-full w-full overflow-hidden"
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondragover={handleDragOver}
	ondrop={handleDrop}
	role="region"
	aria-label={$t('chat.area')}
>
	<DragDropOverlay visible={isDragging} />
	<Resizable.PaneGroup
		direction="horizontal"
		autoSaveId="rivo-search-sidebar-layout"
		bind:paneGroup
	>
		<Resizable.Pane defaultSize={70} minSize={30}>
			<div class="chat-root relative flex h-full flex-col overflow-hidden">
				<ChatHeader {user} chat={chatState.chat} />

				{#if visibleMessages.length === 0}
					<div class="flex flex-1 flex-col items-center justify-center px-6 md:px-12">
						<div class="w-full max-w-3xl">
							<form class="mx-auto flex w-full gap-2">
								<MultimodalInput {chatState} class="flex-1" />
							</form>
						</div>
					</div>
				{:else}
					<Messages
						readonly={false}
						loading={chatState.status === 'streaming' || chatState.status === 'submitted'}
						isStreaming={chatState.status === 'streaming'}
						messages={visibleMessages}
						allMessages={chatState.allMessages}
						{messagesWithSiblings}
						onregenerate={(p) => chatState.handleRegenerate({ messageId: p.message.id })}
						onedit={(p) => chatState.handleEdit({ messageId: p.message.id, newContent: p.text })}
						onswitchbranch={(p, m) => chatState.handleSwitchBranch(p, m)}
					/>

					<form class="bg-background mx-auto flex w-full max-w-220 gap-2 px-6 pb-2 md:px-12">
						<MultimodalInput {chatState} class="flex-1" />
					</form>
				{/if}
			</div>
		</Resizable.Pane>

		{#if !sidebar.isMobile && sidebarState.isOpen}
			<Resizable.Handle
				aria-label={$t('chat.resize_sidebar')}
				ondblclick={() => {
					paneGroup?.setLayout([70, 30]);
				}}
			/>
			<Resizable.Pane defaultSize={30} minSize={20} maxSize={60}>
				{@render SearchSidebarContent()}
			</Resizable.Pane>
		{/if}
	</Resizable.PaneGroup>

	{#if sidebar.isMobile}
		{@render SearchSidebarContent()}
	{/if}
</div>
