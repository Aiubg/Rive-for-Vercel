<script lang="ts">
	import { cn } from '$lib/utils/shadcn';
	import type { HTMLAttributes } from 'svelte/elements';

	let { class: className, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
	class={cn(
		'border-primary/20 border-t-primary rounded-pill size-4 animate-spin border-2',
		className
	)}
	{...restProps}
></div>
