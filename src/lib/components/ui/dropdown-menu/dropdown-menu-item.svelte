<script lang="ts">
	import { cn } from '$lib/utils/shadcn';
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className,
		inset,
		variant = 'default',
		...restProps
	}: DropdownMenuPrimitive.ItemProps & {
		inset?: boolean;
		variant?: 'default' | 'destructive';
	} = $props();
</script>

<DropdownMenuPrimitive.Item
	bind:ref
	data-slot="dropdown-menu-item"
	data-inset={inset}
	data-variant={variant}
	class={cn(
		"text-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/15 dark:data-[variant=destructive]:data-highlighted:bg-destructive/25 data-[variant=destructive]:data-highlighted:text-destructive data-[variant=destructive]:*:[svg]:text-destructive! rounded-interactive relative flex cursor-pointer items-center gap-2 px-3 py-2 text-sm outline-hidden transition-colors duration-150 select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:ps-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-current [&_svg:not([class*='size-'])]:size-4",
		className
	)}
	{...restProps}
/>
