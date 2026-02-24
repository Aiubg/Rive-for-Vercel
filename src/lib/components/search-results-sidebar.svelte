<script lang="ts">
	import { getSearchSidebarContext } from '$lib/hooks/search-sidebar.svelte';
	import { t, date } from 'svelte-i18n';
	import XIcon from '@lucide/svelte/icons/x';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import { cn } from '$lib/utils/shadcn';
	import * as Empty from '$lib/components/ui/empty';
	import FilePreviewContent from '$lib/components/file-preview-content.svelte';

	const sidebarContext = useSidebar();
	const sidebar = getSearchSidebarContext();
	const SEARCH_RESULTS_WINDOW_MIN = 40;
	const SEARCH_RESULTS_WINDOW_STEP = 30;
	const SEARCH_RESULTS_LOAD_THRESHOLD_PX = 240;

	let searchRenderCount = $state(SEARCH_RESULTS_WINDOW_MIN);
	let searchResultsSignature = $state('');

	function handleClose() {
		sidebar?.close();
	}

	function parseResultMeta(url: string | undefined) {
		let hostname = '';
		let faviconUrl = '';
		if (!url) return { hostname, faviconUrl };
		try {
			const parsedHostname = new URL(url).hostname;
			hostname = parsedHostname || url;
			faviconUrl = `https://www.google.com/s2/favicons?domain=${parsedHostname}&sz=128`;
		} catch {
			hostname = url;
		}

		return { hostname, faviconUrl };
	}

	function handleFaviconError(event: Event) {
		const target = event.currentTarget as HTMLImageElement | null;
		if (target) {
			target.style.display = 'none';
		}
	}

	function handleResultsScroll(event: Event) {
		if (!sidebar || sidebar.mode !== 'search') return;
		const target = event.currentTarget;
		if (!(target instanceof HTMLElement)) return;

		const remaining = target.scrollHeight - target.clientHeight - target.scrollTop;
		if (remaining > SEARCH_RESULTS_LOAD_THRESHOLD_PX) return;

		if (searchRenderCount < sidebar.results.length) {
			searchRenderCount = Math.min(
				sidebar.results.length,
				searchRenderCount + SEARCH_RESULTS_WINDOW_STEP
			);
		}
	}

	const parsedResults = $derived.by(() => {
		if (!sidebar) return [];
		return sidebar.results.map((result) => {
			const { hostname, faviconUrl } = parseResultMeta(result.url);
			const publishedAtDate = result.publishedAt ? new Date(result.publishedAt) : null;
			const isValidPublishedAt = !!publishedAtDate && !Number.isNaN(publishedAtDate.getTime());
			return {
				result,
				hostname,
				faviconUrl,
				publishedAtDate: isValidPublishedAt ? publishedAtDate : null
			};
		});
	});

	const visibleResults = $derived(parsedResults.slice(0, searchRenderCount));

	$effect(() => {
		if (!sidebar || sidebar.mode !== 'search') return;
		const signature = sidebar.results.map((result) => result.id).join('|');
		if (signature === searchResultsSignature) return;
		searchResultsSignature = signature;
		searchRenderCount = Math.min(SEARCH_RESULTS_WINDOW_MIN, sidebar.results.length);
	});
</script>

{#if sidebar}
	{#if sidebarContext.isMobile}
		<Sheet.Root
			open={sidebar.isOpen}
			onOpenChange={(open) => {
				if (!open) handleClose();
			}}
		>
			<Sheet.Content
				side="bottom"
				class="rounded-t-dialog flex h-[95dvh] flex-col gap-0 overflow-hidden border-0 p-0"
				hideClose={true}
			>
				<div class="flex shrink-0 items-center justify-between px-6 py-4">
					<h2 class="line-clamp-1 flex-1 text-base font-semibold select-none">
						{#if sidebar.mode === 'html'}
							{sidebar.htmlTitle || $t('chat.preview')}
						{:else if sidebar.mode === 'file'}
							{sidebar.fileName || $t('chat.preview')}
						{:else}
							{$t('chat.search_results')}
						{/if}
					</h2>
					<Button
						variant="ghost"
						size="icon"
						class="ms-2 size-8"
						onclick={handleClose}
						aria-label={$t('common.close')}
					>
						<XIcon class="size-5" />
						<span class="sr-only">{$t('common.close')}</span>
					</Button>
				</div>
				<div
					class={cn('flex-1 overflow-y-auto', {
						'px-4 py-3': sidebar.mode === 'search'
					})}
					onscroll={handleResultsScroll}
				>
					<div
						class={cn(sidebar.mode === 'search' ? 'min-h-full' : 'h-full', {
							'space-y-3': sidebar.mode === 'search'
						})}
					>
						{#if sidebar.mode === 'html'}
							{@render htmlPreview()}
						{:else if sidebar.mode === 'file'}
							{@render filePreview()}
						{:else}
							{@render resultsList()}
						{/if}
					</div>
				</div>
			</Sheet.Content>
		</Sheet.Root>
	{:else if sidebar.isOpen}
		<aside class="text-sidebar-foreground flex h-full w-full flex-col">
			<div class="flex flex-row items-center justify-between px-6 py-3">
				<h2 class="line-clamp-1 flex-1 text-base font-semibold select-none">
					{#if sidebar.mode === 'html'}
						{sidebar.htmlTitle || $t('chat.preview')}
					{:else if sidebar.mode === 'file'}
						{sidebar.fileName || $t('chat.preview')}
					{:else}
						{$t('chat.search_results')}
					{/if}
				</h2>
				<Button
					variant="ghost"
					size="icon"
					class="ms-2 size-8"
					onclick={handleClose}
					aria-label={$t('common.close')}
				>
					<XIcon class="size-5" />
					<span class="sr-only">{$t('common.close')}</span>
				</Button>
			</div>

			<div
				class={cn('flex-1 overflow-y-auto', {
					'px-4 py-3': sidebar.mode === 'search'
				})}
				onscroll={handleResultsScroll}
			>
				<div
					class={cn(sidebar.mode === 'search' ? 'min-h-full' : 'h-full', {
						'space-y-3': sidebar.mode === 'search'
					})}
				>
					{#if sidebar.mode === 'html'}
						{@render htmlPreview()}
					{:else if sidebar.mode === 'file'}
						{@render filePreview()}
					{:else}
						{@render resultsList()}
					{/if}
				</div>
			</div>
		</aside>
	{/if}
{/if}

{#snippet htmlPreview()}
	{#if sidebar && sidebar.htmlCode}
		<iframe
			title={$t('chat.html_preview')}
			srcdoc={sidebar.htmlCode}
			class="bg-sidebar h-full w-full"
			sandbox="allow-scripts"
		></iframe>
	{/if}
{/snippet}

{#snippet filePreview()}
	{#if sidebar}
		<FilePreviewContent
			name={sidebar.fileName}
			url={sidebar.fileUrl}
			contentType={sidebar.fileContentType}
			content={sidebar.fileContent}
		/>
	{/if}
{/snippet}

{#snippet resultsList()}
	{#if sidebar}
		{#if parsedResults.length === 0}
			<Empty.State class="py-10" title={$t('chat.no_search_results')} icon={SearchIcon} />
		{:else}
			{#each visibleResults as { result, hostname, faviconUrl, publishedAtDate } (result.id)}
				<a
					id={`search-result-${result.id}`}
					href={result.url ?? '#'}
					target="_blank"
					rel="noopener noreferrer"
					class="ui-focus-ring hover:bg-accent active:bg-accent/80 group rounded-interactive relative block scroll-mt-16 space-y-1 px-3 py-3 text-sm transition-colors outline-none"
				>
					<div class="flex items-start justify-between gap-3">
						<h3 class="text-foreground line-clamp-2 flex-1 text-sm leading-snug font-normal">
							{result.title}
						</h3>
					</div>

					<p class="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
						{result.snippet}
					</p>

					<div class="text-muted-foreground flex items-center gap-2 pt-1 text-xs">
						{#if result.url}
							<img
								src={faviconUrl}
								alt=""
								class="rounded-inline h-4 w-4"
								onerror={handleFaviconError}
							/>
						{/if}
						{#if hostname}
							<span class="max-w-35 truncate">
								{hostname}
							</span>
						{/if}
						{#if publishedAtDate}
							<span class="text-xs" aria-hidden="true">|</span>
							<span class="text-xs">
								{$date(publishedAtDate, {
									year: 'numeric',
									month: '2-digit',
									day: '2-digit'
								})}
							</span>
						{/if}
					</div>
				</a>
			{/each}
		{/if}
	{/if}
{/snippet}
