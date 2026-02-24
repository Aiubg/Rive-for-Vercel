<script lang="ts">
	import { NewChatTrigger } from '$lib/hooks/new-chat.svelte';
	import { SettingsState } from '$lib/hooks/settings-state.svelte';
	import { ActiveChat } from '$lib/hooks/active-chat.svelte';
	import { ChatHistory } from '$lib/hooks/chat-history.svelte';
	import { getChatSearchContext } from '$lib/hooks/chat-search.svelte';
	import { IsMobile } from '$lib/hooks/is-mobile.svelte.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const newChatTrigger = NewChatTrigger.fromContext();
	const settingsState = SettingsState.fromContext();
	const activeChat = ActiveChat.fromContext();
	const chatHistory = ChatHistory.fromContext();
	const chatSearch = getChatSearchContext();
	const isMobile = new IsMobile();

	function handleKeydown(event: KeyboardEvent) {
		if (isMobile.current) return;

		const isMac =
			(navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
				?.toUpperCase()
				.includes('MAC') ?? navigator.userAgent.toUpperCase().includes('MAC');
		const modifier = isMac ? event.metaKey : event.ctrlKey;

		// New Chat: Cmd/Ctrl + Shift + O
		if (modifier && event.shiftKey && event.key.toLowerCase() === 'o') {
			event.preventDefault();
			chatHistory.setActiveChatId(null);
			if (window.location.pathname !== '/') {
				goto(resolve('/'));
			} else {
				newChatTrigger.increment();
			}
		}

		// Toggle Search: Cmd/Ctrl + K
		if (modifier && event.key === 'k') {
			event.preventDefault();
			const willOpen = !chatSearch.isOpen;
			if (willOpen) {
				settingsState.open = false;
				settingsState.shortcutsOpen = false;
				activeChat.shareModalOpen = false;
			}
			chatSearch.toggle();
		}

		// Open Files: Cmd/Ctrl + Shift + F
		if (modifier && event.shiftKey && event.key.toLowerCase() === 'f') {
			event.preventDefault();
			chatSearch.close();
			settingsState.open = false;
			settingsState.shortcutsOpen = false;
			activeChat.shareModalOpen = false;
			if (window.location.pathname !== '/files') {
				goto(resolve('/files'));
			}
		}

		// Open Settings: Cmd/Ctrl + ,
		if (modifier && event.key === ',') {
			event.preventDefault();
			const willOpen = !settingsState.open;
			if (willOpen) {
				chatSearch.close();
				settingsState.shortcutsOpen = false;
				activeChat.shareModalOpen = false;
			}
			settingsState.open = !settingsState.open;
		}

		// Open Keyboard Shortcuts: Cmd/Ctrl + /
		if (modifier && event.key === '/') {
			event.preventDefault();
			const willOpen = !settingsState.shortcutsOpen;
			if (willOpen) {
				chatSearch.close();
				settingsState.open = false;
				activeChat.shareModalOpen = false;
			}
			settingsState.shortcutsOpen = !settingsState.shortcutsOpen;
		}

		// Share Chat: Cmd/Ctrl + Shift + S
		if (modifier && event.shiftKey && event.key.toLowerCase() === 's') {
			if (activeChat.state?.chat) {
				event.preventDefault();
				chatSearch.close();
				settingsState.open = false;
				settingsState.shortcutsOpen = false;
				activeChat.shareModalOpen = true;
			}
		}

		// Stop Generating: Cmd/Ctrl + .
		if (modifier && event.key === '.') {
			if (activeChat.state?.status === 'streaming') {
				event.preventDefault();
				activeChat.state.stop();
			}
		}

		// Close settings on Escape
		if (event.key === 'Escape') {
			if (settingsState.open || settingsState.shortcutsOpen || chatSearch.isOpen) {
				event.preventDefault();
				settingsState.open = false;
				settingsState.shortcutsOpen = false;
				chatSearch.close();
			}
		}

		// Focus Input: /
		if (
			event.key === '/' &&
			!['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)
		) {
			event.preventDefault();
			const input = document.getElementById('chat-input') as HTMLElement;
			input?.focus();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />
