<script lang="ts">
	import { onMount, tick } from 'svelte';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { Attachment } from '$lib/types/attachment';
	import PreviewAttachment from '$lib/components/preview-attachment.svelte';
	import { Button } from '$lib/components/ui/button';
	import { t } from 'svelte-i18n';
	import { IsMobile } from '$lib/hooks/is-mobile.svelte';

	let {
		attachments,
		uploadQueue,
		onremove
	}: {
		attachments: Attachment[];
		uploadQueue: Iterable<string>;
		onremove?: (url: string) => void;
	} = $props();

	let scrollerRef = $state<HTMLDivElement | null>(null);
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);
	const SCROLL_STEP = 220;
	const isMobileViewport = new IsMobile();
	const isMobile = $derived(isMobileViewport.current);
	const queuedFileNames = $derived.by(() => Array.from(uploadQueue));
	const hasItems = $derived(attachments.length > 0 || queuedFileNames.length > 0);

	function updateScrollControls() {
		if (isMobile) {
			canScrollLeft = false;
			canScrollRight = false;
			return;
		}
		if (!scrollerRef) {
			canScrollLeft = false;
			canScrollRight = false;
			return;
		}
		const { scrollLeft, clientWidth, scrollWidth } = scrollerRef;
		const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
		canScrollLeft = scrollLeft > 1;
		canScrollRight = maxScrollLeft - scrollLeft > 1;
	}

	function scrollAttachments(direction: 'left' | 'right') {
		if (!scrollerRef) return;
		const delta = direction === 'left' ? -SCROLL_STEP : SCROLL_STEP;
		scrollerRef.scrollBy({ left: delta, behavior: 'smooth' });
	}

	onMount(() => {
		const el = scrollerRef;
		if (!el) return;
		const observer = new ResizeObserver(() => {
			updateScrollControls();
		});
		observer.observe(el);
		updateScrollControls();
		return () => {
			observer.disconnect();
		};
	});

	$effect(() => {
		void attachments.length;
		void queuedFileNames.length;
		tick().then(updateScrollControls);
	});
</script>

{#if hasItems}
	<div class="relative">
		{#if !isMobile && canScrollLeft}
			<div class="bg-background pointer-events-none absolute inset-y-0 start-0 z-10 w-5"></div>
			<div
				class="from-background pointer-events-none absolute inset-y-0 start-5 z-10 w-10 bg-linear-to-r to-transparent"
			></div>
			<Button
				variant="ghost"
				size="icon-sm"
				class="absolute start-0 top-1/2 z-20 -translate-y-1/2"
				aria-label={$t('common.previous')}
				onclick={() => scrollAttachments('left')}
			>
				<ChevronLeftIcon class="size-4" />
			</Button>
		{/if}

		<div
			bind:this={scrollerRef}
			class="scrollbar-hidden flex flex-row items-end gap-2 overflow-x-auto"
			onscroll={updateScrollControls}
		>
			{#each attachments as attachment (attachment.url)}
				<PreviewAttachment {attachment} onremove={() => onremove?.(attachment.url)} />
			{/each}
			{#each queuedFileNames as filename (filename)}
				<PreviewAttachment attachment={{ url: '', name: filename, contentType: '' }} uploading />
			{/each}
		</div>

		{#if !isMobile && canScrollRight}
			<div class="bg-background pointer-events-none absolute inset-y-0 end-0 z-10 w-5"></div>
			<div
				class="from-background pointer-events-none absolute inset-y-0 end-5 z-10 w-10 bg-linear-to-l to-transparent"
			></div>
			<Button
				variant="ghost"
				size="icon-sm"
				class="absolute end-0 top-1/2 z-20 -translate-y-1/2"
				aria-label={$t('common.next')}
				onclick={() => scrollAttachments('right')}
			>
				<ChevronRightIcon class="size-4" />
			</Button>
		{/if}
	</div>
{/if}
