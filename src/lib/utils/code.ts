export function parseLang(className?: string) {
	if (!className) return 'Text';
	const match = className.match(/language-([a-z0-9+-]+)/i);
	if (!match || !match[1]) return 'Text';
	const raw = match[1]!.toLowerCase();
	if (raw === 'text' || raw === 'txt' || raw === 'plain' || raw === 'plaintext') return 'Text';
	return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function observePreForHighlight(
	pre: HTMLPreElement,
	onUpdate: (lang: string, content: string) => void
) {
	const code = pre.querySelector('code') as HTMLElement | null;
	if (code) {
		const lang = parseLang(code.className);
		onUpdate(lang, code.textContent ?? '');
	}

	const observer = new MutationObserver(() => {
		const c = pre.querySelector('code') as HTMLElement | null;
		if (!c) return;

		const currentLang = parseLang(c.className);
		onUpdate(currentLang, c.textContent ?? '');
	});

	observer.observe(pre, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true
	});

	return () => {
		observer.disconnect();
	};
}
