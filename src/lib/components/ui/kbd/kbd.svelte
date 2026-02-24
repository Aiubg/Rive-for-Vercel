<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils/shadcn';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<kbd
	bind:this={ref}
	data-slot="kbd"
	class={cn(
		'bg-muted/50 text-muted-foreground border-border/50 rounded-control pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 border px-1 font-sans text-xs font-medium select-none',
		"[&_svg:not([class*='size-'])]:size-3",
		'in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background dark:in-data-[slot=tooltip-content]:bg-background/10',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</kbd>
