<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Item from '$lib/components/ui/item';
	import { setMode, userPrefersMode, setTheme, theme } from 'mode-watcher';
	import { t, locale, getLocaleFromNavigator } from 'svelte-i18n';
	import { languagePreference, type LanguagePreference } from '$lib/i18n';
	import Check from '@lucide/svelte/icons/check';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import Monitor from '@lucide/svelte/icons/monitor';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { cn } from '$lib/utils/shadcn';
	import {
		DEFAULT_THEME_ID,
		THEME_PRESETS,
		isThemePresetId,
		type ThemePresetId
	} from '$lib/theme/theme-presets';
	import {
		DEFAULT_FONT_PRESET_ID,
		FONT_PRESETS,
		fontPreference,
		isFontPresetId,
		type FontPresetId
	} from '$lib/theme/font-presets';

	const selectedThemeMode = $derived(userPrefersMode.current ?? 'system');
	let currentLanguagePreference = $state<LanguagePreference>(languagePreference.value ?? 'system');
	const currentThemeId = $derived.by(() => {
		const current = theme.current as string | undefined;
		if (!current) return DEFAULT_THEME_ID;
		return isThemePresetId(current) ? current : DEFAULT_THEME_ID;
	});

	const currentThemeSwatch = $derived.by(() => {
		const preset = THEME_PRESETS.find((item) => item.id === currentThemeId);
		return preset?.color ?? THEME_PRESETS[0]?.color;
	});

	const currentThemeLabelKey = $derived.by(() => {
		const preset = THEME_PRESETS.find((item) => item.id === currentThemeId);
		return preset?.labelKey ?? 'settings.color_theme_aurora';
	});

	const themeOptions = $derived.by(() => THEME_PRESETS);
	const currentFontId = $derived.by(() => {
		const current = fontPreference.value as string | undefined;
		if (!current) return DEFAULT_FONT_PRESET_ID;
		return isFontPresetId(current) ? current : DEFAULT_FONT_PRESET_ID;
	});
	const fontOptions = $derived.by(() => FONT_PRESETS);
	const currentFontLabel = $derived.by(() => {
		const preset = FONT_PRESETS.find((item) => item.id === currentFontId);
		return preset?.labelKey ?? FONT_PRESETS[0]?.labelKey ?? 'settings.font_harmonyos_sans_sc';
	});

	function setThemeMode(val: 'light' | 'dark' | 'system') {
		setMode(val);
	}

	function setColorTheme(nextTheme: ThemePresetId) {
		setTheme(nextTheme);
	}

	function setFontPreset(nextFont: FontPresetId) {
		fontPreference.value = nextFont;
	}

	function themeOptionClasses(target: 'system' | 'light' | 'dark') {
		return cn(
			'tab-trigger btn-selector flex h-20 cursor-pointer flex-col items-center justify-center gap-2 p-4',
			selectedThemeMode === target ? 'bg-accent text-accent-foreground' : ''
		);
	}

	function handleThemeModeClick(event: MouseEvent) {
		const target = event.currentTarget as HTMLButtonElement | null;
		const mode = target?.dataset.mode as 'light' | 'dark' | 'system' | undefined;
		if (!mode) return;
		setThemeMode(mode);
	}

	function handleColorThemeClick(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		const nextTheme = target?.dataset.themeValue;
		if (!nextTheme) return;
		if (!isThemePresetId(nextTheme)) return;
		setColorTheme(nextTheme);
	}

	function handleLanguageClick(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		const nextLanguage = target?.dataset.language as LanguagePreference | undefined;
		if (!nextLanguage) return;
		setLanguage(nextLanguage);
	}

	function handleFontPresetClick(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		const nextFont = target?.dataset.fontValue;
		if (!nextFont) return;
		if (!isFontPresetId(nextFont)) return;
		setFontPreset(nextFont);
	}

	function setLanguage(lang: LanguagePreference) {
		if (lang === 'system') {
			languagePreference.value = 'system';
			currentLanguagePreference = 'system';
			const browserLocale = getLocaleFromNavigator() ?? 'zh-CN';
			$locale = browserLocale;
		} else {
			const next = lang as Exclude<LanguagePreference, 'system'>;
			languagePreference.value = next;
			currentLanguagePreference = next;
			$locale = next;
		}
	}
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-2">
		<Label class="text-sm" id="theme-label">{$t('common.theme')}</Label>
		<div
			class="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3"
			role="radiogroup"
			aria-labelledby="theme-label"
		>
			<button
				id="theme-system"
				type="button"
				name="theme"
				class={themeOptionClasses('system')}
				data-mode="system"
				onclick={handleThemeModeClick}
				aria-checked={selectedThemeMode === 'system'}
				role="radio"
			>
				<Monitor class="size-5" />
				<span class="text-center text-sm font-medium">{$t('common.system')}</span>
			</button>
			<button
				id="theme-light"
				type="button"
				name="theme"
				class={themeOptionClasses('light')}
				data-mode="light"
				onclick={handleThemeModeClick}
				aria-checked={selectedThemeMode === 'light'}
				role="radio"
			>
				<Sun class="size-5" />
				<span class="text-center text-sm font-medium">{$t('common.light')}</span>
			</button>
			<button
				id="theme-dark"
				type="button"
				name="theme"
				class={themeOptionClasses('dark')}
				data-mode="dark"
				onclick={handleThemeModeClick}
				aria-checked={selectedThemeMode === 'dark'}
				role="radio"
			>
				<Moon class="size-5" />
				<span class="text-center text-sm font-medium">{$t('common.dark')}</span>
			</button>
		</div>
	</div>

	<Item.Root size="none">
		<Item.Content>
			<Item.Title size="sm">
				<Label for="color-theme-select" class="text-sm">{$t('settings.color_theme')}</Label>
			</Item.Title>
		</Item.Content>
		<Item.Actions>
			<div class="flex items-center gap-2">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								id="color-theme-select"
								name="color-theme"
								variant="ghost"
								class="btn-selector justify-between px-4 py-2 text-sm font-medium"
							>
								<div class="flex items-center gap-2">
									<span
										class="border-input rounded-pill h-3 w-3 border"
										style:background-color={currentThemeSwatch}
									></span>
									<span>{$t(currentThemeLabelKey)}</span>
								</div>
								<ChevronRight class="size-4 rotate-90" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content
						class="w-48 max-w-[calc(100vw-2rem)]"
						align="end"
						collisionPadding={16}
					>
						{#each themeOptions as option (option.id)}
							<DropdownMenu.Item
								class="flex items-center justify-between"
								data-theme-value={option.id}
								onclick={handleColorThemeClick}
							>
								<div class="flex items-center gap-2">
									<span
										class="border-input rounded-pill h-3 w-3 border"
										style:background-color={option.color}
									></span>
									<span>{$t(option.labelKey)}</span>
								</div>
								{#if currentThemeId === option.id}
									<Check class="size-4" />
								{/if}
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</Item.Actions>
	</Item.Root>

	<Item.Root size="none">
		<Item.Content>
			<Item.Title size="sm">
				<Label for="language-select" class="text-sm">{$t('common.language')}</Label>
			</Item.Title>
		</Item.Content>
		<Item.Actions>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							id="language-select"
							name="language"
							variant="ghost"
							class="btn-selector justify-between px-4 py-2 text-sm font-medium"
						>
							<div class="flex items-center gap-2">
								{#if currentLanguagePreference === 'system'}
									<span>{$t('common.system')}</span>
								{:else if currentLanguagePreference === 'en'}
									<span>{$t('common.language_en')}</span>
								{:else if currentLanguagePreference === 'zh-CN'}
									<span>{$t('common.language_zh_cn')}</span>
								{/if}
							</div>
							<ChevronRight class="size-4 rotate-90" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content
					class="w-40 max-w-[calc(100vw-2rem)]"
					align="end"
					collisionPadding={16}
				>
					<DropdownMenu.Item
						class="flex items-center justify-between"
						data-language="system"
						onclick={handleLanguageClick}
					>
						{$t('common.system')}
						{#if currentLanguagePreference === 'system'}
							<Check class="size-4" />
						{/if}
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class="flex items-center justify-between"
						data-language="zh-CN"
						onclick={handleLanguageClick}
					>
						{$t('common.language_zh_cn')}
						{#if currentLanguagePreference === 'zh-CN'}
							<Check class="size-4" />
						{/if}
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class="flex items-center justify-between"
						data-language="en"
						onclick={handleLanguageClick}
					>
						{$t('common.language_en')}
						{#if currentLanguagePreference === 'en'}
							<Check class="size-4" />
						{/if}
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</Item.Actions>
	</Item.Root>

	<Item.Root size="none">
		<Item.Content>
			<Item.Title size="sm">
				<Label for="font-select" class="text-sm">{$t('settings.font')}</Label>
			</Item.Title>
		</Item.Content>
		<Item.Actions>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							id="font-select"
							name="font-family"
							variant="ghost"
							class="btn-selector justify-between px-4 py-2 text-sm font-medium"
						>
							<span>{$t(currentFontLabel)}</span>
							<ChevronRight class="size-4 rotate-90" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content
					class="w-56 max-w-[calc(100vw-2rem)]"
					align="end"
					collisionPadding={16}
				>
					{#each fontOptions as option (option.id)}
						<DropdownMenu.Item
							class="flex items-center justify-between"
							data-font-value={option.id}
							onclick={handleFontPresetClick}
						>
							<span>{$t(option.labelKey)}</span>
							{#if currentFontId === option.id}
								<Check class="size-4" />
							{/if}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</Item.Actions>
	</Item.Root>
</div>
