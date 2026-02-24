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
	data-slot="alert-dialog-footer"
	class={cn('flex flex-row justify-end gap-3 pt-2', className)}
	{...restProps}
>
	{@render children?.()}
</div>
