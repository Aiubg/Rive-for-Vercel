<script lang="ts">
	import Spinner from '$lib/components/ui/spinner.svelte';
	import { t } from 'svelte-i18n';

	let {
		name = null,
		url = null,
		contentType = null,
		content = null,
		loading = false
	}: {
		name?: string | null;
		url?: string | null;
		contentType?: string | null;
		content?: string | null;
		loading?: boolean;
	} = $props();
</script>

<div class="bg-background min-h-0 flex-1 overflow-auto p-4">
	{#if loading}
		<div class="text-muted-foreground flex h-full items-center justify-center text-sm">
			<Spinner class="size-4" />
			<span class="ml-2">{$t('common.loading')}</span>
		</div>
	{:else if contentType?.startsWith('image/') && url}
		<div class="flex h-full w-full items-center justify-center">
			<img
				src={url}
				alt={name ?? $t('common.image_attachment')}
				class="rounded-control h-auto max-h-full max-w-full"
			/>
		</div>
	{:else if content !== null}
		<pre class="p-0 text-xs leading-relaxed whitespace-pre-wrap">{content}</pre>
	{:else}
		<div class="text-muted-foreground flex h-full items-center justify-center text-sm">
			{$t('files.preview_not_supported')}
		</div>
	{/if}
</div>
