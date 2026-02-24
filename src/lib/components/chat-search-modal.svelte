<script lang="ts">
	import { onDestroy } from 'svelte';
	import { t, date } from 'svelte-i18n';
	import Search from '@lucide/svelte/icons/search';
	import XIcon from '@lucide/svelte/icons/x';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import { AlertDialog, AlertDialogContent } from '$lib/components/ui/alert-dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import { getChatSearchContext } from '$lib/hooks/chat-search.svelte';
	import { resolve } from '$app/paths';
	import Spinner from '$lib/components/ui/spinner.svelte';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import * as Empty from '$lib/components/ui/empty';

	const chatSearch = getChatSearchContext();
	const sidebar = useSidebar();

	let inputElement = $state<HTMLInputElement | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout>;

	$effect(() => {
		if (chatSearch.isOpen) {
			setTimeout(() => {
				inputElement?.focus();
			}, 100);
		}
	});

	onDestroy(() => {
		clearTimeout(debounceTimer);
	});

	function handleInput(e: Event) {
		const q = (e.target as HTMLInputElement).value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			chatSearch.search(q);
		}, 300);
	}
</script>

{#if sidebar.isMobile}
	<Sheet.Root bind:open={chatSearch.isOpen}>
		<Sheet.Content
			side="bottom"
			class="rounded-t-dialog flex h-[95dvh] flex-col gap-0 overflow-hidden p-0"
			hideClose={true}
		>
			{@render searchContent()}
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<AlertDialog bind:open={chatSearch.isOpen}>
		<AlertDialogContent
			class="flex h-136 max-h-[95vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
		>
			{@render searchContent()}
		</AlertDialogContent>
	</AlertDialog>
{/if}

{#snippet searchContent()}
	<div class="flex items-center border-b px-4 py-3">
		<Search class="text-muted-foreground me-2 size-5" />
		<input
			bind:this={inputElement}
			class="placeholder:text-muted-foreground flex-1 bg-transparent text-base outline-none"
			placeholder={$t('chat.search_placeholder')}
			aria-label={$t('chat.search_placeholder')}
			value={chatSearch.query}
			oninput={handleInput}
		/>
		<Button
			variant="ghost"
			size="icon"
			class="size-8"
			onclick={() => chatSearch.close()}
			aria-label={$t('common.close')}
		>
			<XIcon class="size-5" />
			<span class="sr-only">{$t('common.close')}</span>
		</Button>
	</div>

	<div class="flex-1 overflow-y-auto p-2">
		{#if chatSearch.isLoading}
			<div class="flex h-full items-center justify-center">
				<Spinner class="size-8" />
			</div>
		{:else if chatSearch.error}
			<div class="text-destructive flex h-full items-center justify-center">
				{$t(chatSearch.error)}
			</div>
		{:else if chatSearch.results.length > 0}
			<div class="flex flex-col gap-1">
				{#each chatSearch.results as result (result.chatId + (result.messageId ?? ''))}
					<a
						class="ui-focus-ring hover:bg-accent active:bg-accent/80 group rounded-control flex w-full flex-col gap-1 p-3 text-start transition-colors outline-none"
						href={resolve(
							`/chat/${result.chatId}${result.messageId ? `#${result.messageId}` : ''}`
						)}
						onclick={() => chatSearch.close()}
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2 font-medium">
								<MessageSquare class="text-muted-foreground size-4" />
								<span class="truncate">{result.chatTitle}</span>
							</div>
							<span
								class="text-muted-foreground text-xs opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
							>
								{$date(result.createdAt, {
									year: 'numeric',
									month: '2-digit',
									day: '2-digit',
									hour: '2-digit',
									minute: '2-digit'
								})}
							</span>
						</div>
						<div class="text-muted-foreground line-clamp-2 text-sm">
							{result.messageSnippet || $t('chat.no_content')}
						</div>
					</a>
				{/each}
			</div>
		{:else if chatSearch.query}
			<Empty.State class="h-full" title={$t('chat.no_search_results')} icon={Search} />
		{:else}
			<Empty.State class="h-full" title={$t('chat.search_hint')} icon={Search} />
		{/if}
	</div>
{/snippet}
