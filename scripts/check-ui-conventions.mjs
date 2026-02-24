#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');

const TARGET_EXTENSIONS = new Set(['.svelte', '.css']);
const ALLOWED_ARBITRARY_TEXT_CLASSES = new Set(['text-[0.85em]']);

const spacingUtilityGroup =
	'(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y|w|h|min-w|min-h|max-w|max-h|top|bottom|left|right|inset|size)';

const forbiddenTextMdRegex = /(?:^|[^\w-])(text-md)(?=$|[^\w-])/g;
const arbitraryTextRegex = /text-\[[^\]]+\]/g;
const decimalSpacingRegex = new RegExp(
	'(?:^|[\\s"\'`({\\[])(?:[a-z-]+:)*(-?' +
		spacingUtilityGroup +
		'-\\d+\\.\\d+)(?=$|[\\s"\'`)}\\]])',
	'gi'
);
const forbiddenLegacyVarRegexes = [
	{
		regex: /--control-border-[a-z0-9-]+/gi,
		rule: 'forbidden-legacy-control-border-var'
	},
	{
		regex: /--border-color-[a-z0-9-]+/gi,
		rule: 'forbidden-legacy-border-color-var'
	},
	{
		regex: /--chat-input-bg\b/gi,
		rule: 'forbidden-legacy-chat-input-var'
	},
	{
		regex: /--surface-chat-input\b/gi,
		rule: 'forbidden-legacy-surface-chat-input-var'
	}
];
const forbiddenThemeDestructiveOverrideRegex = /--destructive(?:-foreground)?\s*:/gi;
const nestedVarFallbackRegex = /var\(\s*--[a-z0-9-]+\s*,\s*var\(\s*--[a-z0-9-]+\s*\)\s*\)/gi;

/** @type {{file: string; line: number; column: number; token: string; rule: string}[]} */
const violations = [];

function walk(currentDir) {
	for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
		if (entry.name.startsWith('.')) continue;
		const fullPath = path.join(currentDir, entry.name);
		if (entry.isDirectory()) {
			walk(fullPath);
			continue;
		}

		if (!TARGET_EXTENSIONS.has(path.extname(entry.name))) {
			continue;
		}
		inspectFile(fullPath);
	}
}

function recordViolation(filePath, lineIndex, columnIndex, token, rule) {
	violations.push({
		file: path.relative(rootDir, filePath).replaceAll('\\\\', '/'),
		line: lineIndex + 1,
		column: columnIndex + 1,
		token,
		rule
	});
}

function inspectFile(filePath) {
	const content = fs.readFileSync(filePath, 'utf8');
	const lines = content.split(/\r?\n/);
	const normalizedPath = path.relative(rootDir, filePath).replaceAll('\\\\', '/');
	const isThemeFile = normalizedPath.startsWith('src/styles/themes/');

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex] ?? '';

		for (const match of line.matchAll(forbiddenTextMdRegex)) {
			if (match.index === undefined) continue;
			const token = match[1] ?? 'text-md';
			const tokenOffset = line.indexOf(token, match.index);
			recordViolation(filePath, lineIndex, tokenOffset, token, 'forbidden-text-md');
		}

		for (const match of line.matchAll(arbitraryTextRegex)) {
			if (match.index === undefined) continue;
			const token = match[0];
			if (ALLOWED_ARBITRARY_TEXT_CLASSES.has(token)) continue;
			recordViolation(filePath, lineIndex, match.index, token, 'forbidden-arbitrary-text-size');
		}

		for (const match of line.matchAll(decimalSpacingRegex)) {
			if (match.index === undefined) continue;
			const token = match[1] ?? '';
			if (!token) continue;
			const tokenOffset = line.indexOf(token, match.index);
			recordViolation(filePath, lineIndex, tokenOffset, token, 'forbidden-decimal-spacing');
		}

		for (const { regex, rule } of forbiddenLegacyVarRegexes) {
			regex.lastIndex = 0;
			for (const match of line.matchAll(regex)) {
				if (match.index === undefined) continue;
				const token = match[0] ?? '';
				if (!token) continue;
				recordViolation(filePath, lineIndex, match.index, token, rule);
			}
		}

		for (const match of line.matchAll(nestedVarFallbackRegex)) {
			if (match.index === undefined) continue;
			const token = match[0] ?? '';
			if (!token) continue;
			recordViolation(filePath, lineIndex, match.index, token, 'forbidden-nested-var-fallback');
		}

		if (isThemeFile) {
			forbiddenThemeDestructiveOverrideRegex.lastIndex = 0;
			for (const match of line.matchAll(forbiddenThemeDestructiveOverrideRegex)) {
				if (match.index === undefined) continue;
				const token = match[0] ?? '';
				if (!token) continue;
				recordViolation(
					filePath,
					lineIndex,
					match.index,
					token,
					'forbidden-theme-destructive-override'
				);
			}
		}
	}
}

if (!fs.existsSync(srcDir)) {
	console.error('Cannot find src directory.');
	process.exit(1);
}

walk(srcDir);

if (violations.length === 0) {
	console.log('UI convention guard passed.');
	process.exit(0);
}

console.error('UI convention guard failed with the following violations:');
for (const violation of violations) {
	console.error(
		`- ${violation.file}:${violation.line}:${violation.column} [${violation.rule}] ${violation.token}`
	);
}
process.exit(1);
