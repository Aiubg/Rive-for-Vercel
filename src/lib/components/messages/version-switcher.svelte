<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';
	import { t } from 'svelte-i18n';

	let {
		currentIndex,
		total,
		onchange
	}: {
		currentIndex: number;
		total: number;
		onchange: (index: number) => void;
	} = $props();

	function handlePrev() {
		if (currentIndex > 0) {
			onchange(currentIndex - 1);
		}
	}

	function handleNext() {
		if (currentIndex < total - 1) {
			onchange(currentIndex + 1);
		}
	}
</script>

{#if total > 1}
	<div class="text-muted-foreground flex items-center text-sm select-none">
		<Button
			variant="ghost"
			size="icon-sm"
			disabled={currentIndex === 0}
			onclick={handlePrev}
			aria-label={$t('common.previous')}
		>
			<ChevronLeft size={16} class="rtl-mirror" />
		</Button>
		<span class="min-w-10 text-center">
			{currentIndex + 1} / {total}
		</span>
		<Button
			variant="ghost"
			size="icon-sm"
			disabled={currentIndex === total - 1}
			onclick={handleNext}
			aria-label={$t('common.next')}
		>
			<ChevronRight size={16} class="rtl-mirror" />
		</Button>
	</div>
{/if}
