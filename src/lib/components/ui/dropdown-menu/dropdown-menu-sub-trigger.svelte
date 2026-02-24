<script lang="ts">
	import { cn } from '$lib/utils/shadcn';
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className,
		inset,
		...restProps
	}: DropdownMenuPrimitive.SubTriggerProps & {
		inset?: boolean;
	} = $props();
</script>

<DropdownMenuPrimitive.SubTrigger
	bind:ref
	data-slot="dropdown-menu-sub-trigger"
	data-inset={inset}
	class={cn(
		"text-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground rounded-interactive relative flex cursor-pointer items-center gap-2 px-3 py-2 text-sm outline-hidden transition-colors duration-150 select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:ps-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-current [&_svg:not([class*='size-'])]:size-4",
		className
	)}
	{...restProps}
/>
