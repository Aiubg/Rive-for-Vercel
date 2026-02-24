import { describe, expect, it } from 'vitest';
import { parseLang } from '$lib/utils/code';
import { LocalStorage } from '$lib/hooks/local-storage.svelte';

describe('code utils', () => {
	it('parses language label', () => {
		expect(parseLang('')).toBe('Text');
		expect(parseLang('language-typescript')).toBe('Typescript');
		expect(parseLang('language-text')).toBe('Text');
		expect(parseLang('language-plaintext')).toBe('Text');
	});
});

describe('LocalStorage', () => {
	it('sets/gets and deletes', () => {
		const store = new Map<string, string>();
		// @ts-expect-error: minimal localStorage stub
		globalThis.localStorage = {
			getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
			setItem: (k: string, v: string) => {
				store.set(k, v);
			},
			removeItem: (k: string) => {
				store.delete(k);
			}
		};

		const ls = new LocalStorage<{ a: number }>('__test_key__', { a: 1 });
		ls.value = { a: 2 };
		expect(ls.value.a).toBe(2);

		ls.delete();
		expect(ls.value.a).toBe(1);
	});
});
