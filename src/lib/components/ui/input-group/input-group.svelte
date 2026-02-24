<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils/shadcn';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="input-group"
	role="group"
	class={cn(
		'group/input-group rounded-control input-group-control relative flex w-full items-center outline-none',
		'has-[>textarea]:h-auto',
		'has-[>[data-align=inline-start]]:[&>input]:ps-2',
		'has-[>[data-align=inline-end]]:[&>input]:pe-2',
		'has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3',
		'has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3',
		className
	)}
	{...props}
>
	{@render children?.()}
</div>
