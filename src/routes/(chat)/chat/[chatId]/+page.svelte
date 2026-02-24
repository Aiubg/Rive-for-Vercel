<script lang="ts">
	import Chat from '$lib/components/chat.svelte';
	import SharedChat from '$lib/components/shared-chat.svelte';
	import { convertToUIMessages } from '$lib/utils/chat';

	let { data } = $props();
</script>

{#key data.chat.id}
	{#if data.user?.id === data.chat.userId}
		<Chat
			chat={data.chat}
			initialMessages={convertToUIMessages(data.messages)}
			user={data.user}
			activeRun={data.activeRun}
		/>
	{:else}
		<SharedChat initialMessages={convertToUIMessages(data.messages)} />
	{/if}
{/key}
