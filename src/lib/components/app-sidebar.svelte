<script lang="ts">
	import {
		useSidebar,
		Sidebar,
		SidebarContent,
		SidebarFooter,
		SidebarHeader,
		SidebarMenu,
		SidebarMenuItem,
		SidebarMenuButton
	} from '$lib/components/ui/sidebar';
	import { resolve } from '$app/paths';
	import MessageCirclePlus from '@lucide/svelte/icons/message-circle-plus';
	import Search from '@lucide/svelte/icons/search';
	import Folder from '@lucide/svelte/icons/folder';
	import type { User } from '$lib/types/db';
	import SidebarUserNav from '$lib/components/sidebar-user-nav.svelte';
	import { SidebarHistory } from '$lib/components/sidebar-history';
	import { NewChatTrigger } from '$lib/hooks/new-chat.svelte';
	import { ChatHistory } from '$lib/hooks/chat-history.svelte';
	import { getChatSearchContext } from '$lib/hooks/chat-search.svelte';
	import { t } from 'svelte-i18n';
	import Logo from '$lib/components/ui/logo/logo.svelte';
	import SidebarToggle from '$lib/components/sidebar-toggle.svelte';
	import * as Kbd from '$lib/components/ui/kbd';
	import { page } from '$app/state';
	let { user }: { user: User | undefined } = $props();

	const context = useSidebar();
	const newChatTrigger = NewChatTrigger.fromContext();
	const chatHistory = ChatHistory.fromContext();
	const chatSearch = getChatSearchContext();

	const isMac =
		typeof navigator !== 'undefined' &&
		((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
			?.toUpperCase()
			.includes('MAC') ??
			navigator.userAgent.toUpperCase().includes('MAC'));
	const modifier = isMac ? $t('shortcuts.modifier_mac') : $t('shortcuts.modifier_win');
	const isFilesPage = $derived(page.url.pathname === '/files');
</script>

<Sidebar class="group-data-[side=left]:border-e-0">
	<SidebarHeader>
		<div class="flex h-10 flex-row items-center justify-between">
			<a
				href={resolve('/')}
				onclick={() => {
					context.setOpenMobile(false);
					chatHistory.setActiveChatId(null);
				}}
				class="ui-focus-ring ui-focus-ring-sidebar hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-control inline-flex shrink-0 items-center justify-center transition-colors outline-none select-none"
				aria-label={$t('common.go_to_home')}
			>
				<Logo size={30} class="p-1" />
			</a>
			<SidebarToggle />
		</div>
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton
					variant="default"
					tooltipContent={$t('common.new_chat')}
					onclick={() => {
						context.setOpenMobile(false);
						newChatTrigger.trigger();
					}}
				>
					<MessageCirclePlus size={16} />
					<span>{$t('common.new_chat')}</span>
					<Kbd.Group
						class="ms-auto opacity-0 transition-opacity group-hover/menu-item:opacity-100 group-data-[collapsible=icon]:hidden"
					>
						<Kbd.Root>{modifier}</Kbd.Root>
						<Kbd.Root>{$t('shortcuts.shift')}</Kbd.Root>
						<Kbd.Root>O</Kbd.Root>
					</Kbd.Group>
				</SidebarMenuButton>
			</SidebarMenuItem>
			<SidebarMenuItem>
				<SidebarMenuButton
					tooltipContent={$t('common.search')}
					onclick={() => {
						context.setOpenMobile(false);
						chatSearch.open();
					}}
				>
					<Search size={16} />
					<span>{$t('common.search')}</span>
					<Kbd.Group
						class="ms-auto opacity-0 transition-opacity group-hover/menu-item:opacity-100 group-data-[collapsible=icon]:hidden"
					>
						<Kbd.Root>{modifier}</Kbd.Root>
						<Kbd.Root>K</Kbd.Root>
					</Kbd.Group>
				</SidebarMenuButton>
			</SidebarMenuItem>
			<SidebarMenuItem>
				<SidebarMenuButton tooltipContent={$t('common.files')} isActive={isFilesPage}>
					{#snippet child({ props })}
						<a
							{...props}
							href={resolve('/files')}
							onclick={() => {
								context.setOpenMobile(false);
							}}
						>
							<Folder size={16} />
							<span>{$t('common.files')}</span>
							<Kbd.Group
								class="ms-auto opacity-0 transition-opacity group-hover/menu-item:opacity-100 group-data-[collapsible=icon]:hidden"
							>
								<Kbd.Root>{modifier}</Kbd.Root>
								<Kbd.Root>{$t('shortcuts.shift')}</Kbd.Root>
								<Kbd.Root>F</Kbd.Root>
							</Kbd.Group>
						</a>
					{/snippet}
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	</SidebarHeader>
	<SidebarContent>
		<SidebarHistory />
	</SidebarContent>
	<SidebarFooter>
		{#if user}
			<SidebarUserNav {user} />
		{/if}
	</SidebarFooter>
</Sidebar>
