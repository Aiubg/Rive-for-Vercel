<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { cn } from '$lib/utils/shadcn';
	import { chatModels } from '$lib/ai/model-registry';
	import type { ClassValue } from 'svelte/elements';
	import { SelectedModel } from '$lib/hooks/selected-model.svelte';
	import { t } from 'svelte-i18n';

	function modelI18nKey(id: string): string {
		return id.replaceAll('.', '-');
	}

	let {
		class: c
	}: {
		class: ClassValue;
	} = $props();

	let open = $state(false);
	const selectedChatModel = SelectedModel.fromContext();
	const selectedChatModelDetails = $derived(
		chatModels.find((model) => model.id === selectedChatModel.value)
	);
</script>

<DropdownMenu {open} onOpenChange={(val) => (open = val)}>
	<DropdownMenuTrigger>
		{#snippet child({ props: menuProps })}
			<Button
				{...menuProps}
				variant="ghost"
				size="sm"
				class={cn('text-foreground flex min-w-0 shrink grow-0 items-center gap-1', c)}
			>
				<span class="text-foreground truncate">
					{$t(
						`models.${selectedChatModelDetails ? modelI18nKey(selectedChatModelDetails.id) : ''}.name`
					)}
				</span>
				<ChevronDownIcon size={16} class="shrink-0" />
			</Button>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent
		align="start"
		class="max-h-[60vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto"
		collisionPadding={16}
	>
		{#each chatModels as chatModel (chatModel.id)}
			<DropdownMenuItem
				onSelect={() => {
					open = false;
					selectedChatModel.value = chatModel.id;
				}}
				class="group/item flex flex-row items-center justify-between gap-4"
				data-active={chatModel.id === selectedChatModel.value}
			>
				<div class="flex flex-col items-start gap-1">
					<div>{$t(`models.${modelI18nKey(chatModel.id)}.name`)}</div>
					<div class="text-muted-foreground text-xs">
						{$t(`models.${modelI18nKey(chatModel.id)}.description`)}
					</div>
				</div>

				<div
					class="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100"
				>
					<Check size={16} />
				</div>
			</DropdownMenuItem>
		{/each}
	</DropdownMenuContent>
</DropdownMenu>
