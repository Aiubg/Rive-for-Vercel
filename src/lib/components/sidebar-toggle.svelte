<script lang="ts">
	import { t } from 'svelte-i18n';
	import SidebarLeftIcon from '@lucide/svelte/icons/panel-left';
	import { Button } from '$lib/components/ui/button';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';

	const sidebar = useSidebar();
	const expanded = $derived(sidebar.isMobile ? sidebar.openMobile : sidebar.open);
</script>

<Tooltip>
	<TooltipTrigger>
		{#snippet child({ props })}
			<Button
				{...props}
				onclick={() => {
					sidebar.toggle();
				}}
				variant="ghost"
				size="icon-sm"
				aria-label={$t(expanded ? 'common.collapse_sidebar' : 'common.expand_sidebar')}
			>
				<SidebarLeftIcon size={16} class="rtl-mirror" />
			</Button>
		{/snippet}
	</TooltipTrigger>
	<TooltipContent
		>{$t(expanded ? 'common.collapse_sidebar' : 'common.expand_sidebar')}</TooltipContent
	>
</Tooltip>
