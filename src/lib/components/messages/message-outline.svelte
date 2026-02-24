<script lang="ts">
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { UIMessageWithTree } from '$lib/types/message';
	import { getMessagePreviewText } from '$lib/utils/chat';
	import { t } from 'svelte-i18n';
	import {
		Tooltip,
		TooltipContent,
		TooltipTrigger,
		TooltipProvider
	} from '$lib/components/ui/tooltip';

	let {
		messages,
		activeMessageId,
		onnavigate
	}: {
		messages: UIMessageWithTree[];
		activeMessageId: string | null;
		onnavigate: (id: string) => void;
	} = $props();

	const activeIndex = $derived(messages.findIndex((m) => m.id === activeMessageId));

	function handleNavigate(id: string) {
		onnavigate(id);
	}

	function navigatePrevious() {
		if (activeIndex > 0) {
			const prev = messages[activeIndex - 1];
			if (prev) {
				handleNavigate(prev.id);
				return;
			}
		}
		if (messages.length > 0) {
			const first = messages[0];
			if (first) {
				handleNavigate(first.id);
			}
		}
	}

	function navigateNext() {
		if (activeIndex < messages.length - 1) {
			const next = messages[activeIndex + 1];
			if (next) {
				handleNavigate(next.id);
				return;
			}
		}
		if (messages.length > 0) {
			const last = messages[messages.length - 1];
			if (last) {
				handleNavigate(last.id);
			}
		}
	}
</script>

<div class="group flex flex-col items-center gap-1">
	<TooltipProvider delayDuration={0}>
		<Tooltip>
			<TooltipTrigger>
				{#snippet child({ props })}
					<button
						{...props}
						class="ui-focus-ring text-foreground/60 hover:bg-accent hover:text-foreground active:bg-accent/80 rounded-pill inline-flex h-8 w-8 translate-y-1 cursor-pointer items-center justify-center border border-transparent p-2 opacity-0! transition-all duration-200 outline-none select-none group-hover:translate-y-0 group-hover:opacity-100! disabled:cursor-not-allowed disabled:opacity-40"
						type="button"
						aria-label={$t('common.previous_message')}
						onclick={navigatePrevious}
						disabled={activeIndex <= 0}
					>
						<ChevronUp size={16} />
					</button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent side="left" sideOffset={12}>{$t('common.previous')}</TooltipContent>
		</Tooltip>

		<div class="group/timeline flex flex-col items-end gap-0">
			{#each messages as message (message.id)}
				{@const isActive = message.id === activeMessageId}
				<Tooltip>
					<TooltipTrigger>
						<button
							class="ui-focus-ring group/timeline-tick relative flex h-3 w-10 cursor-pointer items-center justify-end px-2 transition-colors duration-100 outline-none select-none disabled:cursor-not-allowed disabled:opacity-60"
							type="button"
							aria-label={$t('common.go_to_message')}
							onclick={() => handleNavigate(message.id)}
						>
							<div
								class="rounded-pill h-px transition-all duration-150
                                    {isActive
									? 'bg-primary w-5 opacity-100'
									: `bg-muted-foreground/30 ${message.role === 'assistant' ? 'w-3' : 'w-2'} group-hover/timeline-tick:bg-primary opacity-100 group-hover/timeline:opacity-100 group-hover/timeline-tick:w-5 group-hover/timeline-tick:opacity-100`}
                                    {isActive ? 'group-hover/timeline-tick:bg-primary!' : ''}"
							></div>
						</button>
					</TooltipTrigger>
					<TooltipContent side="left" class="max-w-xs px-3 py-2">
						<p class="line-clamp-3 text-xs whitespace-pre-wrap">
							{getMessagePreviewText(message) || '...'}
						</p>
					</TooltipContent>
				</Tooltip>
			{/each}
		</div>

		<Tooltip>
			<TooltipTrigger>
				{#snippet child({ props })}
					<button
						{...props}
						class="ui-focus-ring text-foreground/60 hover:bg-accent hover:text-foreground active:bg-accent/80 rounded-pill inline-flex h-8 w-8 -translate-y-1 cursor-pointer items-center justify-center border border-transparent p-2 opacity-0! transition-all duration-200 outline-none select-none group-hover:translate-y-0 group-hover:opacity-100! disabled:cursor-not-allowed disabled:opacity-40"
						type="button"
						aria-label={$t('common.next_message')}
						onclick={navigateNext}
						disabled={activeIndex >= messages.length - 1}
					>
						<ChevronDown size={16} />
					</button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent side="left" sideOffset={12}>{$t('common.next')}</TooltipContent>
		</Tooltip>
	</TooltipProvider>
</div>
