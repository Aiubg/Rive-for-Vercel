<script lang="ts">
	import { cn } from '$lib/utils/shadcn';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		...props
	}: ComponentProps<typeof Textarea> = $props();
</script>

<Textarea
	bind:ref
	data-slot="input-group-control"
	class={cn(
		'rounded-square shadow-flat flex-1 resize-none border-0 bg-transparent pt-3 pb-0 group-has-[>[data-align=block-end]]/input-group:flex-none group-has-[>[data-align=block-start]]/input-group:flex-none focus-visible:ring-0 dark:bg-transparent',
		className
	)}
	bind:value
	{...props}
/>
