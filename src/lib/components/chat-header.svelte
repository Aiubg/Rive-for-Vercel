<script lang="ts">
	import { useSidebar } from '$lib/components/ui/sidebar';
	import SidebarToggle from '$lib/components/sidebar-toggle.svelte';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import { Button } from '$lib/components/ui/button';
	import MessageCirclePlus from '@lucide/svelte/icons/message-circle-plus';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Chat, User } from '$lib/types/db';
	import ShareModal from '$lib/components/share-modal.svelte';
	import Share from '@lucide/svelte/icons/share';
	import { NewChatTrigger } from '$lib/hooks/new-chat.svelte';
	import { ActiveChat } from '$lib/hooks/active-chat.svelte';
	import { t } from 'svelte-i18n';
	import { page } from '$app/state';
	import ModelSelector from '$lib/components/model-selector.svelte';

	let {
		user,
		chat
	}: {
		user: User | undefined;
		chat: Chat | undefined;
	} = $props();

	const sidebar = useSidebar();
	const newChatTrigger = NewChatTrigger.fromContext();
	const activeChat = ActiveChat.fromContext();
	const isHome = $derived(page.url.pathname === '/');
</script>

<header class="bg-background sticky top-0 z-10 flex h-14 items-center gap-2 px-4">
	{#if user && (!sidebar.open || sidebar.isMobile)}
		<SidebarToggle />
	{/if}

	{#if (!sidebar.open || sidebar.isMobile) && !(sidebar.isMobile && isHome)}
		<Tooltip>
			<TooltipTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon-sm"
						class="order-2 md:order-1"
						onclick={() => newChatTrigger.trigger()}
						aria-label={$t('common.new_chat')}
					>
						<MessageCirclePlus size={16} />
						<span class="sr-only">{$t('common.new_chat')}</span>
					</Button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent>{$t('common.new_chat')}</TooltipContent>
		</Tooltip>
	{/if}

	<ModelSelector class="order-2 max-w-[min(45vw,16rem)] px-1" />

	<div class="order-3 flex-1"></div>

	{#if chat}
		<Tooltip>
			<TooltipTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon-sm"
						class="order-4"
						onclick={() => (activeChat.shareModalOpen = true)}
						aria-label={$t('history.share')}
					>
						<Share size={16} />
						<span class="sr-only">{$t('history.share')}</span>
					</Button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent>{$t('history.share')}</TooltipContent>
		</Tooltip>

		<ShareModal bind:open={activeChat.shareModalOpen} chatId={chat.id} />
	{/if}

	{#if !user}
		<Button size="sm" class="order-5 px-2 py-2" onclick={() => goto(resolve('/signin'))}>
			{$t('auth.sign_in')}
		</Button>
	{/if}
</header>
