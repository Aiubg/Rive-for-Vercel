<script lang="ts">
	import ChatItem from '$lib/components/sidebar-history/item.svelte';
	import {
		SidebarGroup,
		SidebarGroupContent,
		SidebarGroupLabel,
		SidebarMenu
	} from '$lib/components/ui/sidebar';
	import { page } from '$app/state';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import { ChatHistory } from '$lib/hooks/chat-history.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import HistorySkeleton from '$lib/components/sidebar-history/skeleton.svelte';
	import { Input } from '$lib/components/ui/input';
	import { NewChatTrigger } from '$lib/hooks/new-chat.svelte';
	import * as Empty from '$lib/components/ui/empty';
	import { t } from 'svelte-i18n';
	import MessageCircleDashed from '@lucide/svelte/icons/message-circle-dashed';
	import { groupChatsByDate } from '$lib/utils/chat';
	import { tick, untrack } from 'svelte';

	const chatHistory = ChatHistory.fromContext();
	const newChatTrigger = NewChatTrigger.fromContext();
	const groupedChats = $derived(groupChatsByDate(chatHistory.chats));
	let alertDialogOpen = $state(false);
	let renameDialogOpen = $state(false);
	let chatIdToDelete = $state<string | undefined>(undefined);
	let chatIdToRename = $state<string | undefined>(undefined);
	let newChatTitle = $state('');
	let renameInputRef = $state<HTMLInputElement | null>(null);
	let sidebarGroupRef = $state<HTMLElement | null>(null);

	const currentChatId = $derived(
		page.params.chatId || page.url.pathname.match(/\/chat\/([^/]+)/)?.[1] || null
	);

	$effect(() => {
		const id = currentChatId;
		untrack(() => {
			if (chatHistory.activeChatId !== id) {
				chatHistory.setActiveChatId(id);
			}
		});
	});

	$effect(() => {
		if (chatHistory.shouldScrollToTop > 0) {
			if (sidebarGroupRef?.parentElement) {
				sidebarGroupRef.parentElement.scrollTo({ top: 0, behavior: 'smooth' });
			}
		}
	});

	function handleRenameChat() {
		if (chatIdToRename && newChatTitle.trim()) {
			chatHistory.updateTitle(chatIdToRename, newChatTitle.trim());
			renameDialogOpen = false;
		}
	}

	const chatGroupTitles = $derived({
		pinned: $t('history.pinned'),
		today: $t('history.today'),
		yesterday: $t('history.yesterday'),
		lastWeek: $t('history.last_7_days'),
		lastMonth: $t('history.last_30_days'),
		older: $t('history.older')
	} as const);

	async function handleDeleteChat() {
		if (!chatIdToDelete) return;

		const success = await chatHistory.deleteChat(chatIdToDelete);
		if (!success) {
			// Optional: toast error
		}

		alertDialogOpen = false;

		if (chatIdToDelete === page.params.chatId || chatIdToDelete === chatHistory.activeChatId) {
			chatHistory.setActiveChatId(null);
			newChatTrigger.increment();
			await goto(resolve('/'));
		}
	}

	async function focusRenameInput() {
		await tick();
		if (!renameDialogOpen) return;
		renameInputRef?.focus();
		renameInputRef?.select();
	}

	$effect(() => {
		if (renameDialogOpen) {
			void focusRenameInput();
		}
	});
</script>

{#if chatHistory.loading}
	<HistorySkeleton count={5} />
{:else if chatHistory.chats.length === 0}
	<SidebarGroup class="flex-1">
		<SidebarGroupContent class="flex flex-1 flex-col justify-center">
			<Empty.State title={$t('history.no_conversations')} icon={MessageCircleDashed} />
		</SidebarGroupContent>
	</SidebarGroup>
{:else}
	<SidebarGroup bind:ref={sidebarGroupRef}>
		<SidebarGroupContent>
			{#each Object.entries(groupedChats) as [group, chats] (group)}
				{#if chats.length > 0}
					<div>
						<div class="bg-sidebar sticky top-0 z-10 -mx-2 px-2">
							<SidebarGroupLabel class="text-muted-foreground h-8 text-xs font-medium">
								{chatGroupTitles[group as keyof typeof chatGroupTitles]}
							</SidebarGroupLabel>
						</div>
						<SidebarMenu>
							{#each chats as chat (chat.id)}
								<ChatItem
									{chat}
									active={chat.id === currentChatId}
									ondelete={(chatId: string) => {
										chatIdToDelete = chatId;
										alertDialogOpen = true;
									}}
									onrename={(chatId: string, title: string) => {
										chatIdToRename = chatId;
										newChatTitle = title;
										renameDialogOpen = true;
									}}
								/>
							{/each}
						</SidebarMenu>
					</div>
				{/if}
			{/each}
		</SidebarGroupContent>
	</SidebarGroup>
	<AlertDialog bind:open={alertDialogOpen}>
		<AlertDialogContent>
			<AlertDialogHeader>
				<AlertDialogTitle>{$t('history.delete_chat')}</AlertDialogTitle>
				<AlertDialogDescription>
					{$t('history.delete_chat_confirm')}
				</AlertDialogDescription>
			</AlertDialogHeader>
			<AlertDialogFooter>
				<AlertDialogCancel>{$t('common.cancel')}</AlertDialogCancel>
				<AlertDialogAction variant="destructive" onclick={handleDeleteChat}
					>{$t('common.confirm')}</AlertDialogAction
				>
			</AlertDialogFooter>
		</AlertDialogContent>
	</AlertDialog>

	<AlertDialog bind:open={renameDialogOpen}>
		<AlertDialogContent
			onOpenAutoFocus={(event) => {
				event.preventDefault();
				void focusRenameInput();
			}}
		>
			<AlertDialogHeader>
				<AlertDialogTitle>{$t('history.rename_chat')}</AlertDialogTitle>
			</AlertDialogHeader>
			<div>
				<Input
					id="name"
					placeholder={$t('history.new_title')}
					bind:value={newChatTitle}
					bind:ref={renameInputRef}
					autofocus
					aria-label={$t('history.rename_chat')}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							handleRenameChat();
						}
					}}
				/>
			</div>
			<AlertDialogFooter>
				<AlertDialogCancel onclick={() => (renameDialogOpen = false)}
					>{$t('common.cancel')}</AlertDialogCancel
				>
				<AlertDialogAction onclick={handleRenameChat}>{$t('common.confirm')}</AlertDialogAction>
			</AlertDialogFooter>
		</AlertDialogContent>
	</AlertDialog>
{/if}
