<script lang="ts">
	import { cn, type WithElementRef, type WithoutChildren } from '$lib/utils/shadcn';
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		'data-slot': dataSlot = 'textarea',
		...restProps
	}: WithoutChildren<WithElementRef<HTMLTextareaAttributes>> = $props();
</script>

<textarea
	bind:this={ref}
	data-slot={dataSlot}
	class={cn('input-base textarea-control field-sizing-content', className)}
	bind:value
	{...restProps}
></textarea>
