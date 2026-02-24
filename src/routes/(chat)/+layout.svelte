<script lang="ts">
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import { SidebarInset, SidebarProvider } from '$lib/components/ui/sidebar';
	import { ChatHistory } from '$lib/hooks/chat-history.svelte';
	import { NewChatTrigger } from '$lib/hooks/new-chat.svelte';
	import { SettingsState } from '$lib/hooks/settings-state.svelte';
	import { ActiveChat } from '$lib/hooks/active-chat.svelte';
	import { SharesState } from '$lib/hooks/shares.svelte';
	import { setChatSearchContext } from '$lib/hooks/chat-search.svelte';
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { pushState } from '$app/navigation';
	import type { Component } from 'svelte';

	let { data, children } = $props();

	const isSharePage = $derived(page.url.pathname.startsWith('/share/'));
	let ChatSearchModal = $state<Component<Record<string, never>> | null>(null);
	let ShortcutHandler = $state<Component<Record<string, never>> | null>(null);
	let historySearch = $state('');

	const chatHistory = new ChatHistory(untrack(() => data.chats));
	chatHistory.setContext();

	const newChatTrigger = new NewChatTrigger(chatHistory);
	newChatTrigger.setContext();

	const settingsState = new SettingsState();
	settingsState.setContext();

	const activeChat = new ActiveChat();
	activeChat.setContext();

	const sharesState = new SharesState();
	sharesState.setContext();

	const chatSearch = setChatSearchContext();

	const selectedChatModel = untrack(() => data.selectedChatModel);
	selectedChatModel.setContext();

	const chatTitle = $derived(activeChat.state?.chat?.title || page.data.chat?.title || '');

	$effect(() => {
		chatHistory.load(data.chats);
	});

	$effect(() => {
		const activeState = activeChat.state;
		const activeChatId = activeState?.chat?.id;
		if (!activeState || !activeChatId || !activeState.chat) return;

		const latest = chatHistory.chats.find((chat) => chat.id === activeChatId);
		if (!latest) return;

		if (latest.title !== activeState.chat.title) {
			activeState.chat = { ...activeState.chat, title: latest.title, updatedAt: latest.updatedAt };
		}
	});

	$effect(() => {
		selectedChatModel.update(data.selectedChatModel.value, true);
	});

	$effect(() => {
		const modal =
			typeof window === 'undefined'
				? page.url.searchParams.get('modal')
				: new URLSearchParams(historySearch || window.location.search).get('modal');
		untrack(() => {
			if (settingsState.open !== (modal === 'settings')) {
				settingsState.open = modal === 'settings';
			}
			if (settingsState.shortcutsOpen !== (modal === 'shortcuts')) {
				settingsState.shortcutsOpen = modal === 'shortcuts';
			}
			if (chatSearch.isOpen !== (modal === 'search')) {
				chatSearch.isOpen = modal === 'search';
			}
			if (activeChat.shareModalOpen !== (modal === 'share')) {
				activeChat.shareModalOpen = modal === 'share';
			}
		});
	});

	$effect(() => {
		const currentState = {
			settings: settingsState.open,
			shortcuts: settingsState.shortcutsOpen,
			search: chatSearch.isOpen,
			share: activeChat.shareModalOpen
		};

		const activeModal = Object.entries(currentState).find(([_, open]) => open)?.[0] || null;

		untrack(() => {
			if (typeof window === 'undefined') return;
			const url = new URL(window.location.href);
			const urlModal = url.searchParams.get('modal');

			if (activeModal !== urlModal) {
				if (activeModal) {
					url.searchParams.set('modal', activeModal);
				} else {
					url.searchParams.delete('modal');
				}

				const nextHref = url.pathname + url.search + url.hash;
				const currentHref =
					window.location.pathname + window.location.search + window.location.hash;
				if (nextHref === currentHref) return;

				pushState(nextHref, {});
				historySearch = window.location.search;
			}
		});
	});

	onMount(() => {
		const syncHistorySearch = () => {
			historySearch = window.location.search;
		};

		syncHistorySearch();
		window.addEventListener('popstate', syncHistorySearch);

		if (!isSharePage && data.user) {
			void (async () => {
				const mod = await import('$lib/components/chat-search-modal.svelte');
				ChatSearchModal = mod.default;
			})();
			void (async () => {
				const mod = await import('$lib/components/shortcut-handler.svelte');
				ShortcutHandler = mod.default;
			})();
			chatHistory.startGeneratingPoll();
		}
		return () => {
			window.removeEventListener('popstate', syncHistorySearch);
			chatHistory.stopGeneratingPoll();
		};
	});
</script>

<svelte:head>
	{#if chatTitle}
		<title>{chatTitle}</title>
	{/if}
</svelte:head>

<SidebarProvider open={!data.sidebarCollapsed && !isSharePage && !!data.user}>
	{#if !isSharePage && data.user}
		{#if ShortcutHandler}
			<ShortcutHandler />
		{/if}
		<AppSidebar user={data.user} />
		{#if ChatSearchModal}
			<ChatSearchModal />
		{/if}
	{/if}
	<SidebarInset>{@render children?.()}</SidebarInset>
</SidebarProvider>
