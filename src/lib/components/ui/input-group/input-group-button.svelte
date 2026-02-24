<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';

	const inputGroupButtonVariants = tv({
		base: 'shadow-flat flex items-center gap-2 text-sm',
		variants: {
			size: {
				xs: "rounded-micro h-6 gap-1 px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-4",
				sm: 'rounded-control h-8 gap-2 px-2 has-[>svg]:px-2',
				'icon-xs': 'rounded-micro size-6 p-0 has-[>svg]:p-0',
				'icon-sm': 'size-8 p-0 has-[>svg]:p-0'
			}
		},
		defaultVariants: {
			size: 'xs'
		}
	});

	export type InputGroupButtonSize = VariantProps<typeof inputGroupButtonVariants>['size'];
</script>

<script lang="ts">
	import { cn } from '$lib/utils/shadcn';
	import type { ComponentProps } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		type = 'button',
		variant = 'ghost',
		size = 'xs',
		...restProps
	}: Omit<ComponentProps<typeof Button>, 'href' | 'size'> & {
		size?: InputGroupButtonSize;
	} = $props();
</script>

<Button
	bind:ref
	{type}
	data-size={size}
	{variant}
	class={cn(inputGroupButtonVariants({ size }), className)}
	{...restProps}
>
	{@render children?.()}
</Button>
