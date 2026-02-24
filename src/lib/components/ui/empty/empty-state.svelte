<script lang="ts">
	import MessageCircleDashed from '@lucide/svelte/icons/message-circle-dashed';
	import { cn, type WithElementRef } from '$lib/utils/shadcn';
	import type { Component } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type IconComponent = Component<{ class?: string; size?: number; strokeWidth?: number }>;

	let {
		ref = $bindable(null),
		class: className,
		title,
		description,
		icon = MessageCircleDashed,
		iconClass,
		titleClass,
		descriptionClass,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		title: string;
		description?: string;
		icon?: IconComponent | null;
		iconClass?: string;
		titleClass?: string;
		descriptionClass?: string;
	} = $props();

	const Icon = $derived(icon);
</script>

<div
	bind:this={ref}
	data-slot="empty-state"
	class={cn('flex w-full items-center justify-center px-4 py-10', className)}
	{...restProps}
>
	<div class="flex w-full max-w-sm min-w-0 flex-col items-center gap-2 text-center">
		{#if Icon}
			<div class="text-foreground/80 flex size-6 items-center justify-center">
				<Icon class={cn('size-5', iconClass)} />
			</div>
		{/if}
		<div
			class={cn('text-foreground/80 text-base font-medium tracking-tight select-none', titleClass)}
		>
			{title}
		</div>
		{#if description}
			<div class={cn('text-muted-foreground text-sm leading-relaxed', descriptionClass)}>
				{description}
			</div>
		{/if}
		{#if children}
			<div class="mt-2 flex items-center justify-center gap-2">
				{@render children()}
			</div>
		{/if}
	</div>
</div>
