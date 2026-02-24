<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import * as InputGroup from '$lib/components/ui/input-group';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSub,
		DropdownMenuSubContent,
		DropdownMenuSubTrigger,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import Spinner from '$lib/components/ui/spinner.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import FileClockIcon from '@lucide/svelte/icons/file-clock';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import { t } from '$lib/i18n';
	import { modelSupportsVision } from '$lib/ai/model-registry';
	import { SelectedModel } from '$lib/hooks/selected-model.svelte';
	import { get } from 'svelte/store';
	import { toast } from 'svelte-sonner';
	import type { Attachment } from '$lib/types/attachment';
	import { SvelteMap } from 'svelte/reactivity';
	import { IsMobile } from '$lib/hooks/is-mobile.svelte';
	import {
		fetchFilePreview,
		fetchStoredFiles,
		type StoredUploadFile
	} from '$lib/services/files-api';

	let {
		disabled = false,
		onchange,
		onselectrecent
	}: {
		disabled?: boolean;
		onchange: (files: File[]) => void;
		onselectrecent: (attachment: Attachment) => void;
	} = $props();

	let fileInputRef = $state<HTMLInputElement | null>(null);
	let menuOpen = $state(false);
	let recentMenuOpen = $state(false);
	let mobileRecentView = $state(false);
	let loadingRecent = $state(false);
	let selectingRecentUrl = $state<string | null>(null);
	let recentFiles = $state<StoredUploadFile[]>([]);
	let recentFetchedAt = $state(0);
	const recentPreviewCache = new SvelteMap<string, string | null>();
	const isMobileViewport = new IsMobile();
	const isMobile = $derived(isMobileViewport.current);
	const selectedChatModel = SelectedModel.fromContext();
	const supportsVisionInput = $derived(modelSupportsVision(selectedChatModel.value));
	const BASE_FILE_ACCEPT =
		'text/*,application/json,application/javascript,.py,.ts,.tsx,.jsx,.md,.yaml,.yml,.toml,.txt,.docx,.xlsx';
	const IMAGE_FILE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml';
	const fileInputAccept = $derived(
		supportsVisionInput ? `${BASE_FILE_ACCEPT},${IMAGE_FILE_ACCEPT}` : BASE_FILE_ACCEPT
	);
	const RECENT_FILES_LIMIT = 8;
	const RECENT_FILES_TTL_MS = 15_000;

	function isImageFile(file: File): boolean {
		return (
			file.type.toLowerCase().startsWith('image/') ||
			/\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name)
		);
	}

	async function handleFileChange(event: Event & { currentTarget: HTMLInputElement }) {
		const files = Array.from(event.currentTarget.files || []);
		const imageFiles = files.filter((file) => isImageFile(file));
		const blockedByVision = !supportsVisionInput && imageFiles.length > 0;
		if (blockedByVision) {
			toast.error(get(t)('models.vision_not_supported'));
		}
		const acceptedFiles = blockedByVision ? files.filter((file) => !isImageFile(file)) : files;
		if (acceptedFiles.length > 0) {
			onchange(acceptedFiles);
		}

		// Reset input so the same file can be selected again
		event.currentTarget.value = '';
	}

	async function loadRecentFiles(force = false) {
		const now = Date.now();
		const canUseCached = !force && now - recentFetchedAt < RECENT_FILES_TTL_MS;
		if (loadingRecent || canUseCached) return;

		loadingRecent = true;
		try {
			const files = await fetchStoredFiles();
			recentFiles = files.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, RECENT_FILES_LIMIT);
			recentFetchedAt = now;
		} catch (e) {
			const message = e instanceof Error ? e.message : 'upload.failed';
			toast.error(get(t)(message.includes('.') ? message : 'upload.failed'));
		} finally {
			loadingRecent = false;
		}
	}

	async function resolveAttachmentContent(file: StoredUploadFile): Promise<string | null> {
		if (recentPreviewCache.has(file.url)) {
			return recentPreviewCache.get(file.url) ?? null;
		}

		try {
			const payload = await fetchFilePreview(file.url);
			recentPreviewCache.set(file.url, payload.content);
			return payload.content;
		} catch (e) {
			const message = e instanceof Error ? e.message : 'upload.failed';
			toast.error(get(t)(message.includes('.') ? message : 'upload.failed'));
			return null;
		}
	}

	async function handleSelectRecentFile(file: StoredUploadFile) {
		if (disabled || selectingRecentUrl) return;
		if (!supportsVisionInput && file.contentType.startsWith('image/')) {
			toast.error(get(t)('models.vision_not_supported'));
			return;
		}

		selectingRecentUrl = file.url;
		try {
			const attachment: Attachment = {
				url: file.url,
				name: file.originalName,
				contentType: file.contentType,
				size: file.size,
				hash: file.hash,
				lastModified: file.lastModified
			};

			if (!file.contentType.startsWith('image/')) {
				const content = await resolveAttachmentContent(file);
				if (content === null) return;
				attachment.content = content;
			}

			onselectrecent(attachment);
			menuOpen = false;
		} catch {
			toast.error(get(t)('upload.failed'));
		} finally {
			selectingRecentUrl = null;
		}
	}

	$effect(() => {
		if (menuOpen && (recentMenuOpen || (isMobile && mobileRecentView))) {
			void loadRecentFiles();
		}
	});

	$effect(() => {
		if (!menuOpen) {
			recentMenuOpen = false;
			mobileRecentView = false;
		}
	});
</script>

<Input
	type="file"
	class="sr-only"
	bind:ref={fileInputRef}
	multiple
	onchange={handleFileChange}
	tabindex={-1}
	accept={fileInputAccept}
/>

<DropdownMenu bind:open={menuOpen}>
	<DropdownMenuTrigger>
		{#snippet child({ props })}
			<InputGroup.Button
				{...props}
				class="text-foreground"
				{disabled}
				variant="ghost"
				aria-label={$t('chat.upload_attachment')}
				size="icon-sm"
			>
				<PlusIcon class="size-6" strokeWidth={1.5} />
			</InputGroup.Button>
		{/snippet}
	</DropdownMenuTrigger>

	<DropdownMenuContent align="start" side="top" class="w-64 p-2">
		{#if isMobile}
			{#if mobileRecentView}
				<button
					type="button"
					class="rounded-interactive hover:bg-accent hover:text-accent-foreground inline-flex w-full items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
					onclick={() => {
						mobileRecentView = false;
					}}
				>
					<ArrowLeftIcon class="size-4 shrink-0" />
					<span>{$t('common.back')}</span>
				</button>

				<div class="mt-1 max-h-60 overflow-y-auto">
					{#if loadingRecent}
						<div class="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
							<Spinner class="size-4" />
							<span>{$t('common.loading')}</span>
						</div>
					{:else if recentFiles.length === 0}
						<div class="text-muted-foreground px-3 py-2 text-sm">{$t('files.no_files')}</div>
					{:else}
						{#each recentFiles as file (file.url)}
							<button
								type="button"
								class="rounded-interactive hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition-colors disabled:opacity-50"
								disabled={disabled ||
									selectingRecentUrl !== null ||
									(!supportsVisionInput && file.contentType.startsWith('image/'))}
								onclick={() => {
									void handleSelectRecentFile(file);
								}}
							>
								<FileTextIcon class="size-4 shrink-0" />
								<span class="min-w-0 flex-1 truncate">{file.originalName}</span>
								{#if selectingRecentUrl === file.url}
									<Spinner class="size-4" />
								{/if}
							</button>
						{/each}
					{/if}
				</div>
			{:else}
				<DropdownMenuItem
					{disabled}
					class="items-center"
					onclick={(event) => {
						event.preventDefault();
						fileInputRef?.click();
						menuOpen = false;
					}}
				>
					<UploadIcon class="size-4 shrink-0" />
					<div class="min-w-0 flex-1">
						<div class="truncate text-sm font-medium">{$t('files.upload')}</div>
						<div class="text-muted-foreground truncate text-xs">
							{$t('chat.upload_attachment_hint')}
						</div>
					</div>
				</DropdownMenuItem>

				<DropdownMenuItem
					{disabled}
					class="items-center"
					onclick={(event) => {
						event.preventDefault();
						mobileRecentView = true;
					}}
				>
					<FileClockIcon class="size-4 shrink-0" />
					<div class="min-w-0 flex-1">
						<div class="truncate text-sm font-medium">{$t('chat.recent_files')}</div>
						<div class="text-muted-foreground truncate text-xs">
							{$t('chat.recent_files_hint')}
						</div>
					</div>
					<ChevronRightIcon class="ml-auto size-4 shrink-0" />
				</DropdownMenuItem>
			{/if}
		{:else}
			<DropdownMenuItem
				{disabled}
				class="items-center"
				onclick={(event) => {
					event.preventDefault();
					fileInputRef?.click();
					menuOpen = false;
				}}
			>
				<UploadIcon class="size-4 shrink-0" />
				<div class="min-w-0 flex-1">
					<div class="truncate text-sm font-medium">{$t('files.upload')}</div>
					<div class="text-muted-foreground truncate text-xs">
						{$t('chat.upload_attachment_hint')}
					</div>
				</div>
			</DropdownMenuItem>

			<DropdownMenuSub bind:open={recentMenuOpen}>
				<DropdownMenuSubTrigger {disabled} class="items-center">
					<FileClockIcon class="size-4 shrink-0" />
					<div class="min-w-0 flex-1">
						<div class="truncate text-sm font-medium">{$t('chat.recent_files')}</div>
						<div class="text-muted-foreground truncate text-xs">{$t('chat.recent_files_hint')}</div>
					</div>
					<ChevronRightIcon class="ml-auto size-4 shrink-0" />
				</DropdownMenuSubTrigger>

				<DropdownMenuSubContent class="w-72 p-2">
					{#if loadingRecent}
						<div class="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
							<Spinner class="size-4" />
							<span>{$t('common.loading')}</span>
						</div>
					{:else if recentFiles.length === 0}
						<div class="text-muted-foreground px-3 py-2 text-sm">{$t('files.no_files')}</div>
					{:else}
						{#each recentFiles as file (file.url)}
							<DropdownMenuItem
								disabled={disabled ||
									selectingRecentUrl !== null ||
									(!supportsVisionInput && file.contentType.startsWith('image/'))}
								onclick={(event) => {
									event.preventDefault();
									void handleSelectRecentFile(file);
								}}
							>
								<FileTextIcon class="size-4 shrink-0" />
								<span class="min-w-0 flex-1 truncate">{file.originalName}</span>
								{#if selectingRecentUrl === file.url}
									<Spinner class="size-4" />
								{/if}
							</DropdownMenuItem>
						{/each}
					{/if}
				</DropdownMenuSubContent>
			</DropdownMenuSub>
		{/if}
	</DropdownMenuContent>
</DropdownMenu>
