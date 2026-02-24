export function markdownNeedsHighlight(md: string): boolean {
	return /```/.test(md);
}

export function markdownNeedsMath(md: string): boolean {
	return /(\$\$[\s\S]*\$\$)|(?<!\\)\$(?!\s)([\s\S]*?)(?<!\\)\$/m.test(md);
}
