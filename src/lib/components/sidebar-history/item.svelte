<script lang="ts">
	import type { Chat } from '$lib/types/db';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import {
		useSidebar,
		SidebarMenuAction,
		SidebarMenuButton,
		SidebarMenuItem
	} from '$lib/components/ui/sidebar';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import ShareIcon from '@lucide/svelte/icons/share';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PinIcon from '@lucide/svelte/icons/pin';
	import PinOffIcon from '@lucide/svelte/icons/pin-off';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import ShareModal from '$lib/components/share-modal.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ChatHistory } from '$lib/hooks/chat-history.svelte';
	import { t } from 'svelte-i18n';
	import Spinner from '$lib/components/ui/spinner.svelte';

	let {
		chat,
		active,
		ondelete,
		onrename
	}: {
		chat: Chat;
		active: boolean;
		ondelete: (chatId: string) => void;
		onrename: (chatId: string, title: string) => void;
	} = $props();

	const context = useSidebar();

	const chatHistory = ChatHistory.fromContext();
	const activeDerived = $derived(active || chatHistory.activeChatId === chat.id);
	const isGeneratingDerived = $derived(chatHistory.isGenerating(chat.id));
	const generatingDerived = $derived(!context.isMobile && !activeDerived && isGeneratingDerived);
	const unreadDerived = $derived(
		!activeDerived && !isGeneratingDerived && chatHistory.isUnread(chat.id)
	);

	let shareModalOpen = $state(false);
	let menuOpen = $state(false);

	function handleNavigate() {
		goto(resolve(`/chat/${chat.id}`));
		chatHistory.setActiveChatId(chat.id);
		context.setOpenMobile(false);
	}

	function handleRename() {
		onrename(chat.id, chat.title);
	}

	function handleTogglePin() {
		chatHistory.updatePinned(chat.id, !chat.pinned);
	}

	function handleShare() {
		shareModalOpen = true;
	}

	function handleDelete() {
		ondelete(chat.id);
	}
</script>

<SidebarMenuItem>
	<SidebarMenuButton isActive={activeDerived}>
		{#snippet child({ props })}
			<button {...props} onclick={handleNavigate}>
				<span>{chat.title}</span>
			</button>
		{/snippet}
	</SidebarMenuButton>

	<DropdownMenu bind:open={menuOpen}>
		<DropdownMenuTrigger>
			{#snippet child({ props })}
				{#if generatingDerived && !menuOpen}
					<SidebarMenuAction
						class="pointer-events-none me-1 group-hover/menu-item:opacity-0 group-has-focus-visible/menu-item:opacity-0"
					>
						<Spinner />
						<span class="sr-only">{$t('common.loading')}</span>
					</SidebarMenuAction>
				{:else if unreadDerived && !menuOpen}
					<SidebarMenuAction
						class="pointer-events-none me-1 group-hover/menu-item:opacity-0 group-has-focus-visible/menu-item:opacity-0"
					>
						<span class="bg-primary rounded-pill size-2" aria-hidden="true"></span>
					</SidebarMenuAction>
				{/if}
				<SidebarMenuAction
					{...props}
					class="me-1 {generatingDerived
						? 'md:pointer-events-none md:group-hover/menu-item:pointer-events-auto md:group-has-focus-visible/menu-item:pointer-events-auto'
						: ''}"
					showOnHover={!activeDerived}
				>
					<MoreHorizontalIcon size={16} />
					<span class="sr-only">{$t('history.more')}</span>
				</SidebarMenuAction>
			{/snippet}
		</DropdownMenuTrigger>

		<DropdownMenuContent side="bottom" align="end">
			<DropdownMenuItem class="cursor-pointer" onclick={handleRename}>
				<PencilIcon size={16} />
				<span>{$t('history.rename')}</span>
			</DropdownMenuItem>

			<DropdownMenuItem class="cursor-pointer" onclick={handleTogglePin}>
				{#if chat.pinned}
					<PinOffIcon size={16} />
					<span>{$t('history.unpin')}</span>
				{:else}
					<PinIcon size={16} />
					<span>{$t('history.pin')}</span>
				{/if}
			</DropdownMenuItem>

			<DropdownMenuItem class="cursor-pointer" onclick={handleShare}>
				<ShareIcon size={16} />
				<span>{$t('history.share')}</span>
			</DropdownMenuItem>

			<DropdownMenuItem variant="destructive" class="cursor-pointer" onclick={handleDelete}>
				<TrashIcon size={16} />
				<span>{$t('history.delete')}</span>
			</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
</SidebarMenuItem>

<ShareModal bind:open={shareModalOpen} chatId={chat.id} />
