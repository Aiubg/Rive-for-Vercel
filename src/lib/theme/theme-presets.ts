export const THEME_PRESETS = [
	{ id: 'aurora', labelKey: 'settings.color_theme_aurora', color: '#6B9CFF' },
	{ id: 'ember', labelKey: 'settings.color_theme_ember', color: '#FF6B4A' },
	{ id: 'ocean', labelKey: 'settings.color_theme_ocean', color: '#2BB3A3' }
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number];
export type ThemePresetId = ThemePreset['id'];

export const DEFAULT_THEME_ID: ThemePresetId = 'aurora';

const PRESET_BY_ID = new Map<string, ThemePreset>(
	THEME_PRESETS.map((preset) => [preset.id, preset])
);

export function getThemePreset(id: string): ThemePreset | null {
	return PRESET_BY_ID.get(id) ?? null;
}

export function isThemePresetId(id: string): id is ThemePresetId {
	return PRESET_BY_ID.has(id);
}
