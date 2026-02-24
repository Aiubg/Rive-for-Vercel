<script lang="ts">
	import { cn } from '$lib/utils/shadcn';
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		sideOffset = 6,
		class: className,
		...restProps
	}: DropdownMenuPrimitive.SubContentProps = $props();
</script>

<DropdownMenuPrimitive.SubContent
	bind:ref
	data-slot="dropdown-menu-sub-content"
	{sideOffset}
	class={cn(
		'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-end-2 data-[side=right]:slide-in-from-start-2 data-[side=top]:slide-in-from-bottom-2 border-border rounded-surface shadow-overlay z-50 max-h-(--bits-dropdown-menu-content-available-height) min-w-32 origin-(--bits-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto border p-2 outline-none motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none',
		className
	)}
	{...restProps}
/>
