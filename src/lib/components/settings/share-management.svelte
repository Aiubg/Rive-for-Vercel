<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import * as Item from '$lib/components/ui/item';
	import { t, date, locale, isRTL } from '$lib/i18n';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { get } from 'svelte/store';
	import { copyToClipboard } from '$lib/utils/misc';
	import { SharesState } from '$lib/hooks/shares.svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import XIcon from '@lucide/svelte/icons/x';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Copy from '@lucide/svelte/icons/copy';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Spinner from '$lib/components/ui/spinner.svelte';
	import * as Empty from '$lib/components/ui/empty';

	let { showDataSubpage = $bindable(), open = $bindable() } = $props();

	const sharesState = SharesState.fromContext();

	async function revokeShare(shareId: string) {
		const success = await sharesState.revoke(shareId);
		if (success) {
			toast.success(get(t)('share.revoked'));
		} else {
			toast.error(get(t)('share.revoke_failed'));
		}
	}

	async function handleCopyShare(shareId: string) {
		const url = `${page.url.origin}/share/${shareId}`;
		const success = await copyToClipboard(url);
		if (success) {
			toast.success(get(t)('share.copied'));
		} else {
			toast.error(get(t)('share.copy_failed'));
		}
	}

	function handleBack() {
		showDataSubpage = false;
	}

	function handleClose() {
		open = false;
	}

	async function handleCopyClick(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		const shareId = target?.dataset.shareId;
		if (!shareId) return;
		await handleCopyShare(shareId);
	}

	function handleRevokeClick(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		const shareId = target?.dataset.shareId;
		if (!shareId) return;
		void revokeShare(shareId);
	}

	onMount(() => {
		void sharesState.load();
	});
</script>

<div class="flex h-full min-h-0 flex-col">
	<div class="flex shrink-0 items-center justify-between px-6 py-4">
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
			<span class="text-base font-semibold select-none">{$t('share.manage_shares')}</span>
		</div>
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
	<div class="flex-1 overflow-y-auto px-6 pt-2 pb-6">
		<div class="flex min-h-full flex-col">
			{#if sharesState.loading}
				<div class="flex flex-1 items-center justify-center">
					<Spinner class="size-6 border-2" />
				</div>
			{:else if sharesState.shares.length === 0}
				<Empty.State class="flex-1" title={$t('share.no_shares')} icon={Link2} />
			{:else}
				<div class="flex flex-col">
					{#each sharesState.shares as share (share.id)}
						<Item.Root class="px-3 py-2">
							<Item.Content>
								<Item.Title>
									<a
										href={`/share/${share.id}`}
										target="_blank"
										rel="noreferrer"
										class="focus-visible:ring-ring ring-offset-background inline-flex w-fit underline-offset-4 hover:underline hover:decoration-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
									>
										{share.chat.title}
									</a>
								</Item.Title>
								<Item.Description>
									{$date(new Date(share.createdAt), {
										year: 'numeric',
										month: '2-digit',
										day: '2-digit',
										hour: '2-digit',
										minute: '2-digit',
										hour12: false
									})}
								</Item.Description>
							</Item.Content>
							<Item.Actions>
								<Tooltip>
									<TooltipTrigger>
										{#snippet child({ props })}
											<Button
												{...props}
												variant="ghost"
												size="icon"
												class="size-7"
												data-share-id={share.id}
												onclick={handleCopyClick}
												aria-label={$t('share.copy')}
											>
												<Copy class="size-4" />
											</Button>
										{/snippet}
									</TooltipTrigger>
									<TooltipContent dir={isRTL($locale) ? 'rtl' : 'ltr'}>
										{$t('share.copy')}
									</TooltipContent>
								</Tooltip>

								<Tooltip>
									<TooltipTrigger>
										{#snippet child({ props })}
											<Button
												{...props}
												variant="ghost"
												size="icon"
												class="text-destructive hover:text-destructive size-7"
												data-share-id={share.id}
												onclick={handleRevokeClick}
												aria-label={$t('history.delete')}
											>
												<Trash2 class="size-4" />
											</Button>
										{/snippet}
									</TooltipTrigger>
									<TooltipContent dir={isRTL($locale) ? 'rtl' : 'ltr'}>
										{$t('history.delete')}
									</TooltipContent>
								</Tooltip>
							</Item.Actions>
						</Item.Root>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
