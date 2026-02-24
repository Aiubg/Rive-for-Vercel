import { describe, expect, it } from 'vitest';
import {
	convertCitationMarkersToMarkdownLinks,
	extractSearchCitationsFromParts,
	hasCitationMarkers
} from '$lib/utils/citations';

describe('citations utils', () => {
	it('converts citation markers outside fenced code blocks', () => {
		const input = [
			'Alpha[@12] beta.',
			'```md',
			'This should keep [@99] literal.',
			'```',
			'Gamma[@2]'
		].join('\n');

		const converted = convertCitationMarkersToMarkdownLinks(input);
		expect(converted).toContain('Alpha\u2060[12](cite:12) beta.');
		expect(converted).toContain('Gamma\u2060[2](cite:2)');
		expect(converted).toContain('This should keep [@99] literal.');
	});

	it('detects citation markers outside fenced code blocks only', () => {
		const onlyInCode = ['```', '[@7]', '```'].join('\n');
		const outside = 'text [@5]';

		expect(hasCitationMarkers(onlyInCode)).toBe(false);
		expect(hasCitationMarkers(outside)).toBe(true);
	});

	it('extracts tavily citations from tool-invocation and dynamic-tool parts', () => {
		const parts = [
			{
				type: 'tool-invocation',
				toolInvocation: {
					toolName: 'tavily_search',
					result: {
						results: [
							{
								id: 1,
								title: 'A',
								url: 'https://a.example.com',
								snippet: 'alpha'
							}
						]
					}
				}
			},
			{
				type: 'dynamic-tool',
				toolName: 'tavily_search',
				output: {
					results: [
						{
							id: 2,
							title: 'B',
							url: 'https://b.example.com',
							snippet: 'beta'
						}
					]
				}
			}
		];

		const citations = extractSearchCitationsFromParts(parts);
		expect(citations.map((c) => c.id)).toEqual([1, 2]);
		expect(citations.map((c) => c.url)).toEqual(['https://a.example.com', 'https://b.example.com']);
	});
});
