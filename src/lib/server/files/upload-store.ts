import { del, get, list, put } from '@vercel/blob';
import { env } from '$env/dynamic/private';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'fs/promises';
import { join, basename } from 'path';
import { parseAttachmentText } from '$lib/server/files/parse-attachment';
import { UploadForbiddenError, UploadNotFoundError } from '$lib/server/errors/upload';

const UPLOADS_DIR = join('static', 'uploads');
const METADATA_FILE = join('data', 'uploads', 'metadata.json');
const BLOB_FILES_PREFIX = 'uploads/files/';
const BLOB_METADATA_PATH = 'uploads/metadata.json';
const MAX_PREVIEW_CHARS = 200_000;
// Serialize metadata mutations to avoid lost updates when uploads happen concurrently.
let metadataWriteLock: Promise<void> = Promise.resolve();
const blobEnabled = !!env.BLOB_READ_WRITE_TOKEN?.trim();

const TEXT_EXTENSIONS = new Set([
	'md',
	'py',
	'txt',
	'json',
	'js',
	'ts',
	'tsx',
	'jsx',
	'css',
	'html',
	'htm',
	'yaml',
	'yml',
	'toml',
	'conf',
	'ini',
	'sh',
	'bat',
	'sql'
]);

const MIME_BY_EXTENSION: Record<string, string> = {
	txt: 'text/plain',
	md: 'text/markdown',
	css: 'text/css',
	html: 'text/html',
	htm: 'text/html',
	js: 'application/javascript',
	mjs: 'application/javascript',
	cjs: 'application/javascript',
	json: 'application/json',
	py: 'text/x-python',
	ts: 'text/plain',
	tsx: 'text/plain',
	jsx: 'text/plain',
	yaml: 'text/plain',
	yml: 'text/plain',
	toml: 'text/plain',
	conf: 'text/plain',
	ini: 'text/plain',
	sh: 'text/plain',
	bat: 'text/plain',
	sql: 'text/plain',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

type UploadMetadataEntry = {
	url: string;
	originalName: string;
	contentType: string;
	size: number;
	lastModified: number;
	hash?: string;
	uploadedAt: number;
};

type UploadMetadataMap = Record<string, UploadMetadataEntry>;

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

function getExtension(fileName: string): string {
	const idx = fileName.lastIndexOf('.');
	if (idx === -1) return '';
	return fileName.slice(idx + 1).toLowerCase();
}

function isSafeStoredFileName(fileName: string): boolean {
	return !fileName.includes('..') && !fileName.includes('/') && !fileName.includes('\\');
}

function parseBlobPathname(url: string): string | null {
	try {
		const parsed = new URL(url);
		const pathname = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
		if (!pathname.startsWith(BLOB_FILES_PREFIX)) return null;
		const storedName = pathname.slice(BLOB_FILES_PREFIX.length);
		if (!storedName || !isSafeStoredFileName(storedName)) return null;
		return pathname;
	} catch {
		return null;
	}
}

function clampPreview(text: string): string {
	if (text.length <= MAX_PREVIEW_CHARS) return text;
	return `${text.slice(0, MAX_PREVIEW_CHARS)}\n\n[Preview truncated at ${MAX_PREVIEW_CHARS} characters]`;
}

function normalizeLineEndings(text: string): string {
	return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function guessContentType(fileName: string): string {
	const ext = getExtension(fileName);
	return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
}

function shouldTextDecode(fileName: string, contentType: string): boolean {
	if (contentType.startsWith('text/')) return true;
	if (contentType === 'application/json') return true;
	if (contentType === 'application/javascript') return true;
	const ext = getExtension(fileName);
	return TEXT_EXTENSIONS.has(ext);
}

export function parseUploadUrl(url: string): string | null {
	if (url.startsWith('/uploads/')) {
		const fileName = url.slice('/uploads/'.length);
		if (!fileName || !isSafeStoredFileName(fileName)) return null;
		return fileName;
	}
	if (!blobEnabled) return null;
	const pathname = parseBlobPathname(url);
	if (!pathname) return null;
	return basename(pathname);
}

function resolveUploadLocation(url: string):
	| { kind: 'local'; fileName: string; storedName: string }
	| { kind: 'blob'; pathname: string; storedName: string }
	| null {
	const localName = parseUploadUrl(url);
	if (localName) {
		return {
			kind: 'local',
			fileName: localName,
			storedName: localName
		};
	}
	if (!blobEnabled) return null;
	const pathname = parseBlobPathname(url);
	if (!pathname) return null;
	return {
		kind: 'blob',
		pathname,
		storedName: basename(pathname)
	};
}

async function readUploadMetadataMapFromBlob(): Promise<UploadMetadataMap> {
	try {
		const result = await get(BLOB_METADATA_PATH, { access: 'private' });
		if (!result || result.statusCode !== 200 || !result.stream) return {};
		const raw = await new Response(result.stream).text();
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		return parsed as UploadMetadataMap;
	} catch {
		return {};
	}
}

async function readUploadMetadataMap(): Promise<UploadMetadataMap> {
	if (blobEnabled) {
		return readUploadMetadataMapFromBlob();
	}
	try {
		const raw = await readFile(METADATA_FILE, 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return {};
		}
		return parsed as UploadMetadataMap;
	} catch {
		return {};
	}
}

async function writeUploadMetadataMap(map: UploadMetadataMap): Promise<void> {
	if (blobEnabled) {
		await put(BLOB_METADATA_PATH, JSON.stringify(map, null, 2), {
			access: 'private',
			contentType: 'application/json',
			addRandomSuffix: false,
			allowOverwrite: true
		});
		return;
	}
	await mkdir(join('data', 'uploads'), { recursive: true });
	await writeFile(METADATA_FILE, JSON.stringify(map, null, 2), 'utf8');
}

export function isBlobStorageEnabled() {
	return blobEnabled;
}

async function withMetadataWriteLock<T>(task: () => Promise<T>): Promise<T> {
	let release = () => {};
	const nextLock = new Promise<void>((resolve) => {
		release = resolve;
	});
	const previousLock = metadataWriteLock;
	metadataWriteLock = nextLock;

	await previousLock;
	try {
		return await task();
	} finally {
		release();
	}
}

export async function upsertUploadMetadata(
	entry: Omit<UploadMetadataEntry, 'uploadedAt'> & { uploadedAt?: number }
): Promise<void> {
	await withMetadataWriteLock(async () => {
		const map = await readUploadMetadataMap();
		map[entry.url] = {
			...entry,
			uploadedAt: entry.uploadedAt ?? Date.now()
		};
		await writeUploadMetadataMap(map);
	});
}

export async function removeUploadMetadata(url: string): Promise<void> {
	await withMetadataWriteLock(async () => {
		const map = await readUploadMetadataMap();
		if (!(url in map)) return;
		delete map[url];
		await writeUploadMetadataMap(map);
	});
}

export async function renameUploadMetadata(url: string, originalName: string): Promise<void> {
	await withMetadataWriteLock(async () => {
		const map = await readUploadMetadataMap();
		const current = map[url];
		if (!current) return;
		map[url] = {
			...current,
			originalName
		};
		await writeUploadMetadataMap(map);
	});
}

export async function listStoredUploads(): Promise<StoredUploadFile[]> {
	if (blobEnabled) {
		const metadataMap = await readUploadMetadataMap();
		const files: StoredUploadFile[] = [];
		let cursor: string | undefined;

		do {
			const page = await list({ prefix: BLOB_FILES_PREFIX, cursor, limit: 1000 });
			for (const blob of page.blobs) {
				const storedName = blob.pathname.slice(BLOB_FILES_PREFIX.length);
				if (!storedName || !isSafeStoredFileName(storedName)) continue;
				const metadata = metadataMap[blob.url];
				const uploadedAtMs = metadata?.uploadedAt ?? blob.uploadedAt.getTime();
				files.push({
					url: blob.url,
					storedName,
					originalName: metadata?.originalName ?? storedName,
					contentType: metadata?.contentType ?? guessContentType(storedName),
					size: metadata?.size ?? blob.size,
					lastModified: metadata?.lastModified ?? uploadedAtMs,
					uploadedAt: uploadedAtMs,
					hash: metadata?.hash
				});
			}
			cursor = page.hasMore ? page.cursor : undefined;
		} while (cursor);

		files.sort((a, b) => b.uploadedAt - a.uploadedAt);
		return files;
	}

	await mkdir(UPLOADS_DIR, { recursive: true });
	const metadataMap = await readUploadMetadataMap();
	const entries = await readdir(UPLOADS_DIR, { withFileTypes: true });
	const files: StoredUploadFile[] = [];

	for (const entry of entries) {
		if (!entry.isFile()) continue;
		if (!isSafeStoredFileName(entry.name)) continue;

		const storedName = entry.name;
		const url = `/uploads/${storedName}`;
		const fsPath = join(UPLOADS_DIR, storedName);
		const fileStat = await stat(fsPath);
		const metadata = metadataMap[url];

		files.push({
			url,
			storedName,
			originalName: metadata?.originalName ?? storedName,
			contentType: metadata?.contentType ?? guessContentType(storedName),
			size: fileStat.size,
			lastModified: Number(fileStat.mtimeMs),
			uploadedAt: metadata?.uploadedAt ?? Number(fileStat.mtimeMs),
			hash: metadata?.hash
		});
	}

	files.sort((a, b) => b.uploadedAt - a.uploadedAt);
	return files;
}

export async function getUploadPreview(url: string): Promise<{
	content: string | null;
	contentType: string;
}> {
	const location = resolveUploadLocation(url);
	if (!location) {
		throw new UploadForbiddenError();
	}

	const metadataMap = await readUploadMetadataMap();
	const metadata = metadataMap[url];
	let buffer: Buffer;
	const fallbackName = metadata?.originalName ?? location.storedName;
	let contentType = metadata?.contentType ?? guessContentType(fallbackName);
	if (location.kind === 'local') {
		const fsPath = join(UPLOADS_DIR, location.fileName);
		try {
			buffer = await readFile(fsPath);
		} catch (e) {
			if (typeof e === 'object' && e && 'code' in e && e.code === 'ENOENT') {
				throw new UploadNotFoundError({ cause: e });
			}
			throw e;
		}
	} else {
		const response = await fetch(url);
		if (!response.ok) {
			throw new UploadNotFoundError();
		}
		const typeFromResponse = response.headers.get('content-type');
		if (typeFromResponse) {
			contentType = typeFromResponse.split(';')[0] ?? contentType;
		}
		buffer = Buffer.from(await response.arrayBuffer());
	}

	if (shouldTextDecode(fallbackName, contentType)) {
		const decoded = new TextDecoder().decode(buffer);
		return {
			content: clampPreview(normalizeLineEndings(decoded)),
			contentType
		};
	}

	const ext = getExtension(fallbackName);
	const shouldParseOffice =
		ext === 'docx' ||
		ext === 'xlsx' ||
		contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
		contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
	if (shouldParseOffice) {
		const parsed = await parseAttachmentText({
			buffer,
			filename: fallbackName,
			contentType
		});
		return {
			content: typeof parsed === 'string' && parsed.length > 0 ? clampPreview(parsed) : null,
			contentType
		};
	}

	return {
		content: null,
		contentType
	};
}

export async function removeStoredUploadByUrl(url: string): Promise<void> {
	const location = resolveUploadLocation(url);
	if (!location) {
		throw new UploadForbiddenError();
	}

	if (location.kind === 'local') {
		const filePath = join(UPLOADS_DIR, location.fileName);
		try {
			await unlink(filePath);
		} catch (e) {
			if (typeof e === 'object' && e && 'code' in e && e.code === 'ENOENT') {
				// File already absent, continue removing metadata.
			} else {
				throw e;
			}
		}
	} else {
		await del(location.pathname);
	}

	await removeUploadMetadata(url);
}
