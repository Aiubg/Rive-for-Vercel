<script lang="ts">
	import { cn } from '$lib/utils/shadcn';
	import type { HTMLAttributes } from 'svelte/elements';

	let { class: className, children, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class={cn('flex shrink-0 items-center justify-center', className)} {...restProps}>
	{@render children?.()}
</div>
