<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils/shadcn';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="empty-description"
	class={cn(
		'text-muted-foreground/80 [&>a:hover]:text-primary text-base leading-relaxed [&>a]:underline [&>a]:underline-offset-4',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
