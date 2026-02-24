<script lang="ts">
	import * as InputGroup from '$lib/components/ui/input-group';
	import Spinner from '$lib/components/ui/spinner.svelte';
	import StopIcon from '@lucide/svelte/icons/square';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import { t } from 'svelte-i18n';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';

	let {
		status = 'idle',
		canSend = false,
		onsend,
		onstop
	}: {
		status?: 'idle' | 'submitting' | 'streaming';
		canSend: boolean;
		onsend: () => void;
		onstop: () => void;
	} = $props();
</script>

{#if status === 'submitting'}
	<Tooltip>
		<TooltipTrigger>
			{#snippet child({ props })}
				<InputGroup.Button
					{...props}
					size="icon-sm"
					variant="default"
					class="rounded-pill border disabled:opacity-100"
					aria-label={$t('chat.stop_output')}
					onclick={(event) => {
						event.preventDefault();
						onstop();
					}}
					disabled={true}
				>
					<Spinner class="border-primary-foreground/35 border-t-primary-foreground size-4" />
				</InputGroup.Button>
			{/snippet}
		</TooltipTrigger>
		<TooltipContent>
			{$t('chat.stop_output')}
		</TooltipContent>
	</Tooltip>
{:else if status === 'streaming'}
	<Tooltip>
		<TooltipTrigger>
			{#snippet child({ props })}
				<InputGroup.Button
					{...props}
					size="icon-sm"
					variant="default"
					class="rounded-pill border"
					aria-label={$t('chat.stop_output')}
					onclick={(event) => {
						event.preventDefault();
						onstop();
					}}
				>
					<StopIcon size={14} fill="currentColor" />
				</InputGroup.Button>
			{/snippet}
		</TooltipTrigger>
		<TooltipContent>
			{$t('chat.stop_output')}
		</TooltipContent>
	</Tooltip>
{:else if canSend}
	<InputGroup.Button
		size="icon-sm"
		variant="default"
		class="rounded-pill border"
		aria-label={$t('chat.send_message')}
		onclick={(event) => {
			event.preventDefault();
			onsend();
		}}
	>
		<ArrowUpIcon size={14} class="rtl-mirror" />
	</InputGroup.Button>
{:else}
	<Tooltip>
		<TooltipTrigger>
			{#snippet child({ props })}
				<span {...props} class="inline-flex" aria-disabled="true">
					<InputGroup.Button
						size="icon-sm"
						variant="default"
						class="rounded-pill border"
						aria-label={$t('chat.enter_question')}
						onclick={(event) => {
							event.preventDefault();
						}}
						disabled={true}
					>
						<ArrowUpIcon size={14} class="rtl-mirror" />
					</InputGroup.Button>
				</span>
			{/snippet}
		</TooltipTrigger>
		<TooltipContent>
			{$t('chat.enter_question')}
		</TooltipContent>
	</Tooltip>
{/if}
