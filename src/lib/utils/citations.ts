import type { UIMessage } from 'ai';
import type { UIMessageWithTree } from '$lib/types/message';

export type CitationSource = {
	id: number;
	title: string;
	url: string;
	snippet: string;
	publishedAt?: string;
	score?: number;
};

const FENCED_CODE_BLOCK_RE = /```[\s\S]*?```/g;
const CITATION_MARKER_RE = /\[@(\d+)\]/g;
const WORD_JOINER = '\u2060';

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object') return null;
	return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseCitationSource(value: unknown): CitationSource | null {
	const rec = asRecord(value);
	if (!rec) return null;

	const id = readNumber(rec.id);
	const title = readString(rec.title);
	const url = readString(rec.url);
	const snippet = readString(rec.snippet) ?? '';
	const publishedAt = readString(rec.publishedAt);
	const score = readNumber(rec.score);

	if (!id || id <= 0 || !title || !url) return null;

	return {
		id,
		title,
		url,
		snippet,
		...(publishedAt ? { publishedAt } : {}),
		...(typeof score === 'number' ? { score } : {})
	};
}

function extractToolResultObject(part: unknown): { toolName?: string; result?: unknown } {
	const rec = asRecord(part);
	if (!rec) return {};

	const toolInvocation = asRecord(rec.toolInvocation);
	if (toolInvocation) {
		return {
			toolName: readString(toolInvocation.toolName),
			result: toolInvocation.result
		};
	}

	return {
		toolName: readString(rec.toolName),
		result: rec.output
	};
}

export function extractSearchCitationsFromParts(parts: unknown[] | undefined): CitationSource[] {
	const list = Array.isArray(parts) ? parts : [];
	const byId = new Map<number, CitationSource>();

	for (const part of list) {
		const { toolName, result } = extractToolResultObject(part);
		if (toolName !== 'tavily_search') continue;

		const resultRec = asRecord(result);
		const rows = Array.isArray(resultRec?.results) ? resultRec.results : [];
		for (const row of rows) {
			const parsed = parseCitationSource(row);
			if (!parsed) continue;
			if (!byId.has(parsed.id)) {
				byId.set(parsed.id, parsed);
			}
		}
	}

	return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

export function extractSearchCitationsFromMessage(
	message: Pick<UIMessageWithTree, 'parts'> | Pick<UIMessage, 'parts'> | undefined
): CitationSource[] {
	const parts = Array.isArray(message?.parts) ? message.parts : [];
	return extractSearchCitationsFromParts(parts as unknown[]);
}

function transformMarkdownOutsideCodeFences(
	md: string,
	transform: (segment: string) => string
): string {
	if (!md) return '';
	let out = '';
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	FENCED_CODE_BLOCK_RE.lastIndex = 0;
	while ((match = FENCED_CODE_BLOCK_RE.exec(md)) !== null) {
		const blockStart = match.index;
		const blockText = match[0] ?? '';
		out += transform(md.slice(lastIndex, blockStart));
		out += blockText;
		lastIndex = blockStart + blockText.length;
	}
	out += transform(md.slice(lastIndex));
	return out;
}

export function convertCitationMarkersToMarkdownLinks(md: string): string {
	return transformMarkdownOutsideCodeFences(md, (segment) =>
		segment.replace(CITATION_MARKER_RE, (_, id: string) => `${WORD_JOINER}[${id}](cite:${id})`)
	);
}

export function hasCitationMarkers(md: string): boolean {
	let found = false;
	transformMarkdownOutsideCodeFences(md, (segment) => {
		if (/\[@\d+\]/.test(segment)) {
			found = true;
		}
		return segment;
	});
	return found;
}

export function countCitationMarkers(md: string): number {
	let count = 0;
	transformMarkdownOutsideCodeFences(md, (segment) => {
		const matches = segment.match(/\[@\d+\]/g);
		if (matches) count += matches.length;
		return segment;
	});
	return count;
}

export function extractTextFromParts(parts: unknown[] | undefined): string {
	if (!Array.isArray(parts)) return '';

	const out: string[] = [];
	for (const part of parts) {
		const rec = asRecord(part);
		if (!rec || rec.type !== 'text') continue;
		const text = readString(rec.text);
		if (text) out.push(text);
	}
	return out.join('\n');
}

export function getCitationMetrics(parts: unknown[] | undefined): {
	sourceCount: number;
	markerCount: number;
	fallbackLikely: boolean;
} {
	const sources = extractSearchCitationsFromParts(parts);
	const text = extractTextFromParts(parts);
	const markerCount = countCitationMarkers(text);
	return {
		sourceCount: sources.length,
		markerCount,
		fallbackLikely: sources.length > 0 && markerCount === 0
	};
}
