<script lang="ts">
	import { Dialog as SheetPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/shadcn';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: SheetPrimitive.OverlayProps = $props();
</script>

<SheetPrimitive.Overlay
	bind:ref
	data-slot="sheet-overlay"
	class={cn(
		'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animation-duration-140 data-[state=open]:animation-duration-180 fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=closed]:pointer-events-none data-[state=closed]:ease-in data-[state=open]:ease-out motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none dark:bg-black/60',
		className
	)}
	{...restProps}
/>
