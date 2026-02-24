<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from 'svelte-i18n';
	import { Button } from '$lib/components/ui/button';
	import LoaderIcon from '@lucide/svelte/icons/loader-2';

	let { pending, success, children }: { pending: boolean; success: boolean; children: Snippet } =
		$props();
</script>

<Button type={pending ? 'button' : 'submit'} disabled={pending || success} class="relative">
	<span class={pending || success ? 'text-transparent' : ''}>
		{@render children()}
	</span>

	{#if pending || success}
		<span class="flex-center absolute inset-0">
			<LoaderIcon size={16} class="animate-spin" />
		</span>
	{/if}

	<output aria-live="polite" class="sr-only">
		{pending || success ? $t('common.loading') : $t('common.submit')}
	</output>
</Button>
