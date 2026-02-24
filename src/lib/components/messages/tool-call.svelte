<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import SearchIcon from '@lucide/svelte/icons/search';
	import WandSparklesIcon from '@lucide/svelte/icons/wand-sparkles';
	import { untrack } from 'svelte';
	import { t } from 'svelte-i18n';
	import * as Item from '$lib/components/ui/item';
	import { cn } from '$lib/utils/shadcn';
	import { getSearchSidebarContext, type SearchResult } from '$lib/hooks/search-sidebar.svelte';
	import AudioPlayer from '$lib/components/messages/ui-card/audio-player.svelte';

	let {
		toolInvocation
	}: {
		toolInvocation: {
			state: 'call' | 'result';
			toolCallId: string;
			toolName: string;
			args: unknown;
			result?: unknown;
		};
	} = $props();

	const sidebar = getSearchSidebarContext();
	const isSearch = $derived(toolInvocation.toolName === 'tavily_search');
	const isUiCardTool = $derived(toolInvocation.toolName === 'ui_card');
	const loading = $derived(toolInvocation.state === 'call');

	const searchResults = $derived(
		(toolInvocation.result as { results?: SearchResult[] })?.results ?? []
	);
	const resultCount = $derived(searchResults.length);

	let expanded = $state(false);
	let loadedIcons = $state<Record<number, boolean>>({});

	function toRecord(value: unknown): Record<string, unknown> | null {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
		return value as Record<string, unknown>;
	}

	function readStringValue(record: Record<string, unknown> | null, key: string): string {
		if (!record) return '';
		const raw = record[key];
		if (typeof raw === 'string') {
			const trimmed = raw.trim();
			return trimmed;
		}
		if (typeof raw === 'number' && Number.isFinite(raw)) {
			return String(raw);
		}
		return '';
	}

	const cardResult = $derived(toRecord(toolInvocation.result));
	const playerCard = $derived(toRecord(cardResult?.card));
	const playerCardType = $derived(readStringValue(playerCard, 'type'));
	const playerAudioUrl = $derived(readStringValue(playerCard, 'audioUrl'));
	const playerTitle = $derived(readStringValue(playerCard, 'title'));
	const playerArtist = $derived(readStringValue(playerCard, 'artist'));
	const playerSourceUrl = $derived(readStringValue(playerCard, 'sourceUrl'));
	const playerCoverUrl = $derived(readStringValue(playerCard, 'coverUrl'));
	const playerDuration = $derived(readStringValue(playerCard, 'duration'));
	const uiCardError = $derived(readStringValue(cardResult, 'error'));
	const hasUiCardError = $derived(isUiCardTool && uiCardError.length > 0);

	const isCompactToolNotice = $derived(isSearch || isUiCardTool);
	const canExpandDetails = $derived(!isCompactToolNotice);

	const showMusicPlayerCard = $derived(
		isUiCardTool &&
			toolInvocation.state === 'result' &&
			playerCardType === 'audio-player' &&
			playerAudioUrl.length > 0
	);
	const showToolCallNotice = $derived(!showMusicPlayerCard);

	$effect(() => {
		if (!sidebar) return;
		if (!sidebar.isOpen || sidebar.mode !== 'search') return;
		if (!isSearch || toolInvocation.state !== 'result' || searchResults.length === 0) return;
		if (sidebar.activeToolCallId !== toolInvocation.toolCallId) return;
		if (sidebar.results === searchResults) return;

		untrack(() => {
			sidebar.open(searchResults, toolInvocation.toolCallId);
		});
	});

	function getFaviconUrl(url: string | undefined) {
		if (!url) return '';
		try {
			const hostname = new URL(url).hostname;
			return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
		} catch {
			return '';
		}
	}

	function handleFaviconError(event: Event) {
		const target = event.currentTarget as HTMLImageElement | null;
		if (target) {
			target.style.display = 'none';
		}
	}

	function handleIconLoad(id: number) {
		loadedIcons[id] = true;
	}

	function handleToolCallClick() {
		if (sidebar && isSearch && toolInvocation.state === 'result') {
			if (sidebar.isOpen && sidebar.activeToolCallId === toolInvocation.toolCallId) {
				sidebar.close();
			} else {
				sidebar.open(searchResults, toolInvocation.toolCallId);
			}
			return;
		}
		if (isUiCardTool) {
			return;
		}
		expanded = !expanded;
	}

	const argsMarkdown = $derived.by(() => {
		if (!expanded || isSearch || isUiCardTool) return '';
		if (typeof toolInvocation.args === 'string') return toolInvocation.args;
		try {
			return JSON.stringify(toolInvocation.args, null, 2);
		} catch {
			return '';
		}
	});

	const resultMarkdown = $derived.by(() => {
		if (!expanded || isSearch || isUiCardTool || toolInvocation.state !== 'result') return '';
		try {
			return JSON.stringify(toolInvocation.result, null, 2);
		} catch {
			return '';
		}
	});
</script>

<div class="flex flex-col gap-2 py-1">
	{#if showToolCallNotice}
		<button
			type="button"
			class={cn(
				'text-muted-foreground flex h-8 w-fit flex-row items-center gap-2 border-none bg-transparent p-0 text-sm transition-colors select-none',
				{ 'hover:text-foreground': !isUiCardTool, 'cursor-default': isUiCardTool }
			)}
			data-tool-call-id={toolInvocation.toolCallId}
			onclick={handleToolCallClick}
		>
			<div class="flex items-center gap-2">
				{#if isSearch}
					<SearchIcon size={16} />
				{:else if isUiCardTool}
					<WandSparklesIcon size={16} />
				{:else}
					<WrenchIcon size={16} />
				{/if}

				<span class={cn('font-medium', { 'animate-pulse': loading })}>
					{#if isSearch}
						{#if loading}
							{$t('chat.searching')}
						{:else}
							{$t('chat.searched_pages', { values: { count: resultCount } })}
						{/if}
					{:else if isUiCardTool}
						{#if loading}
							{$t('chat.generating_card')}
						{:else if hasUiCardError}
							{$t('chat.card_generation_failed')}
						{:else}
							{$t('chat.completed')}
						{/if}
					{:else}
						{$t(loading ? 'chat.calling' : 'chat.completed')}
					{/if}
				</span>

				{#if !isCompactToolNotice}
					<span class="font-medium">{toolInvocation.toolName}</span>
				{/if}

				{#if isSearch && !loading}
					<div class="ms-1 flex items-center -space-x-1">
						{#each searchResults.slice(0, 3) as res (res.id)}
							{#if res.url}
								<div
									class={cn(
										'border-background bg-muted rounded-pill flex h-4 w-4 items-center justify-center overflow-hidden border transition-opacity duration-200',
										loadedIcons[res.id] ? 'opacity-100' : 'opacity-0'
									)}
								>
									<img
										src={getFaviconUrl(res.url)}
										alt=""
										class="h-3 w-3"
										onload={() => handleIconLoad(res.id)}
										onerror={handleFaviconError}
									/>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>

			{#if canExpandDetails}
				<div class="flex items-center gap-1">
					{#if expanded}
						<ChevronDownIcon size={14} class="text-muted-foreground shrink-0" />
					{:else}
						<ChevronRightIcon size={14} class="text-muted-foreground rtl-mirror shrink-0" />
					{/if}
				</div>
			{/if}
		</button>
	{/if}

	{#if showMusicPlayerCard}
		<div class="mt-2 w-full max-w-2xl">
			<AudioPlayer
				audioUrl={playerAudioUrl}
				title={playerTitle}
				artist={playerArtist}
				coverUrl={playerCoverUrl}
				sourceUrl={playerSourceUrl}
				duration={playerDuration}
			/>
		</div>
	{/if}

	{#if expanded && canExpandDetails}
		<div class="text-muted-foreground ms-2 mt-4 mb-2 flex flex-col gap-4 border-s ps-4 text-sm">
			<Item.Root size="none">
				<Item.Content class="gap-1">
					<Item.Title class="text-xs font-semibold uppercase select-none">
						{$t('chat.tool_arguments')}
					</Item.Title>
					<div class="bidi-plaintext text-start break-all whitespace-pre-wrap">
						{argsMarkdown}
					</div>
				</Item.Content>
			</Item.Root>

			{#if toolInvocation.state === 'result'}
				<Item.Root size="none">
					<Item.Content class="gap-1">
						<Item.Title class="text-xs font-semibold uppercase select-none">
							{$t('chat.tool_result')}
						</Item.Title>
						<div class="bidi-plaintext text-start break-all whitespace-pre-wrap">
							{resultMarkdown}
						</div>
					</Item.Content>
				</Item.Root>
			{/if}
		</div>
	{/if}
</div>
