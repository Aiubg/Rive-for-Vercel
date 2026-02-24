<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';

	export const itemTitleVariants = tv({
		base: 'flex w-fit items-center gap-2 leading-snug font-medium',
		variants: {
			size: {
				sm: 'text-sm',
				base: 'text-base'
			}
		},
		defaultVariants: {
			size: 'sm'
		}
	});

	export type ItemTitleSize = VariantProps<typeof itemTitleVariants>['size'];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils/shadcn';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		size,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		size?: ItemTitleSize;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="item-title"
	class={cn(itemTitleVariants({ size }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
