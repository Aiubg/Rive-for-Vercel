export type StoredUploadFile = {
	url: string;
	storedName: string;
	originalName: string;
	contentType: string;
	size: number;
	lastModified: number;
	uploadedAt: number;
	hash?: string;
};

export type UploadApiResponse = {
	url?: unknown;
	pathname?: unknown;
	contentType?: unknown;
	content?: unknown;
	size?: unknown;
	hash?: unknown;
	lastModified?: unknown;
	message?: unknown;
};

function parseErrorMessageFromText(rawText: string, fallback: string): string {
	if (!rawText) return fallback;
	try {
		const parsed = JSON.parse(rawText) as { message?: unknown };
		if (parsed && typeof parsed.message === 'string') {
			return parsed.message;
		}
		return fallback;
	} catch {
		return rawText;
	}
}

export function isStoredUploadFile(value: unknown): value is StoredUploadFile {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const rec = value as Record<string, unknown>;
	return (
		typeof rec.url === 'string' &&
		typeof rec.storedName === 'string' &&
		typeof rec.originalName === 'string' &&
		typeof rec.contentType === 'string' &&
		typeof rec.size === 'number' &&
		typeof rec.lastModified === 'number' &&
		typeof rec.uploadedAt === 'number' &&
		(rec.hash === undefined || typeof rec.hash === 'string')
	);
}

export async function readResponseErrorKey(response: Response, fallback: string): Promise<string> {
	const rawText = await response.text().catch(() => '');
	return parseErrorMessageFromText(rawText, fallback);
}

export async function fetchStoredFiles(): Promise<StoredUploadFile[]> {
	const response = await fetch('/api/files');
	if (!response.ok) {
		throw new Error(await readResponseErrorKey(response, 'upload.failed'));
	}

	const payload = (await response.json()) as { files?: unknown };
	if (!payload || !Array.isArray(payload.files)) {
		throw new Error('upload.invalid_response');
	}

	return payload.files.filter(isStoredUploadFile);
}

export async function fetchFilePreview(url: string): Promise<{ content: string | null }> {
	const response = await fetch(`/api/files/preview?url=${encodeURIComponent(url)}`);
	if (!response.ok) {
		throw new Error(await readResponseErrorKey(response, 'upload.failed'));
	}

	const payload = (await response.json()) as { content?: unknown };
	return { content: typeof payload.content === 'string' ? payload.content : null };
}

export async function uploadStoredFile(file: File): Promise<UploadApiResponse> {
	const formData = new FormData();
	formData.append('file', file);

	const response = await fetch('/api/files/upload', {
		method: 'POST',
		body: formData
	});
	if (!response.ok) {
		throw new Error(await readResponseErrorKey(response, 'upload.failed'));
	}

	return (await response.json()) as UploadApiResponse;
}

export async function deleteStoredFile(url: string): Promise<void> {
	const response = await fetch('/api/files/delete', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url })
	});
	if (!response.ok) {
		throw new Error(await readResponseErrorKey(response, 'upload.delete_failed'));
	}
}

export async function renameStoredFile(url: string, name: string): Promise<void> {
	const response = await fetch('/api/files/rename', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url, name })
	});
	if (!response.ok) {
		throw new Error(await readResponseErrorKey(response, 'upload.failed'));
	}
}
