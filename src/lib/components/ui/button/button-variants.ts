import { type VariantProps, tv } from 'tailwind-variants';

export const buttonVariants = tv({
	base: "ui-focus-ring aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive rounded-interactive inline-flex shrink-0 items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	variants: {
		variant: {
			default: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
			destructive:
				'ui-focus-ring-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80',
			outline:
				'bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/50 ui-border-interactive',
			secondary:
				'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70',
			ghost: 'hover:bg-accent hover:text-accent-foreground active:bg-accent/50',
			link: 'text-primary underline-offset-4 hover:underline'
		},
		size: {
			default: 'h-9 px-4 py-2 has-[>svg]:px-3',
			sm: 'rounded-control h-8 gap-2 px-3 has-[>svg]:px-2',
			lg: 'rounded-surface h-10 px-6 has-[>svg]:px-4',
			icon: 'size-9',
			'icon-sm': 'size-8',
			'icon-lg': 'size-10'
		}
	},
	defaultVariants: {
		variant: 'default',
		size: 'default'
	}
});

export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
export type ButtonSize = VariantProps<typeof buttonVariants>['size'];
