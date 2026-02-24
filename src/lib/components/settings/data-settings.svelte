<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import { t, locale } from 'svelte-i18n';
	import { isRTL } from '$lib/i18n';
	import * as Item from '$lib/components/ui/item';
	import Spinner from '$lib/components/ui/spinner.svelte';
	import { ChatHistory } from '$lib/hooks/chat-history.svelte';
	import { NewChatTrigger } from '$lib/hooks/new-chat.svelte';
	import { toast } from 'svelte-sonner';

	let { showDataSubpage = $bindable(), open = $bindable() } = $props();

	const chatHistory = ChatHistory.fromContext();
	const newChatTrigger = NewChatTrigger.fromContext();
	let deletingAll = $state(false);
	let showDeleteConfirm = $state(false);
	let exporting = $state(false);

	function handleOpenShareManagement() {
		showDataSubpage = true;
	}

	function handleShowDeleteConfirm() {
		showDeleteConfirm = true;
	}

	function getExportFilename(response: Response): string | null {
		const header = response.headers.get('content-disposition') ?? '';
		const match = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(header);
		if (!match) return null;
		const raw = match[1];
		if (!raw) return null;
		try {
			return decodeURIComponent(raw);
		} catch {
			return raw;
		}
	}

	async function exportAllChats() {
		if (exporting) return;
		exporting = true;
		try {
			const res = await fetch('/api/history/export', { method: 'GET' });
			if (!res.ok) {
				toast.error($t('settings.export_chats_failed'));
				return;
			}
			const blob = await res.blob();
			const fallbackName = `rivo-chats-${new Date().toISOString().slice(0, 10)}.json`;
			const filename = getExportFilename(res) ?? fallbackName;
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
			toast.success($t('settings.export_chats_success'));
		} catch {
			toast.error($t('settings.export_chats_failed'));
		} finally {
			exporting = false;
		}
	}

	async function deleteAllChats() {
		deletingAll = true;
		try {
			const success = await chatHistory.deleteAllChats();
			if (success) {
				toast.success($t('settings.delete_all_chats_success'));
				showDeleteConfirm = false;
				await newChatTrigger.trigger();
				open = false;
			} else {
				toast.error($t('common.unknown_error'));
			}
		} finally {
			deletingAll = false;
		}
	}
</script>

<div class="flex flex-col gap-3">
	<!-- My Shares -->
	<Item.Root size="none">
		<Item.Content>
			<Item.Title size="sm" class="select-none">{$t('settings.my_shares')}</Item.Title>
		</Item.Content>
		<Item.Actions>
			<Button
				variant="outline"
				size="sm"
				class="rounded-pill px-6"
				onclick={handleOpenShareManagement}
			>
				{$t('settings.manage')}
			</Button>
		</Item.Actions>
	</Item.Root>

	<!-- Export Chats -->
	<Item.Root size="none">
		<Item.Content class="select-none">
			<Item.Title size="sm">{$t('settings.export_chats')}</Item.Title>
			<Item.Description>{$t('settings.export_chats_description')}</Item.Description>
		</Item.Content>
		<Item.Actions>
			<Button
				variant="outline"
				size="sm"
				class="rounded-pill shrink-0 px-6"
				onclick={exportAllChats}
				disabled={exporting}
			>
				{#if exporting}
					<Spinner />
				{:else}
					{$t('chat.download')}
				{/if}
			</Button>
		</Item.Actions>
	</Item.Root>

	<!-- Delete All Chats -->
	<Item.Root size="none">
		<Item.Content class="select-none">
			<Item.Title size="sm">{$t('settings.delete_all_chats')}</Item.Title>
			<Item.Description>
				{$t('settings.delete_all_chats_confirm')}
			</Item.Description>
		</Item.Content>
		<Item.Actions>
			<Button
				variant="destructive"
				size="sm"
				class="rounded-pill shrink-0 px-6"
				onclick={handleShowDeleteConfirm}
				disabled={deletingAll}
			>
				{#if deletingAll}
					<Spinner />
				{:else}
					{$t('history.delete')}
				{/if}
			</Button>
		</Item.Actions>
	</Item.Root>
</div>

<AlertDialog bind:open={showDeleteConfirm}>
	<AlertDialogContent dir={isRTL($locale) ? 'rtl' : 'ltr'}>
		<AlertDialogHeader>
			<AlertDialogTitle>{$t('settings.delete_all_chats')}</AlertDialogTitle>
			<AlertDialogDescription>
				{$t('settings.delete_all_chats_confirm')}
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>{$t('common.cancel')}</AlertDialogCancel>
			<AlertDialogAction variant="destructive" onclick={deleteAllChats}>
				{$t('common.confirm')}
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
