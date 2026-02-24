<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';
	export const sheetVariants = tv({
		base: 'bg-background text-foreground data-[state=open]:animate-in data-[state=closed]:animate-out border-border shadow-overlay data-[state=closed]:animation-duration-180 data-[state=open]:animation-duration-220 fixed z-50 flex flex-col gap-4 border transition-none data-[state=closed]:pointer-events-none data-[state=closed]:ease-in data-[state=open]:ease-out motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none',
		variants: {
			side: {
				top: 'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b',
				bottom:
					'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
				left: 'data-[state=closed]:slide-out-to-start data-[state=open]:slide-in-from-start inset-y-0 start-0 h-full w-3/4 border-e sm:max-w-sm',
				right:
					'data-[state=closed]:slide-out-to-end data-[state=open]:slide-in-from-end inset-y-0 end-0 h-full w-3/4 border-s sm:max-w-sm'
			}
		},
		defaultVariants: {
			side: 'right'
		}
	});

	export type Side = VariantProps<typeof sheetVariants>['side'];
</script>

<script lang="ts">
	import { Dialog as SheetPrimitive } from 'bits-ui';
	import XIcon from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import { t } from 'svelte-i18n';
	import SheetPortal from '$lib/components/ui/sheet/sheet-portal.svelte';
	import SheetOverlay from '$lib/components/ui/sheet/sheet-overlay.svelte';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils/shadcn';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		side = 'right',
		portalProps,
		hideClose = false,
		children,
		...restProps
	}: WithoutChildrenOrChild<SheetPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SheetPortal>>;
		side?: Side;
		hideClose?: boolean;
		children: Snippet;
	} = $props();
</script>

<SheetPortal {...portalProps}>
	<SheetOverlay />
	<SheetPrimitive.Content
		bind:ref
		data-slot="sheet-content"
		class={cn(sheetVariants({ side }), className)}
		{...restProps}
	>
		{@render children?.()}
		{#if !hideClose}
			<SheetPrimitive.Close
				class="ring-offset-background focus-visible:ring-ring rounded-micro absolute end-4 top-4 opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none"
			>
				<XIcon class="size-5" />
				<span class="sr-only">{$t('common.close')}</span>
			</SheetPrimitive.Close>
		{/if}
	</SheetPrimitive.Content>
</SheetPortal>
