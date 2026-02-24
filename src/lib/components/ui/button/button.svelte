<script lang="ts">
	import { buttonVariants, type ButtonSize, type ButtonVariant } from './button-variants';
	import { cn, type WithElementRef } from '$lib/utils/shadcn';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type ButtonProps = WithElementRef<HTMLButtonAttributes> & {
		variant?: ButtonVariant;
		size?: ButtonSize;
	};

	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

<button
	bind:this={ref}
	data-slot="button"
	class={cn(buttonVariants({ variant, size }), className)}
	{type}
	{disabled}
	{...restProps}
>
	{@render children?.()}
</button>
