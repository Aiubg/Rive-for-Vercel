/**
 * Generates a random UUID or a fallback random ID.
 */
export function randomId() {
	const globalCrypto = typeof crypto !== 'undefined' ? crypto : undefined;
	if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
		return globalCrypto.randomUUID();
	}
	if (globalCrypto && typeof globalCrypto.getRandomValues === 'function') {
		const bytes = new Uint8Array(16);
		globalCrypto.getRandomValues(bytes);
		const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
		return [
			hex.slice(0, 8),
			hex.slice(8, 12),
			hex.slice(12, 16),
			hex.slice(16, 20),
			hex.slice(20)
		].join('-');
	}
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Copies text to the clipboard using the modern API or a fallback.
 */
export async function copyToClipboard(text: string) {
	try {
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(text);
			return true;
		} else {
			const textArea = document.createElement('textarea');
			textArea.value = text;
			textArea.style.position = 'fixed';
			textArea.style.left = '-9999px';
			textArea.style.top = '0';
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			const successful = document.execCommand('copy');
			document.body.removeChild(textArea);
			return successful;
		}
	} catch {
		return false;
	}
}
