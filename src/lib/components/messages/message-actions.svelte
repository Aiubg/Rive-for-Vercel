<script lang="ts">
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import { Button } from '$lib/components/ui/button';
	import PencilEditIcon from '@lucide/svelte/icons/pencil';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import VersionSwitcher from '$lib/components/messages/version-switcher.svelte';
	import { cn } from '$lib/utils/shadcn';
	import { t } from 'svelte-i18n';
	import type { UIMessageWithTree } from '$lib/types/message';

	let {
		message,
		readonly,
		loading,
		copiedIndex,
		totalVersions = 1,
		currentIndex = 0,
		oncopy,
		onedit,
		onregenerate,
		onswitchversion
	}: {
		message: UIMessageWithTree;
		readonly: boolean;
		loading: boolean;
		copiedIndex: number | null;
		totalVersions?: number;
		currentIndex?: number;
		oncopy: () => void;
		onedit: () => void;
		onregenerate: () => void;
		onswitchversion?: (index: number) => void;
	} = $props();
</script>

<div class="mt-1 flex flex-row items-start gap-2">
	<div
		class={cn('flex w-full items-center gap-2', {
			'flex-row-reverse': message.role === 'user',
			'justify-start': message.role === 'assistant'
		})}
	>
		{#if totalVersions > 1 && onswitchversion}
			<VersionSwitcher {currentIndex} total={totalVersions} onchange={onswitchversion} />
		{/if}
		{#if message.role === 'user' && !readonly}
			<Tooltip>
				<TooltipTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon-sm"
							class="text-muted-foreground"
							onclick={onedit}
							aria-label={$t('chat.edit')}
						>
							<PencilEditIcon size={16} />
							<span class="sr-only">{$t('chat.edit')}</span>
						</Button>
					{/snippet}
				</TooltipTrigger>
				<TooltipContent>{$t('chat.edit')}</TooltipContent>
			</Tooltip>
		{/if}
		<Tooltip>
			<TooltipTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon-sm"
						class="text-muted-foreground"
						onclick={oncopy}
						aria-label={$t('chat.copy')}
					>
						{#if copiedIndex === 999}
							<CheckIcon size={16} />
						{:else}
							<CopyIcon size={16} />
						{/if}
						<span class="sr-only">{$t('chat.copy')}</span>
					</Button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent>{$t('chat.copy')}</TooltipContent>
		</Tooltip>
		{#if message.role === 'assistant' && !readonly}
			<Tooltip>
				<TooltipTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon-sm"
							class="text-muted-foreground"
							disabled={loading}
							onclick={onregenerate}
							aria-label={$t('chat.regenerate')}
						>
							<RefreshCwIcon size={16} />
							<span class="sr-only">{$t('chat.regenerate')}</span>
						</Button>
					{/snippet}
				</TooltipTrigger>
				<TooltipContent>{$t('chat.regenerate')}</TooltipContent>
			</Tooltip>
		{/if}
	</div>
</div>
