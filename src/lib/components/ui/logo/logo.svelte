<script lang="ts">
	import LogoIcon from '$lib/components/ui/logo/logo-icon.svelte';
	import { cn } from '$lib/utils/shadcn';

	let {
		size = 24,
		color,
		class: className,
		...restProps
	}: {
		size?: number;
		color?: string;
		class?: string;
		[key: string]: unknown;
	} = $props();
</script>

<div class={cn('inline-flex items-center justify-center select-none', className)} {...restProps}>
	<LogoIcon {size} {color} />
</div>
