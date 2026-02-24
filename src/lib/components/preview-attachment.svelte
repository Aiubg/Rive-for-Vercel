<script lang="ts">
	import type { Attachment } from '$lib/types/attachment';
	import Spinner from '$lib/components/ui/spinner.svelte';
	import { Button } from '$lib/components/ui/button';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import FileIcon from '@lucide/svelte/icons/file';
	import XIcon from '@lucide/svelte/icons/x';
	import { getSearchSidebarContext } from '$lib/hooks/search-sidebar.svelte';
	import { cn } from '$lib/utils/shadcn';
	import { t } from 'svelte-i18n';

	let {
		attachment,
		uploading = false,
		onremove
	}: {
		attachment: Attachment;
		uploading?: boolean;
		onremove?: () => void;
	} = $props();

	const sidebar = getSearchSidebarContext();
	const { name, url, contentType, size, content } = $derived(attachment);
	const isImageAttachment = $derived.by(() => {
		if (contentType?.startsWith('image/')) return true;
		if (!name) return false;
		return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name);
	});

	const isParsing = $derived(
		!uploading && content === undefined && contentType !== undefined && !isImageAttachment
	);

	const sizeDisplay = $derived.by(() => {
		if (size === undefined) return '';
		if (size < 1024) return `${size} B`;
		if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
		return `${(size / (1024 * 1024)).toFixed(1)} MB`;
	});

	const typeDisplay = $derived.by(() => {
		if (!name) return '';
		const ext = name.split('.').pop()?.toUpperCase();
		return ext ?? '';
	});

	const canPreview = $derived.by(() => {
		if (uploading || !name) return false;
		if (isImageAttachment) return url.length > 0;
		return content !== undefined;
	});

	function handleMainClick() {
		if (!canPreview || name === undefined) return;
		const shouldToggleClose =
			sidebar?.isOpen &&
			sidebar.mode === 'file' &&
			((sidebar.fileUrl && sidebar.fileUrl === url) || sidebar.fileName === name);
		if (shouldToggleClose) {
			sidebar.close();
		} else {
			sidebar?.openFile({
				name,
				content: isImageAttachment ? null : (content ?? null),
				url,
				contentType: contentType ?? null
			});
		}
	}
</script>

<div class="group bg-card rounded-interactive relative flex w-52 max-w-full border">
	<button
		type="button"
		class={cn(
			'ui-focus-ring rounded-interactive flex w-full min-w-0 items-center gap-2 p-2 text-left transition-all outline-none',
			onremove ? 'pe-10' : '',
			canPreview ? 'hover:bg-accent/50 active:bg-accent/70 cursor-pointer' : 'cursor-default'
		)}
		onclick={handleMainClick}
		disabled={!canPreview}
		aria-label={name ? `${$t('chat.preview')}: ${name}` : $t('chat.preview')}
	>
		<div class="rounded-control flex h-8 w-8 shrink-0 flex-col items-center justify-center">
			{#if uploading || isParsing}
				<Spinner class="text-muted-foreground size-4" />
			{:else if isImageAttachment}
				<img
					src={url}
					alt={name ?? $t('common.image_attachment')}
					class="rounded-control size-full object-cover"
				/>
			{:else if contentType === 'text/plain'}
				<FileTextIcon class="text-primary size-5" />
			{:else}
				<FileIcon class="text-primary size-5" />
			{/if}
		</div>

		<div class="flex flex-1 flex-col overflow-hidden">
			<div class="text-foreground truncate text-sm font-medium select-none">
				{name}
			</div>
			<div
				class="text-muted-foreground flex min-w-0 flex-row items-center gap-1 text-xs whitespace-nowrap select-none"
			>
				{#if uploading}
					<span class="truncate">{$t('common.uploading')}...</span>
				{:else if isParsing}
					<span class="truncate">{$t('common.loading')}</span>
				{:else}
					{#if typeDisplay}
						<span class="shrink-0 font-semibold uppercase">{typeDisplay}</span>
						<span class="bg-muted-foreground/30 h-2 w-px shrink-0"></span>
					{/if}
					<span class="truncate">{sizeDisplay}</span>
				{/if}
			</div>
		</div>
	</button>

	{#if onremove}
		<Button
			variant="ghost"
			size="icon-sm"
			class="text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:bg-destructive/20 absolute end-1 top-1/2 z-10 -translate-y-1/2 scale-100 transition-all focus-visible:scale-100 md:scale-0 md:group-focus-within:scale-100 md:group-hover:scale-100"
			onclick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onremove();
			}}
			aria-label={$t('common.remove_attachment')}
		>
			<XIcon class="size-5" />
		</Button>
	{/if}
</div>
