<script lang="ts">
	import { Dialog as SheetPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/shadcn';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: SheetPrimitive.TitleProps = $props();
</script>

<SheetPrimitive.Title
	bind:ref
	class={cn('text-foreground text-lg font-semibold', className)}
	{...restProps}
>
	{@render children?.()}
</SheetPrimitive.Title>
