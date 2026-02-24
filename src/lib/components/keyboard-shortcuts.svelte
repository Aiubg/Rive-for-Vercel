<script lang="ts">
	import { AlertDialog, AlertDialogContent } from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import * as Kbd from '$lib/components/ui/kbd';
	import { t } from 'svelte-i18n';
	import XIcon from '@lucide/svelte/icons/x';

	let { open = $bindable(false) }: { open: boolean } = $props();

	const isMac =
		typeof navigator !== 'undefined' &&
		((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
			?.toUpperCase()
			.includes('MAC') ??
			navigator.userAgent.toUpperCase().includes('MAC'));
	const modifier = isMac ? $t('shortcuts.modifier_mac') : $t('shortcuts.modifier_win');

	const shortcuts = $derived([
		{ label: $t('common.new_chat'), keys: [modifier, $t('shortcuts.shift'), 'O'] },
		{ label: $t('common.search'), keys: [modifier, 'K'] },
		{ label: $t('common.files'), keys: [modifier, $t('shortcuts.shift'), 'F'] },
		{ label: $t('common.toggle_sidebar'), keys: [modifier, 'B'] },
		{ label: $t('common.settings'), keys: [modifier, ','] },
		{ label: $t('common.keyboard_shortcuts'), keys: [modifier, '/'] },
		{ label: $t('chat.send_message'), keys: [$t('shortcuts.enter')] },
		{ label: $t('chat.stop_generating'), keys: [modifier, '.'] },
		{ label: $t('history.share'), keys: [modifier, $t('shortcuts.shift'), 'S'] },
		{ label: $t('common.focus_input'), keys: ['/'] },
		{ label: $t('common.close'), keys: [$t('shortcuts.esc')] }
	]);
</script>

<AlertDialog bind:open>
	<AlertDialogContent
		class="flex h-136 max-h-[95vh] flex-col gap-4 overflow-hidden p-0 sm:max-w-3xl"
	>
		<div class="flex shrink-0 items-center justify-between px-6 pt-6">
			<span class="text-base font-semibold select-none">{$t('common.keyboard_shortcuts')}</span>
			<Button
				variant="ghost"
				size="icon"
				class="size-8"
				onclick={() => (open = false)}
				aria-label={$t('common.close')}
			>
				<XIcon class="size-5" />
				<span class="sr-only">{$t('common.close')}</span>
			</Button>
		</div>

		<div class="flex-1 overflow-y-auto px-6 pb-6">
			<div class="grid grid-cols-1 gap-x-12 gap-y-2 sm:grid-cols-2">
				{#each shortcuts as shortcut, index (index)}
					<div class="flex items-center justify-between py-2">
						<span class="text-muted-foreground text-sm">{shortcut.label}</span>
						<div class="flex gap-1">
							{#each shortcut.keys as key, keyIndex (keyIndex)}
								<Kbd.Root>{key}</Kbd.Root>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</AlertDialogContent>
</AlertDialog>
