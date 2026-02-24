<script lang="ts">
	import { cn, type WithElementRef, type WithoutChildren } from '$lib/utils/shadcn';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="skeleton"
	class={cn('bg-muted/50 rounded-interactive relative overflow-hidden select-none', className)}
	{...restProps}
>
	<div class="animate-shimmer absolute inset-0 -translate-x-full"></div>
</div>
