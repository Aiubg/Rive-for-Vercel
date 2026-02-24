<script lang="ts">
	import { cn } from '$lib/utils/shadcn';

	let { class: className }: { class?: string } = $props();
</script>

<div class={cn('flex items-center', className)}>
	<div class="loading-dot bg-foreground rounded-pill h-3 w-3"></div>
</div>

<style>
	.loading-dot {
		animation: dot-breathe 1.2s ease-in-out infinite;
		transform-origin: center;
	}

	@keyframes dot-breathe {
		0%,
		100% {
			transform: scale(0.7);
			opacity: 0.35;
		}
		50% {
			transform: scale(1);
			opacity: 0.9;
		}
	}
</style>
