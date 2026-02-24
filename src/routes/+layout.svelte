<script lang="ts">
	import favicon from '$lib/assets/freenet-favicon.svg';
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
	import { initI18n, waitLocale, locale, t, isRTL } from '$lib/i18n';
	import { page } from '$app/state';
	import Logo from '$lib/components/ui/logo/logo.svelte';
	import { TooltipProvider } from '$lib/components/ui/tooltip';
	import ThemeManager from '$lib/theme/theme-manager.svelte';

	let { children } = $props();

	initI18n();

	let displayTitle = $derived.by(() => {
		const chatTitle = page.data.chat?.title;
		if (chatTitle) {
			return chatTitle;
		}
		return `${$t('common.title')} - ${$t('common.slogan')}`;
	});

	$effect(() => {
		if ($locale) {
			document.documentElement.lang = $locale;
			document.documentElement.dir = isRTL($locale) ? 'rtl' : 'ltr';
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{#if $locale}
		<title>{displayTitle}</title>
		<meta name="description" content={$t('seo.description')} />
		<meta name="keywords" content={$t('seo.keywords')} />
		<meta property="og:title" content={displayTitle} />
		<meta property="og:description" content={$t('seo.description')} />
		<meta property="og:type" content="website" />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content={displayTitle} />
		<meta name="twitter:description" content={$t('seo.description')} />
	{/if}
</svelte:head>

<ModeWatcher defaultTheme="aurora" themeStorageKey="app-color-theme" />
<ThemeManager />

{#await waitLocale()}
	<div class="bg-background text-foreground flex h-screen w-screen items-center justify-center">
		<div class="loading-logo">
			<Logo size={48} color="currentColor" class="shrink-0" />
		</div>
	</div>
{:then}
	<Toaster position="top-center" />
	<TooltipProvider>
		{@render children()}
	</TooltipProvider>
{/await}

<style>
	.loading-logo {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 80px;
		height: 80px;
	}

	.loading-logo :global(svg) {
		position: relative;
		z-index: 10;
		will-change: transform, filter;
		backface-visibility: hidden;
		transform: translateZ(0);
		overflow: visible;
		animation:
			logo-enter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both,
			logo-pulse 3s ease-in-out 0.6s infinite;
	}

	@keyframes logo-enter {
		from {
			opacity: 0;
			transform: scale(0.5);
			filter: blur(10px);
		}
		to {
			opacity: 1;
			transform: scale(1);
			filter: blur(0);
		}
	}

	@keyframes logo-pulse {
		0%,
		100% {
			transform: scale(1);
			filter: drop-shadow(0 0 0 transparent);
		}
		50% {
			transform: scale(1.1);
			filter: drop-shadow(0 0 15px var(--primary));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.loading-logo {
			animation: none;
			filter: none;
			transform: none;
		}
	}
</style>
