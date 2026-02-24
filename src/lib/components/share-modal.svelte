<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { AlertDialog, AlertDialogContent } from '$lib/components/ui/alert-dialog';
	import { t } from 'svelte-i18n';
	import XIcon from '@lucide/svelte/icons/x';
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { toast } from 'svelte-sonner';
	import { get } from 'svelte/store';
	import { copyToClipboard } from '$lib/utils/misc';
	import Spinner from '$lib/components/ui/spinner.svelte';
	import type { Share } from '$lib/types/db';
	import { page } from '$app/state';
	import { SharesState } from '$lib/hooks/shares.svelte';

	let {
		open = $bindable(false),
		chatId
	}: {
		open: boolean;
		chatId: string;
	} = $props();

	const sharesState = SharesState.fromContext();
	let share = $state<Share | null>(null);
	let loading = $state(false);
	let copied = $state(false);

	async function loadShare() {
		if (!chatId) return;
		loading = true;
		share = await sharesState.getForChat(chatId);
		loading = false;
	}
	async function generateShare() {
		loading = true;
		share = await sharesState.generate(chatId);
		loading = false;
	}
	async function revokeShare() {
		if (!share) return;
		loading = true;
		const success = await sharesState.revoke(share.id);
		if (success) {
			share = null;
			toast.success(get(t)('share.revoked'));
		} else {
			toast.error(get(t)('share.revoke_failed'));
		}
		loading = false;
	}

	async function handleCopy() {
		if (!share) return;
		const url = `${page.url.origin}/share/${share.id}`;
		const success = await copyToClipboard(url);
		if (success) {
			copied = true;
			toast.success(get(t)('share.copied'));
			setTimeout(() => (copied = false), 2000);
		} else {
			toast.error(get(t)('share.copy_failed'));
		}
	}

	$effect(() => {
		if (open) {
			untrack(() => loadShare());
		}
	});
</script>

<AlertDialog bind:open>
	<AlertDialogContent>
		<div class="flex flex-col gap-6">
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-semibold select-none">{$t('share.title')}</h3>
				<Button
					variant="ghost"
					size="icon"
					class="size-8"
					onclick={() => (open = false)}
					aria-label={$t('common.close')}
				>
					<XIcon class="size-5" />
				</Button>
			</div>

			<p class="text-muted-foreground text-sm select-none">
				{$t('share.description')}
			</p>

			{#if loading}
				<div class="flex h-32 items-center justify-center">
					<Spinner class="size-8 border-2" />
				</div>
			{:else if share}
				<div class="flex flex-col gap-6">
					<div class="flex items-center gap-2">
						<Input
							readonly
							value="{page.url.origin}/share/{share.id}"
							class="input-xl bg-muted flex-1 border-none font-medium break-all focus-visible:ring-0 focus-visible:ring-offset-0"
							aria-label={$t('share.link')}
						/>
						<Button
							variant="secondary"
							size="icon"
							class="btn-xl w-11 shrink-0"
							onclick={handleCopy}
							aria-label={$t('chat.copy')}
						>
							{#if copied}
								<Check class="text-success size-4" />
							{:else}
								<Copy class="size-4" />
							{/if}
						</Button>
					</div>

					<div class="flex gap-3">
						<Button
							variant="outline"
							class="btn-xl flex-1"
							onclick={() => window.open(`/share/${share?.id}`, '_blank')}
						>
							<ExternalLink class="size-4" />
							{$t('share.view_link')}
						</Button>
						<Button variant="destructive" class="btn-xl flex-1" onclick={revokeShare}>
							<Trash2 class="size-4" />
							{$t('share.revoke')}
						</Button>
					</div>
				</div>
			{:else}
				<Button class="btn-xl w-full" onclick={generateShare}>
					{$t('share.generate')}
				</Button>
			{/if}
		</div>
	</AlertDialogContent>
</AlertDialog>
