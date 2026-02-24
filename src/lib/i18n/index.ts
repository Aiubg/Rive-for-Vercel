import { browser } from '$app/environment';
import {
	init,
	register,
	getLocaleFromNavigator,
	locale,
	waitLocale,
	t,
	date,
	time
} from 'svelte-i18n';
import { LocalStorage } from '$lib/hooks/local-storage.svelte';

const defaultLocale = 'zh-CN';

export type LanguagePreference = 'zh-CN' | 'en' | 'system';

export const languagePreference = new LocalStorage<LanguagePreference>('app-language', 'system');

export const RTL_LOCALES = ['fa', 'he', 'ur', 'yi'];

export function isRTL(loc: string | null | undefined): boolean {
	if (!loc) return false;
	const baseLocale = loc.split('-')[0]?.toLowerCase();
	return !!baseLocale && RTL_LOCALES.includes(baseLocale);
}

let initialized = false;

function initializeI18n() {
	if (initialized) return;
	initialized = true;

	register('en', () => import('./locales/en.json'));
	register('zh-CN', () => import('./locales/zh-CN.json'));

	let initialLocale = defaultLocale;

	if (browser) {
		const storedPreference = languagePreference.value;
		const navigatorLocale = getLocaleFromNavigator() || defaultLocale;
		initialLocale =
			!storedPreference || storedPreference === 'system' ? navigatorLocale : storedPreference;
	}

	init({
		fallbackLocale: defaultLocale,
		initialLocale
	});

	if (browser) {
		locale.subscribe((newLocale) => {
			if (!newLocale) return;
			if (languagePreference.value === 'system') return;
			languagePreference.value = newLocale as LanguagePreference;
		});
	}
}

export function initI18n() {
	initializeI18n();
}

initializeI18n();

export { locale, waitLocale, t, date, time };
