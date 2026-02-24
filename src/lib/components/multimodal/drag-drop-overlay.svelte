<script lang="ts">
	import { t } from 'svelte-i18n';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import { fade } from 'svelte/transition';

	let { visible = false }: { visible: boolean } = $props();
</script>

{#if visible}
	<div
		transition:fade={{ duration: 150 }}
		class="bg-background/60 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md"
	>
		<div class="flex flex-col items-center justify-center gap-4 p-8">
			<FileUpIcon class="text-primary size-20" strokeWidth={1.5} />
			<div class="flex flex-col items-center gap-2 text-center">
				<h3 class="text-foreground text-2xl font-bold tracking-tight">
					{$t('chat.drop_to_upload')}
				</h3>
				<p class="text-muted-foreground max-w-xs text-sm">
					{$t('chat.drop_upload_hint')}
				</p>
			</div>
		</div>
	</div>
{/if}
