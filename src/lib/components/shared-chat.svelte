<script lang="ts">
	import type { UIMessageWithTree } from '$lib/types/message';
	import Messages from '$lib/components/messages.svelte';
	import { untrack } from 'svelte';
	import {
		computeDefaultSelectedMessageIds,
		getMessagePath,
		computeMessagesWithSiblings
	} from '$lib/utils/chat';

	let {
		initialMessages
	}: {
		initialMessages: UIMessageWithTree[];
	} = $props();

	let selectedMessageIds = $state<Record<string, string>>(
		computeDefaultSelectedMessageIds(untrack(() => initialMessages))
	);
	const visibleMessages = $derived(getMessagePath(initialMessages, selectedMessageIds));
	const messagesWithSiblings = $derived(
		computeMessagesWithSiblings(initialMessages, visibleMessages)
	);

	function handleSwitchBranch(parentId: string, messageId: string) {
		selectedMessageIds = {
			...selectedMessageIds,
			[parentId]: messageId
		};
	}
</script>

<div class="chat-root relative flex h-full flex-col overflow-hidden">
	<Messages
		readonly={true}
		loading={false}
		messages={visibleMessages}
		{messagesWithSiblings}
		allMessages={initialMessages}
		onswitchbranch={handleSwitchBranch}
	/>
</div>
