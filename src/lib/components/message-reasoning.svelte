<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import AtomIcon from '@lucide/svelte/icons/atom';
	import { cn } from '$lib/utils/shadcn';
	import { Markdown } from '$lib/components/markdown';
	import { t } from 'svelte-i18n';
	import ToolCall from '$lib/components/messages/tool-call.svelte';
	import type { MessagePart } from '$lib/types/message';

	let {
		reasoning,
		parts = [],
		loading = false
	}: {
		reasoning?: string;
		parts?: MessagePart[];
		loading?: boolean;
	} = $props();
	let expanded = $state(true);

	const displayParts = $derived(
		parts.length > 0 ? parts : reasoning ? [{ type: 'reasoning', text: reasoning }] : []
	);

	$effect(() => {
		if (loading) {
			expanded = true;
		}
	});

	function toggleExpanded() {
		expanded = !expanded;
	}
</script>

<div class="flex flex-col">
	<div class="bg-background/95 sticky top-0 z-10 w-full backdrop-blur-sm">
		<button
			type="button"
			class="hover:text-foreground text-muted-foreground flex h-8 w-fit cursor-pointer flex-row items-center gap-2 border-none bg-transparent p-0 text-sm transition-colors select-none"
			aria-expanded={expanded}
			onclick={toggleExpanded}
		>
			<div class="flex items-center gap-2">
				<AtomIcon size={16} />
				<div
					class={cn('font-medium', {
						'animate-pulse': loading
					})}
				>
					{$t(loading ? 'chat.reasoning' : 'chat.reasoned')}
				</div>
			</div>
			{#if expanded}
				<ChevronDownIcon size={16} class="transition-transform" />
			{:else}
				<ChevronRightIcon size={16} class="rtl-mirror transition-transform" />
			{/if}
		</button>
	</div>

	{#if expanded}
		<div
			class="text-muted-foreground bidi-plaintext [&_.markdown-body]:text-muted-foreground ms-2 mt-4 mb-2 flex flex-col gap-4 border-s ps-4 text-start [&_.markdown-body]:text-sm"
		>
			{#each displayParts as p, i (`${p.type}-${p.toolCallId ?? p.toolInvocation?.toolCallId ?? i}`)}
				{#if p.type === 'reasoning'}
					<Markdown md={p.text ?? ''} streaming={loading} />
				{:else if p.type === 'dynamic-tool'}
					<ToolCall
						toolInvocation={{
							state: p.state === 'output-available' ? 'result' : 'call',
							toolCallId: p.toolCallId ?? '',
							toolName: p.toolName ?? '',
							args: p.input,
							result: p.output
						}}
					/>
				{:else if p.type === 'tool-invocation'}
					<ToolCall
						toolInvocation={p.toolInvocation ?? {
							state: 'call',
							toolCallId: '',
							toolName: '',
							args: undefined,
							result: undefined
						}}
					/>
				{/if}
			{/each}
		</div>
	{/if}
</div>
