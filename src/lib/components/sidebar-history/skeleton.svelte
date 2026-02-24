<script lang="ts">
	import {
		SidebarGroup,
		SidebarGroupContent,
		SidebarGroupLabel,
		SidebarMenu
	} from '$lib/components/ui/sidebar';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { t } from 'svelte-i18n';

	let { count = 5 }: { count?: number } = $props();
	const widths = [44, 32, 28, 64, 52, 40, 56, 48];
</script>

<SidebarGroup>
	<SidebarGroupLabel>{$t('history.today')}</SidebarGroupLabel>
	<SidebarGroupContent>
		<SidebarMenu>
			{#each Array(count) as _, i (i)}
				{@const width = widths[i % widths.length]}
				<div class="flex h-8 items-center px-2">
					<Skeleton class="bg-sidebar-accent/10 h-4 flex-1" style="max-width: {width}%" />
				</div>
			{/each}
		</SidebarMenu>
	</SidebarGroupContent>
</SidebarGroup>
