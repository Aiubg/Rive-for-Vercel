<script lang="ts">
	import { t, locale } from 'svelte-i18n';
	import { isRTL } from '$lib/i18n';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Database from '@lucide/svelte/icons/database';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import UserRound from '@lucide/svelte/icons/user-round';
	import XIcon from '@lucide/svelte/icons/x';
	import { AlertDialog, AlertDialogContent } from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import * as Item from '$lib/components/ui/item';
	import * as Sheet from '$lib/components/ui/sheet';
	import { cn } from '$lib/utils/shadcn';
	import AppearanceSettings from '$lib/components/settings/appearance-settings.svelte';
	import DataSettings from '$lib/components/settings/data-settings.svelte';
	import PersonalizationSettings from '$lib/components/settings/personalization-settings.svelte';
	import ShareManagement from '$lib/components/settings/share-management.svelte';

	let { open = $bindable(false) } = $props();

	const sidebar = useSidebar();

	let activeTab = $state('appearance');
	let showMobileDetail = $state(false);
	let showDataSubpage = $state(false);

	const tabs = $derived([
		{
			id: 'appearance',
			label: $t('common.general'),
			icon: SettingsIcon,
			description: $t('settings.appearance_description')
		},
		{
			id: 'personalization',
			label: $t('settings.personalization'),
			icon: UserRound,
			description: $t('settings.personalization_description')
		},
		{
			id: 'data',
			label: $t('settings.data_management'),
			icon: Database,
			description: $t('settings.data_management_description')
		}
	]);

	const activeTabInfo = $derived(tabs.find((t) => t.id === activeTab) ?? tabs[0]);

	function handleClose() {
		open = false;
	}

	function handleBack() {
		showMobileDetail = false;
	}

	function handleTabSelect(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		const tabId = target?.dataset.tabId;
		if (!tabId) return;
		activeTab = tabId;
		showMobileDetail = true;
	}

	function handleTabSelectDesktop(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		const tabId = target?.dataset.tabId;
		if (!tabId) return;
		activeTab = tabId;
	}

	$effect(() => {
		if (!open) {
			const timer = setTimeout(() => {
				showMobileDetail = false;
				showDataSubpage = false;
			}, 300);
			return () => clearTimeout(timer);
		}
	});
</script>

{#if sidebar.isMobile}
	<Sheet.Root bind:open>
		<Sheet.Content
			side="bottom"
			class="rounded-t-dialog flex h-[95dvh] flex-col gap-0 overflow-hidden p-0"
			hideClose={true}
			dir={isRTL($locale) ? 'rtl' : 'ltr'}
		>
			{#if showDataSubpage}
				<ShareManagement bind:showDataSubpage bind:open />
			{:else}
				<div class="flex shrink-0 items-center justify-between px-6 py-4">
					{#if showMobileDetail}
						<div class="flex items-center gap-2">
							<Button
								variant="ghost"
								size="icon"
								class="-ms-2 size-8"
								onclick={handleBack}
								aria-label={$t('common.back')}
							>
								<ArrowLeft class="rtl-mirror size-4" />
							</Button>
							<span class="text-base font-semibold select-none">{activeTabInfo?.label}</span>
						</div>
					{:else}
						<span class="flex h-8 items-center text-base font-semibold select-none">
							{$t('common.settings')}
						</span>
					{/if}
					<Button
						variant="ghost"
						size="icon"
						class="size-8"
						onclick={handleClose}
						aria-label={$t('common.close')}
					>
						<XIcon class="size-5" />
						<span class="sr-only">{$t('common.close')}</span>
					</Button>
				</div>

				<div
					class={cn(
						'flex min-h-0 flex-1 flex-col overflow-y-auto',
						showMobileDetail ? 'p-6 pt-2' : 'px-2 pt-2 pb-4'
					)}
				>
					{#if !showMobileDetail}
						<div class="flex flex-col">
							{#each tabs as tab (tab.id)}
								<Item.Root>
									{#snippet child({ props })}
										<button
											{...props}
											type="button"
											class={cn(
												props.class as string | undefined,
												'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-start transition-colors'
											)}
											data-tab-id={tab.id}
											onclick={handleTabSelect}
										>
											<Item.Media>
												<tab.icon class="size-4" />
											</Item.Media>
											<Item.Content>
												<Item.Title>{tab.label}</Item.Title>
												<Item.Description>{tab.description}</Item.Description>
											</Item.Content>
											<Item.Actions>
												<ChevronRight class="text-muted-foreground/50 rtl-mirror size-4" />
											</Item.Actions>
										</button>
									{/snippet}
								</Item.Root>
							{/each}
						</div>
					{:else}
						<div
							class={cn(
								'animate-in fade-in transition-none duration-200',
								isRTL($locale) ? 'slide-in-from-start-4' : 'slide-in-from-end-4'
							)}
						>
							{#if activeTab === 'appearance'}
								<AppearanceSettings />
							{:else if activeTab === 'personalization'}
								<PersonalizationSettings />
							{:else}
								<DataSettings bind:showDataSubpage bind:open />
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<AlertDialog bind:open>
		<AlertDialogContent
			class="flex h-136 max-h-[95vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
			dir={isRTL($locale) ? 'rtl' : 'ltr'}
		>
			{#if showDataSubpage}
				<ShareManagement bind:showDataSubpage bind:open />
			{:else}
				<div class="flex min-h-0 flex-1">
					<div class="bg-sidebar flex w-52 shrink-0 flex-col gap-1 p-6 select-none">
						<div class="mb-4 flex h-8 items-center gap-2 px-2 text-base font-semibold">
							{$t('common.settings')}
						</div>
						{#each tabs as tab (tab.id)}
							<button
								type="button"
								class={cn(
									'ui-focus-ring rounded-control flex h-10 items-center gap-2 px-3 text-start text-sm font-medium transition-colors outline-none select-none',
									activeTab === tab.id
										? 'bg-sidebar-accent text-sidebar-accent-foreground'
										: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent/80'
								)}
								data-tab-id={tab.id}
								onclick={handleTabSelectDesktop}
							>
								<tab.icon class="size-4" />
								{tab.label}
							</button>
						{/each}
					</div>

					<div class="flex flex-1 flex-col gap-4">
						<div class="flex shrink-0 justify-end pe-6 pt-6">
							<Button
								variant="ghost"
								size="icon"
								class="size-8"
								onclick={handleClose}
								aria-label={$t('common.close')}
							>
								<XIcon class="size-5" />
								<span class="sr-only">{$t('common.close')}</span>
							</Button>
						</div>
						<div class="flex-1 overflow-y-auto px-6">
							{#if activeTab === 'appearance'}
								<AppearanceSettings />
							{:else if activeTab === 'personalization'}
								<PersonalizationSettings />
							{:else}
								<DataSettings bind:showDataSubpage bind:open />
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</AlertDialogContent>
	</AlertDialog>
{/if}
