<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { get } from 'svelte/store';
	import { t, date } from 'svelte-i18n';
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils/shadcn';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Resizable from '$lib/components/ui/resizable';
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
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import * as Empty from '$lib/components/ui/empty';
	import Spinner from '$lib/components/ui/spinner.svelte';
	import FilePreviewContent from '$lib/components/file-preview-content.svelte';
	import SidebarToggle from '$lib/components/sidebar-toggle.svelte';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import FileIcon from '@lucide/svelte/icons/file';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import ListFilterIcon from '@lucide/svelte/icons/list-filter';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XIcon from '@lucide/svelte/icons/x';
	import type { Component } from 'svelte';
	import {
		deleteStoredFile,
		fetchFilePreview,
		fetchStoredFiles,
		renameStoredFile,
		uploadStoredFile
	} from '$lib/services/files-api';
	import type { PageData } from './$types';

	type ManagedFile = {
		url: string;
		storedName: string;
		originalName: string;
		contentType: string;
		size: number;
		lastModified: number;
		uploadedAt: number;
		hash?: string;
		previewContent?: string | null;
		previewLoading?: boolean;
	};

	type FileTypeFilter = 'text' | 'image' | 'office';
	type SortMode = 'size' | 'name' | 'created';

	let { data }: { data: PageData } = $props();

	function getFileNameFromUrl(url: string): string {
		if (!url.startsWith('/uploads/')) return url;
		return url.slice('/uploads/'.length);
	}

	function getExt(name: string): string {
		const idx = name.lastIndexOf('.');
		return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
	}

	function splitFileName(name: string): { baseName: string; extension: string } {
		const idx = name.lastIndexOf('.');
		if (idx <= 0 || idx === name.length - 1) {
			return { baseName: name, extension: '' };
		}
		return { baseName: name.slice(0, idx), extension: name.slice(idx) };
	}

	function isTextPreviewSupported(file: ManagedFile): boolean {
		if (file.contentType.startsWith('text/')) return true;
		if (file.contentType === 'application/json') return true;
		if (file.contentType === 'application/javascript') return true;
		const ext = getExt(file.originalName || file.storedName);
		return ext === 'docx' || ext === 'xlsx';
	}

	function formatDateTime(value: number): string {
		return get(date)(new Date(value), {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function toManagedFile(file: PageData['files'][number]): ManagedFile {
		return {
			...file,
			previewContent: undefined,
			previewLoading: false
		};
	}

	function normalizeFilesWithPreviewState(
		rawFiles: ReadonlyArray<PageData['files'][number]>
	): ManagedFile[] {
		return rawFiles.map(toManagedFile);
	}

	const initialFiles = untrack(() => normalizeFilesWithPreviewState(data.files));
	let files = $state<ManagedFile[]>(initialFiles);
	let selectedUrl = $state<string | null>(null);
	let uploadInputRef = $state<HTMLInputElement | null>(null);
	let uploading = $state(false);
	let refreshing = $state(false);
	let activeFilter = $state<FileTypeFilter | null>(null);
	let sortMode = $state<SortMode>('name');
	let deleteDialogOpen = $state(false);
	let fileToDelete = $state<ManagedFile | null>(null);
	let renameDialogOpen = $state(false);
	let fileToRename = $state<ManagedFile | null>(null);
	let renameValue = $state('');
	let renameExtension = $state('');
	let renameInputRef = $state<HTMLInputElement | null>(null);
	let openFileMenuUrl = $state<string | null>(null);
	let paneGroup = $state<import('paneforge').PaneGroup>();
	const sidebar = useSidebar();
	const sidebarExpanded = $derived(sidebar.isMobile ? sidebar.openMobile : sidebar.open);

	const selectedFile = $derived(files.find((file) => file.url === selectedUrl) ?? null);
	const visibleFiles = $derived.by(() => {
		const filtered = files.filter((file) => {
			if (activeFilter === null) return true;
			if (activeFilter === 'text') {
				return (
					file.contentType.startsWith('text/') ||
					file.contentType === 'application/json' ||
					file.contentType === 'application/javascript'
				);
			}
			if (activeFilter === 'image') {
				return file.contentType.startsWith('image/');
			}
			return (
				file.contentType ===
					'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
				file.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			);
		});

		filtered.sort((a, b) => {
			if (sortMode === 'name') {
				return a.originalName.localeCompare(b.originalName, undefined, { sensitivity: 'base' });
			}
			if (sortMode === 'size') {
				return b.size - a.size;
			}
			return b.uploadedAt - a.uploadedAt;
		});
		return filtered;
	});

	function patchFile(url: string, patch: Partial<ManagedFile>) {
		files = files.map((file) => (file.url === url ? { ...file, ...patch } : file));
	}

	async function refreshFiles() {
		refreshing = true;
		try {
			files = normalizeFilesWithPreviewState((await fetchStoredFiles()) as PageData['files']);
		} catch (e) {
			const message = e instanceof Error ? e.message : 'upload.failed';
			toast.error(get(t)(message.includes('.') ? message : 'upload.failed'));
		} finally {
			refreshing = false;
		}
	}

	async function uploadFile(file: File): Promise<ManagedFile | null> {
		let data: Awaited<ReturnType<typeof uploadStoredFile>>;
		try {
			data = await uploadStoredFile(file);
		} catch (e) {
			const message = e instanceof Error ? e.message : 'upload.failed';
			toast.error(get(t)(message.includes('.') ? message : 'upload.failed'));
			return null;
		}
		if (
			!data ||
			typeof data.url !== 'string' ||
			typeof data.pathname !== 'string' ||
			typeof data.contentType !== 'string'
		) {
			toast.error(get(t)('upload.invalid_response'));
			return null;
		}

		return {
			url: data.url,
			storedName: getFileNameFromUrl(data.url),
			originalName: data.pathname,
			contentType: data.contentType,
			size: typeof data.size === 'number' ? data.size : file.size,
			lastModified: typeof data.lastModified === 'number' ? data.lastModified : file.lastModified,
			uploadedAt: Date.now(),
			hash: typeof data.hash === 'string' ? data.hash : undefined,
			previewContent: typeof data.content === 'string' ? data.content : undefined,
			previewLoading: false
		};
	}

	async function handleUploadChange(event: Event & { currentTarget: HTMLInputElement }) {
		const selectedFiles = Array.from(event.currentTarget.files ?? []);
		event.currentTarget.value = '';
		if (selectedFiles.length === 0) return;

		uploading = true;
		try {
			const uploaded = await Promise.all(selectedFiles.map((file) => uploadFile(file)));
			const successful = uploaded.filter((file): file is ManagedFile => file !== null);
			if (successful.length === 0) return;

			const nextFiles = [...files];
			for (const file of successful) {
				const index = nextFiles.findIndex((existing) => existing.url === file.url);
				if (index === -1) {
					nextFiles.unshift(file);
				} else {
					nextFiles[index] = { ...nextFiles[index], ...file };
				}
			}
			files = nextFiles;
			toast.success(get(t)('files.upload_success'));
		} finally {
			uploading = false;
		}
	}

	async function handleDelete(file: ManagedFile) {
		try {
			await deleteStoredFile(file.url);
			files = files.filter((item) => item.url !== file.url);
			toast.success(get(t)('files.delete_success'));
		} catch (e) {
			const message = e instanceof Error ? e.message : 'upload.delete_failed';
			toast.error(get(t)(message.includes('.') ? message : 'upload.delete_failed'));
		}
	}

	function requestDelete(file: ManagedFile) {
		openFileMenuUrl = null;
		fileToDelete = file;
		deleteDialogOpen = true;
	}

	function requestRename(file: ManagedFile) {
		openFileMenuUrl = null;
		const { baseName, extension } = splitFileName(file.originalName);
		fileToRename = file;
		renameValue = baseName;
		renameExtension = extension;
		renameDialogOpen = true;
	}

	async function confirmDelete() {
		if (!fileToDelete) return;
		await handleDelete(fileToDelete);
		deleteDialogOpen = false;
		fileToDelete = null;
	}

	async function confirmRename() {
		if (!fileToRename) return;
		const nextBaseName = renameValue.trim();
		if (!nextBaseName) return;
		const nextName = `${nextBaseName}${renameExtension}`;

		try {
			await renameStoredFile(fileToRename.url, nextName);
			files = files.map((file) =>
				file.url === fileToRename?.url ? { ...file, originalName: nextName } : file
			);
			toast.success(get(t)('files.rename_success'));
			renameDialogOpen = false;
			fileToRename = null;
		} catch {
			toast.error(get(t)('files.rename_failed'));
		}
	}

	async function focusRenameInput() {
		await tick();
		if (!renameDialogOpen) return;
		renameInputRef?.focus();
		renameInputRef?.select();
	}

	async function loadPreview(file: ManagedFile) {
		if (file.previewLoading || file.previewContent !== undefined) return;
		if (!isTextPreviewSupported(file)) {
			patchFile(file.url, { previewContent: null, previewLoading: false });
			return;
		}

		patchFile(file.url, { previewLoading: true });
		try {
			const data = await fetchFilePreview(file.url);
			patchFile(file.url, {
				previewContent: data.content,
				previewLoading: false
			});
		} catch (e) {
			const message = e instanceof Error ? e.message : 'upload.failed';
			toast.error(get(t)(message.includes('.') ? message : 'upload.failed'));
			patchFile(file.url, { previewContent: null, previewLoading: false });
		}
	}

	async function copySelectedFileContent() {
		const file = selectedFile;
		if (!file || file.previewLoading) return;

		try {
			if (file.previewContent === undefined && isTextPreviewSupported(file)) {
				await loadPreview(file);
			}

			const currentFile = files.find((item) => item.url === file.url) ?? file;
			if (typeof currentFile.previewContent !== 'string') {
				toast.error(get(t)('files.preview_not_supported'));
				return;
			}

			await navigator.clipboard.writeText(currentFile.previewContent);
			toast.success(get(t)('files.copy_content_success'));
		} catch {
			toast.error(get(t)('common.request_failed'));
		}
	}

	function downloadSelectedFile() {
		const file = selectedFile;
		if (!file) return;

		const link = document.createElement('a');
		link.href = file.url;
		link.download = file.originalName;
		link.rel = 'noopener noreferrer';
		document.body.appendChild(link);
		link.click();
		link.remove();
	}

	function closeSelectedPreview() {
		selectedUrl = null;
	}

	function clearFilter(event: Event) {
		event.preventDefault();
		event.stopPropagation();
		activeFilter = null;
	}

	$effect(() => {
		if (visibleFiles.length === 0) {
			selectedUrl = null;
			return;
		}
		if (selectedUrl && !visibleFiles.some((file) => file.url === selectedUrl)) {
			selectedUrl = null;
		}
	});

	$effect(() => {
		const file = selectedFile;
		if (!file) return;
		if (file.previewLoading || file.previewContent !== undefined) return;
		void loadPreview(file);
	});

	$effect(() => {
		if (!deleteDialogOpen) {
			fileToDelete = null;
		}
	});

	$effect(() => {
		if (!renameDialogOpen) {
			fileToRename = null;
			renameExtension = '';
			openFileMenuUrl = null;
			return;
		}

		void focusRenameInput();
	});
</script>

<input
	type="file"
	class="sr-only"
	bind:this={uploadInputRef}
	multiple
	onchange={handleUploadChange}
	accept="text/*,application/json,application/javascript,.py,.ts,.tsx,.jsx,.md,.yaml,.yml,.toml,.txt,.docx,.xlsx"
/>

{#snippet filesListPanel()}
	{#snippet SelectableMenuItem({
		label,
		selected,
		onSelect
	}: {
		label: string;
		selected: boolean;
		onSelect: () => void;
	})}
		<DropdownMenuItem onclick={onSelect}>
			<span class="flex-1">{label}</span>
			{#if selected}
				<CheckIcon size={14} />
			{/if}
		</DropdownMenuItem>
	{/snippet}

	<div class="flex h-full min-h-0 flex-col overflow-hidden">
		<div class="flex min-h-10 flex-row items-center justify-between p-2">
			<div class="inline-flex items-center gap-1 p-2">
				{#if sidebar.isMobile || !sidebarExpanded}
					<SidebarToggle />
				{/if}
				<h1 class="text-base font-semibold select-none">{$t('files.title')}</h1>
			</div>
			<div class="flex items-center gap-1">
				<Tooltip>
					<TooltipTrigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="icon-sm"
								onclick={refreshFiles}
								disabled={refreshing || uploading}
								aria-label={$t('files.refresh')}
							>
								{#if refreshing}
									<Spinner class="size-4" />
								{:else}
									<RefreshCwIcon size={16} />
								{/if}
							</Button>
						{/snippet}
					</TooltipTrigger>
					<TooltipContent>{$t('files.refresh')}</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="icon-sm"
								onclick={() => uploadInputRef?.click()}
								disabled={uploading}
								aria-label={$t('files.upload')}
							>
								{#if uploading}
									<Spinner class="size-4" />
								{:else}
									<PlusIcon size={16} />
								{/if}
							</Button>
						{/snippet}
					</TooltipTrigger>
					<TooltipContent>{$t('files.upload')}</TooltipContent>
				</Tooltip>
			</div>
		</div>
		<div class="flex items-center gap-2 px-2 pb-2">
			<div class="flex items-center gap-1">
				<div
					class="ui-border-control bg-background rounded-pill inline-flex h-8 w-fit items-center overflow-hidden"
				>
					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<button
									{...props}
									type="button"
									class={cn(
										'ui-focus-ring hover:bg-accent hover:text-accent-foreground inline-flex h-8 shrink-0 items-center gap-2 text-sm font-medium transition-colors outline-none',
										activeFilter ? 'rounded-s-pill ps-3 pe-2' : 'rounded-pill px-3'
									)}
									aria-label={$t('files.filter')}
								>
									<ListFilterIcon size={14} />
									<span class="select-none">
										{activeFilter ? $t(`files.filter_${activeFilter}`) : $t('files.filter')}
									</span>
								</button>
							{/snippet}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" class="min-w-36">
							{@render SelectableMenuItem({
								label: $t('files.filter_text'),
								selected: activeFilter === 'text',
								onSelect: () => (activeFilter = 'text')
							})}
							{@render SelectableMenuItem({
								label: $t('files.filter_image'),
								selected: activeFilter === 'image',
								onSelect: () => (activeFilter = 'image')
							})}
							{@render SelectableMenuItem({
								label: $t('files.filter_office'),
								selected: activeFilter === 'office',
								onSelect: () => (activeFilter = 'office')
							})}
						</DropdownMenuContent>
					</DropdownMenu>
					{#if activeFilter !== null}
						<div class="bg-border h-4 w-px shrink-0"></div>
						<button
							type="button"
							class="ui-focus-ring hover:bg-accent hover:text-accent-foreground rounded-e-pill flex h-full shrink-0 items-center justify-center px-2 transition-colors outline-none"
							aria-label={$t('files.clear_filter')}
							onpointerdown={clearFilter}
							onclick={clearFilter}
						>
							<XIcon size={12} />
						</button>
					{/if}
				</div>
			</div>

			<DropdownMenu>
				<DropdownMenuTrigger>
					{#snippet child({ props })}
						<Button {...props} variant="outline" size="sm" class="rounded-pill h-8 px-3">
							<ArrowUpDownIcon size={14} />
							<span>{$t('files.sort')}</span>
						</Button>
					{/snippet}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" class="min-w-36">
					{@render SelectableMenuItem({
						label: $t('files.sort_size'),
						selected: sortMode === 'size',
						onSelect: () => (sortMode = 'size')
					})}
					{@render SelectableMenuItem({
						label: $t('files.sort_name'),
						selected: sortMode === 'name',
						onSelect: () => (sortMode = 'name')
					})}
					{@render SelectableMenuItem({
						label: $t('files.sort_created'),
						selected: sortMode === 'created',
						onSelect: () => (sortMode = 'created')
					})}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
		{#if files.length === 0}
			<Empty.State class="flex-1" title={$t('files.no_files')} icon={FileIcon} />
		{:else if visibleFiles.length === 0}
			<Empty.State class="flex-1" title={$t('files.no_filtered_files')} icon={ListFilterIcon} />
		{:else}
			<div class="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
				{#each visibleFiles as file (file.url)}
					<div class="group/item relative">
						<button
							type="button"
							class="ui-focus-ring hover:bg-muted data-[active=true]:bg-muted rounded-interactive flex w-full min-w-0 flex-col items-start gap-1 px-3 py-2 pe-10 text-left outline-none"
							onclick={() => {
								selectedUrl = file.url;
							}}
							data-active={file.url === selectedUrl}
						>
							<div class="text-foreground w-full truncate text-sm font-medium">
								{file.originalName}
							</div>
							<div class="text-muted-foreground flex items-center gap-1 text-xs">
								<span>{formatBytes(file.size)}</span>
								<span>|</span>
								<span>{formatDateTime(file.lastModified)}</span>
							</div>
						</button>
						<DropdownMenu
							open={openFileMenuUrl === file.url}
							onOpenChange={(open) => {
								openFileMenuUrl = open ? file.url : null;
							}}
						>
							<DropdownMenuTrigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="ghost"
										size="icon-sm"
										class="text-muted-foreground absolute top-1/2 right-1 -translate-y-1/2 opacity-100 transition-opacity data-[state=open]:opacity-100 md:opacity-0 md:group-hover/item:opacity-100"
										aria-label={$t('history.more')}
									>
										<MoreHorizontalIcon size={16} />
									</Button>
								{/snippet}
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" side="bottom">
								<DropdownMenuItem
									onclick={(event) => {
										event.preventDefault();
										event.stopPropagation();
										requestRename(file);
									}}
								>
									<PencilIcon size={16} />
									<span>{$t('files.rename')}</span>
								</DropdownMenuItem>
								<DropdownMenuItem
									variant="destructive"
									onclick={(event) => {
										event.preventDefault();
										event.stopPropagation();
										requestDelete(file);
									}}
								>
									<Trash2Icon size={16} />
									<span>{$t('files.delete')}</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet filePreviewPanel()}
	{#if selectedFile}
		{#snippet PreviewActionButton({
			label,
			onClick,
			disabled = false,
			Icon
		}: {
			label: string;
			onClick: () => void;
			disabled?: boolean;
			Icon: Component<{ size?: number }>;
		})}
			<Tooltip>
				<TooltipTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon-sm"
							onclick={onClick}
							{disabled}
							aria-label={label}
						>
							<Icon size={14} />
						</Button>
					{/snippet}
				</TooltipTrigger>
				<TooltipContent>{label}</TooltipContent>
			</Tooltip>
		{/snippet}

		<div class="flex h-full min-h-0 flex-col">
			<div class="flex items-center justify-between gap-3 px-4 py-3">
				<div class="flex min-w-0 items-center gap-2">
					<FileIcon size={16} class="shrink-0" />
					<div class="min-w-0">
						<div class="truncate text-sm font-medium">{selectedFile.originalName}</div>
					</div>
				</div>
				<div class="flex items-center gap-1">
					{@render PreviewActionButton({
						label: $t('common.copy'),
						onClick: copySelectedFileContent,
						disabled: selectedFile.previewLoading,
						Icon: CopyIcon
					})}
					{@render PreviewActionButton({
						label: $t('common.download'),
						onClick: downloadSelectedFile,
						Icon: DownloadIcon
					})}
					{@render PreviewActionButton({
						label: $t('common.close'),
						onClick: closeSelectedPreview,
						Icon: XIcon
					})}
				</div>
			</div>
			<FilePreviewContent
				name={selectedFile.originalName}
				url={selectedFile.url}
				contentType={selectedFile.contentType}
				content={selectedFile.previewContent ?? null}
				loading={selectedFile.previewLoading}
			/>
		</div>
	{/if}
{/snippet}

<div class="flex h-full w-full overflow-hidden">
	{#if sidebar.isMobile}
		<div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
			{@render filesListPanel()}
		</div>
		<Sheet.Root
			open={!!selectedFile}
			onOpenChange={(open) => {
				if (!open) closeSelectedPreview();
			}}
		>
			<Sheet.Content
				side="bottom"
				class="rounded-t-dialog flex h-[95dvh] flex-col gap-0 overflow-hidden border-0 p-0"
				hideClose={true}
			>
				{@render filePreviewPanel()}
			</Sheet.Content>
		</Sheet.Root>
	{:else}
		<Resizable.PaneGroup direction="horizontal" autoSaveId="rivo-files-layout" bind:paneGroup>
			<Resizable.Pane defaultSize={28} minSize={18} maxSize={45}>
				{@render filesListPanel()}
			</Resizable.Pane>

			<Resizable.Handle
				ondblclick={() => {
					paneGroup?.setLayout([28, 72]);
				}}
			/>

			<Resizable.Pane defaultSize={72} minSize={40}>
				<div class="bg-background h-full min-h-0 overflow-hidden">
					{#if !selectedFile}
						<Empty.State class="h-full" title={$t('files.preview_placeholder')} icon={FileIcon} />
					{:else}
						{@render filePreviewPanel()}
					{/if}
				</div>
			</Resizable.Pane>
		</Resizable.PaneGroup>
	{/if}
</div>

<AlertDialog bind:open={deleteDialogOpen}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>{$t('files.delete')}</AlertDialogTitle>
			<AlertDialogDescription>
				{$t('files.delete_confirm')}
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel
				onclick={() => {
					fileToDelete = null;
				}}>{$t('common.cancel')}</AlertDialogCancel
			>
			<AlertDialogAction variant="destructive" onclick={confirmDelete}
				>{$t('common.confirm')}</AlertDialogAction
			>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

<AlertDialog bind:open={renameDialogOpen}>
	<AlertDialogContent
		onOpenAutoFocus={(event) => {
			event.preventDefault();
			void focusRenameInput();
		}}
	>
		<AlertDialogHeader>
			<AlertDialogTitle>{$t('files.rename')}</AlertDialogTitle>
		</AlertDialogHeader>
		<div>
			<div class="flex items-center gap-1">
				<Input
					placeholder={$t('files.rename_placeholder')}
					bind:value={renameValue}
					bind:ref={renameInputRef}
					autofocus
					aria-label={$t('files.rename')}
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							void confirmRename();
						}
					}}
				/>
				{#if renameExtension}
					<span class="text-muted-foreground rounded-control border px-3 py-2 text-sm select-none">
						{renameExtension}
					</span>
				{/if}
			</div>
		</div>
		<AlertDialogFooter>
			<AlertDialogCancel
				onclick={() => {
					fileToRename = null;
				}}>{$t('common.cancel')}</AlertDialogCancel
			>
			<AlertDialogAction onclick={confirmRename}>{$t('common.confirm')}</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
