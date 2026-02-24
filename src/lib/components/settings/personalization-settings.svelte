<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Item from '$lib/components/ui/item';
	import { t, locale } from 'svelte-i18n';
	import { isRTL } from '$lib/i18n';
	import { personalization } from '$lib/hooks/personalization.svelte';
	import Check from '@lucide/svelte/icons/check';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	function handleToneClick(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		const tone = target?.dataset.tone as typeof personalization.value.tone | undefined;
		if (!tone) return;
		personalization.value = { ...personalization.value, tone };
	}
</script>

<div class="flex flex-col gap-3">
	<Item.Root size="none">
		<Item.Content class="select-none">
			<Item.Title size="sm">
				<Label for="tone-select" class="text-sm">{$t('settings.tone')}</Label>
			</Item.Title>
			<Item.Description>{$t('settings.tone_description')}</Item.Description>
		</Item.Content>
		<Item.Actions>
			<DropdownMenu.Root dir={isRTL($locale) ? 'rtl' : 'ltr'}>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							id="tone-select"
							name="tone"
							variant="ghost"
							class="btn-selector justify-between px-3 py-2 text-sm font-medium"
						>
							<span class="truncate">
								{#if personalization.value.tone === 'default'}
									{$t('settings.default')}
								{:else if personalization.value.tone === 'warm'}
									{$t('settings.warm')}
								{:else if personalization.value.tone === 'enthusiastic'}
									{$t('settings.enthusiastic')}
								{:else if personalization.value.tone === 'professional'}
									{$t('settings.professional')}
								{:else if personalization.value.tone === 'humorous'}
									{$t('settings.humorous')}
								{/if}
							</span>
							<ChevronRight class="size-4 rotate-90" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content
					class="w-48 max-w-[calc(100vw-2rem)]"
					align="end"
					collisionPadding={16}
				>
					<DropdownMenu.Item
						data-tone="default"
						onclick={handleToneClick}
						class="flex items-center justify-between"
					>
						{$t('settings.default')}
						{#if personalization.value.tone === 'default'}
							<Check class="size-4" />
						{/if}
					</DropdownMenu.Item>
					<DropdownMenu.Item
						data-tone="warm"
						onclick={handleToneClick}
						class="flex items-center justify-between"
					>
						{$t('settings.warm')}
						{#if personalization.value.tone === 'warm'}
							<Check class="size-4" />
						{/if}
					</DropdownMenu.Item>
					<DropdownMenu.Item
						data-tone="enthusiastic"
						onclick={handleToneClick}
						class="flex items-center justify-between"
					>
						{$t('settings.enthusiastic')}
						{#if personalization.value.tone === 'enthusiastic'}
							<Check class="size-4" />
						{/if}
					</DropdownMenu.Item>
					<DropdownMenu.Item
						data-tone="professional"
						onclick={handleToneClick}
						class="flex items-center justify-between"
					>
						{$t('settings.professional')}
						{#if personalization.value.tone === 'professional'}
							<Check class="size-4" />
						{/if}
					</DropdownMenu.Item>
					<DropdownMenu.Item
						data-tone="humorous"
						onclick={handleToneClick}
						class="flex items-center justify-between"
					>
						{$t('settings.humorous')}
						{#if personalization.value.tone === 'humorous'}
							<Check class="size-4" />
						{/if}
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</Item.Actions>
	</Item.Root>

	<div class="flex flex-col gap-2">
		<Label for="custom-instructions" class="text-sm">{$t('settings.custom_instructions')}</Label>
		<Textarea
			id="custom-instructions"
			name="custom-instructions"
			placeholder={$t('settings.custom_instructions_placeholder')}
			class="max-h-80 min-h-24 resize-none py-2 text-sm"
			value={personalization.value.customInstructions}
			oninput={(e) => {
				personalization.value = {
					...personalization.value,
					customInstructions: e.currentTarget.value
				};
			}}
		/>
	</div>
</div>
