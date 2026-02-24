<script lang="ts">
	import Chat from '$lib/components/chat.svelte';
	import { NewChatTrigger } from '$lib/hooks/new-chat.svelte';

	let { data } = $props();
	const newChatTrigger = NewChatTrigger.fromContext();
</script>

{#key `${newChatTrigger.value}`}
	<Chat chat={undefined} initialMessages={[]} user={data.user} />
{/key}
