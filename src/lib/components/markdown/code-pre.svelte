<script lang="ts">
	import { cn } from '$lib/utils/shadcn';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
	import ZoomOutIcon from '@lucide/svelte/icons/zoom-out';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import PlayIcon from '@lucide/svelte/icons/play';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import { Button } from '$lib/components/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import type { Component, Snippet } from 'svelte';
	import { observePreForHighlight } from '$lib/utils/code';
	import { copyToClipboard } from '$lib/utils/misc';
	import { t } from 'svelte-i18n';
	import { getSearchSidebarContext } from '$lib/hooks/search-sidebar.svelte';

	let {
		class: className,
		children,
		streaming = false,
		...rest
	}: {
		class?: string;
		children?: Snippet;
		streaming?: boolean;
	} = $props();

	const sidebar = getSearchSidebarContext();
	let preEl = $state<HTMLPreElement | null>(null);
	type MermaidExports = {
		zoomIn: () => void;
		zoomOut: () => void;
		resetZoom: () => void;
		downloadSvg: (filename?: string) => void;
		downloadPng: (filename?: string, minScale?: number) => void;
	};
	let MermaidComponent = $state<Component<{ code: string }, MermaidExports> | null>(null);
	let mermaidRef = $state<MermaidExports | null>(null);
	let lang = $state<string>('Text');
	let codeContent = $state<string>('');
	let copied = $state(false);
	let activeTab = $state<'chart' | 'code'>('chart');

	let isMermaid = $derived(lang.toLowerCase() === 'mermaid');

	$effect(() => {
		if (!isMermaid || MermaidComponent) return;
		void (async () => {
			const mod = await import('$lib/components/markdown/mermaid.svelte');
			MermaidComponent = mod.default;
		})();
	});

	$effect(() => {
		if (!preEl) return;
		const stop = observePreForHighlight(preEl, (l, c) => {
			lang = l;
			codeContent = c;
		});
		return () => {
			stop?.();
		};
	});

	async function handleCopy() {
		const codeEl = preEl?.querySelector('code');
		const text = codeEl?.textContent ?? '';
		const ok = await copyToClipboard(text);
		if (!ok) return;
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	function handleDownload(extensionOverride?: string, filenamePrefix = 'code') {
		const codeEl = preEl?.querySelector('code');
		const text = codeEl?.textContent ?? '';
		if (!text) return;
		const blob = new Blob([text], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		const extension =
			extensionOverride ?? (lang.toLowerCase() === 'text' ? 'txt' : lang.toLowerCase());
		a.href = url;
		a.download = `${filenamePrefix}-${Date.now()}.${extension}`;
		a.rel = 'noopener';
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
</script>

<div class="markdown-code-block rounded-surface relative my-6 w-full">
	<div
		class="markdown-code-header rounded-t-surface flex items-center justify-between px-4 py-2 text-xs"
	>
		<div class="flex items-center gap-2">
			{#if isMermaid}
				<div class="bg-accent rounded-surface flex items-center gap-1 p-1">
					<button
						type="button"
						class={cn(
							'tab-trigger rounded-surface p-2 text-xs leading-none',
							activeTab === 'chart' ? 'bg-background text-foreground' : 'hover:bg-background/50'
						)}
						onclick={() => (activeTab = 'chart')}
					>
						{$t('chat.chart')}
					</button>
					<button
						type="button"
						class={cn(
							'tab-trigger rounded-surface p-2 text-xs leading-none',
							activeTab === 'code' ? 'bg-background text-foreground' : 'hover:bg-background/50'
						)}
						onclick={() => (activeTab = 'code')}
					>
						{$t('chat.code')}
					</button>
				</div>
			{:else}
				<span class="bg-primary/20 rounded-pill size-2"></span>
				<span class="font-mono font-medium tracking-wider uppercase opacity-70">{lang}</span>
			{/if}
		</div>
		<div class="flex items-center">
			{#if isMermaid && activeTab === 'chart'}
				<Button
					variant="ghost"
					size="sm"
					class="text-muted-foreground hover:text-foreground px-2 transition-colors"
					onclick={() => mermaidRef?.zoomIn()}
					aria-label={$t('chat.zoom_in')}
					disabled={streaming}
				>
					<ZoomInIcon size={14} />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					class="text-muted-foreground hover:text-foreground px-2 transition-colors"
					onclick={() => mermaidRef?.zoomOut()}
					aria-label={$t('chat.zoom_out')}
					disabled={streaming}
				>
					<ZoomOutIcon size={14} />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					class="text-muted-foreground hover:text-foreground px-2 transition-colors"
					onclick={() => mermaidRef?.resetZoom()}
					aria-label={$t('chat.reset_zoom')}
					disabled={streaming}
				>
					<RotateCcwIcon size={14} />
				</Button>

				<div class="bg-muted-foreground/30 mx-2 h-3 w-px"></div>
			{/if}

			<Button
				variant="ghost"
				size="sm"
				class="text-muted-foreground hover:text-foreground gap-1 px-2 transition-colors"
				onclick={handleCopy}
				disabled={streaming}
			>
				{#if copied}
					<CheckIcon size={14} />
				{:else}
					<CopyIcon size={14} />
				{/if}
				<span class="text-xs">{$t('chat.copy')}</span>
			</Button>

			{#if isMermaid}
				<DropdownMenu>
					<DropdownMenuTrigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="sm"
								class="text-muted-foreground hover:text-foreground gap-1 px-2 transition-colors"
								disabled={streaming}
							>
								<DownloadIcon size={14} />
								<span class="text-xs">{$t('chat.download')}</span>
							</Button>
						{/snippet}
					</DropdownMenuTrigger>
					<DropdownMenuContent side="bottom" align="end" class="min-w-32">
						<DropdownMenuItem
							class="cursor-pointer"
							disabled={!mermaidRef || streaming}
							onSelect={() => mermaidRef?.downloadSvg()}
						>
							<span>{$t('chat.download_svg')}</span>
						</DropdownMenuItem>
						<DropdownMenuItem
							class="cursor-pointer"
							disabled={!mermaidRef || streaming}
							onSelect={() => mermaidRef?.downloadPng()}
						>
							<span>{$t('chat.download_png')}</span>
						</DropdownMenuItem>
						<DropdownMenuItem
							class="cursor-pointer"
							disabled={streaming}
							onSelect={() => handleDownload('mmd', 'mermaid')}
						>
							<span>{$t('chat.download_code')}</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			{:else}
				<Button
					variant="ghost"
					size="sm"
					class="text-muted-foreground hover:text-foreground gap-1 px-2 transition-colors"
					onclick={() => handleDownload()}
					disabled={streaming}
				>
					<DownloadIcon size={14} />
					<span class="text-xs">{$t('chat.download')}</span>
				</Button>
			{/if}

			{#if lang.toLowerCase() === 'html'}
				<div class="bg-muted-foreground/30 mx-2 h-3 w-px"></div>
				<Button
					variant="ghost"
					size="sm"
					class="text-muted-foreground hover:text-foreground gap-1 px-2 transition-colors"
					onclick={() => sidebar?.openHtml(codeContent)}
					disabled={streaming}
				>
					<PlayIcon size={14} />
					<span class="text-xs">{$t('chat.run')}</span>
				</Button>
			{/if}
		</div>
	</div>
	{#if isMermaid}
		<div class="overflow-hidden">
			<div class={cn(activeTab !== 'chart' && 'hidden')}>
				{#if MermaidComponent}
					<MermaidComponent bind:this={mermaidRef} code={codeContent} />
				{:else}
					<div class="flex-center p-8">
						<div
							class="border-primary rounded-pill h-8 w-8 animate-spin border-4 border-t-transparent"
						></div>
					</div>
				{/if}
			</div>
			<pre
				bind:this={preEl}
				class={cn(
					'hljs rounded-b-surface w-full overflow-x-auto border-0 bg-transparent px-4 py-4 text-sm leading-relaxed',
					activeTab !== 'code' && 'hidden',
					className
				)}>{@render children?.()}</pre>
		</div>
	{:else}
		<pre
			bind:this={preEl}
			{...rest}
			class={cn(
				'hljs rounded-surface w-full overflow-x-auto border-0 bg-transparent px-4 py-4 text-sm leading-relaxed',
				className
			)}>{@render children?.()}</pre>
	{/if}
</div>
