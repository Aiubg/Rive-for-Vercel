<script lang="ts">
	import SharedChat from '$lib/components/shared-chat.svelte';
	import { convertToUIMessages } from '$lib/utils/chat';
	import Logo from '$lib/components/ui/logo/logo.svelte';
	import { resolve } from '$app/paths';
	import { setSearchSidebarContext } from '$lib/hooks/search-sidebar.svelte';
	import SearchResultsSidebar from '$lib/components/search-results-sidebar.svelte';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import * as Resizable from '$lib/components/ui/resizable';
	import { t } from 'svelte-i18n';
	import ModelSelector from '$lib/components/model-selector.svelte';

	let { data } = $props();

	const sidebarContext = useSidebar();
	const sidebar = setSearchSidebarContext();

	let paneGroup = $state<import('paneforge').PaneGroup>();
</script>

{#snippet SearchSidebarContent()}
	<SearchResultsSidebar />
{/snippet}

<div class="flex h-full w-full overflow-hidden">
	<Resizable.PaneGroup direction="horizontal" autoSaveId="rivo-share-sidebar-layout" bind:paneGroup>
		<Resizable.Pane defaultSize={70} minSize={30}>
			<div class="flex h-full flex-col">
				<div class="bg-background sticky top-0 z-10 p-2">
					<div class="relative flex h-10 flex-row items-center justify-between">
						<ModelSelector class="max-w-[min(45vw,16rem)] px-1" />
						<a
							href={resolve('/')}
							class="ui-focus-ring ui-focus-ring-sidebar hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-control inline-flex shrink-0 items-center justify-center transition-colors outline-none select-none"
							aria-label={$t('common.go_to_home')}
						>
							<Logo size={30} class="p-1" />
						</a>
					</div>
				</div>
				<div class="flex-1 overflow-hidden">
					<SharedChat initialMessages={convertToUIMessages(data.messages)} />
				</div>
			</div>
		</Resizable.Pane>

		{#if !sidebarContext.isMobile && sidebar.isOpen}
			<Resizable.Handle
				ondblclick={() => {
					paneGroup?.setLayout([70, 30]);
				}}
			/>
			<Resizable.Pane defaultSize={30} minSize={20} maxSize={60}>
				{@render SearchSidebarContent()}
			</Resizable.Pane>
		{/if}
	</Resizable.PaneGroup>
</div>

{#if sidebarContext.isMobile}
	{@render SearchSidebarContent()}
{/if}
