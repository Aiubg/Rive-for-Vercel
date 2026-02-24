import { describe, expect, it } from 'vitest';
import { markdownNeedsHighlight, markdownNeedsMath } from '$lib/utils/markdown';

describe('markdown utils', () => {
	it('detects highlight need', () => {
		expect(markdownNeedsHighlight('plain')).toBe(false);
		expect(markdownNeedsHighlight('```ts\nconst x = 1\n```')).toBe(true);
	});

	it('detects math need', () => {
		expect(markdownNeedsMath('plain')).toBe(false);
		expect(markdownNeedsMath('$x$')).toBe(true);
		expect(markdownNeedsMath('$$x$$')).toBe(true);
		expect(markdownNeedsMath('\\$x\\$')).toBe(false);
	});
});
