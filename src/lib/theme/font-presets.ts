import { LocalStorage } from '$lib/hooks/local-storage.svelte';

export const FONT_PRESETS = [
	{
		id: 'harmonyos-sans-sc',
		labelKey: 'settings.font_harmonyos_sans_sc',
		stack:
			"'HarmonyOS Sans SC', 'LXGW Bright', 'PingFang SC', 'Inter', 'Noto Sans', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
	},
	{
		id: 'lxgw-bright',
		labelKey: 'settings.font_lxgw_bright',
		stack:
			"'LXGW Bright', 'HarmonyOS Sans SC', 'PingFang SC', 'Inter', 'Noto Sans', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
	},
	{
		id: 'pingfang-sc',
		labelKey: 'settings.font_pingfang_sc',
		stack:
			"'PingFang SC', 'HarmonyOS Sans SC', 'LXGW Bright', 'Inter', 'Noto Sans', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
	},
	{
		id: 'inter',
		labelKey: 'settings.font_inter',
		stack:
			"'Inter', 'Noto Sans', 'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
	},
	{
		id: 'system',
		labelKey: 'settings.font_system_default',
		stack:
			"'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
	}
] as const;

export type FontPreset = (typeof FONT_PRESETS)[number];
export type FontPresetId = FontPreset['id'];

export const DEFAULT_FONT_PRESET_ID: FontPresetId = 'harmonyos-sans-sc';

const PRESET_BY_ID = new Map<string, FontPreset>(FONT_PRESETS.map((preset) => [preset.id, preset]));

export function isFontPresetId(id: string): id is FontPresetId {
	return PRESET_BY_ID.has(id);
}

export function getFontPreset(id: string): FontPreset | null {
	return PRESET_BY_ID.get(id) ?? null;
}

export const fontPreference = new LocalStorage<FontPresetId>(
	'app-font-family',
	DEFAULT_FONT_PRESET_ID
);
