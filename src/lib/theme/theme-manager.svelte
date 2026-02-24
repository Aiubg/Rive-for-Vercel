<script lang="ts">
	import { mode, setTheme, theme } from 'mode-watcher';
	import { DEFAULT_THEME_ID, isThemePresetId } from '$lib/theme/theme-presets';
	import {
		DEFAULT_FONT_PRESET_ID,
		fontPreference,
		getFontPreset,
		isFontPresetId
	} from '$lib/theme/font-presets';

	const isBrowser = typeof document !== 'undefined';
	const setMetaThemeColor = (color: string) => {
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta) meta.setAttribute('content', color);
	};

	$effect(() => {
		if (!isBrowser) return;
		const currentTheme = (theme.current as string | undefined) ?? '';
		const currentMode = mode.current ?? 'system';
		const activeTheme = isThemePresetId(currentTheme) ? currentTheme : DEFAULT_THEME_ID;
		const currentFont = (fontPreference.value as string | undefined) ?? '';
		const activeFont = isFontPresetId(currentFont) ? currentFont : DEFAULT_FONT_PRESET_ID;
		const fontPreset = getFontPreset(activeFont);
		if (currentTheme !== activeTheme) {
			setTheme(activeTheme);
		}
		if (currentFont !== activeFont) {
			fontPreference.value = activeFont;
		}
		document.documentElement.setAttribute('data-theme', activeTheme);
		if (fontPreset) {
			document.documentElement.style.setProperty('--font-sans', fontPreset.stack);
			document.documentElement.setAttribute('data-font', fontPreset.id);
		}

		const background = getComputedStyle(document.documentElement)
			.getPropertyValue('--background')
			.trim();
		if (background) {
			setMetaThemeColor(background);
		}
		void currentMode;
	});
</script>
