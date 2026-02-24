import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { allowAnonymousChats } from '$lib/utils/constants';
import { handleServerError } from '$lib/server/utils';
import { put } from '@vercel/blob';
import { writeFile, access, mkdir } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { parseAttachmentText } from '$lib/server/files/parse-attachment';
import { isBlobStorageEnabled, upsertUploadMetadata } from '$lib/server/files/upload-store';

const ALLOWED_MIME_TYPES = [
	'text/plain',
	'text/markdown',
	'text/css',
	'text/html',
	'text/javascript',
	'text/x-python',
	'text/x-python-script',
	'application/json',
	'application/x-javascript',
	'application/javascript',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
	'image/bmp',
	'image/svg+xml'
];

const TEXT_EXTENSIONS = [
	'.md',
	'.py',
	'.txt',
	'.json',
	'.js',
	'.ts',
	'.tsx',
	'.jsx',
	'.css',
	'.html',
	'.htm',
	'.yaml',
	'.yml',
	'.toml',
	'.conf',
	'.ini',
	'.sh',
	'.bat',
	'.sql'
];
const DOCX_EXTENSIONS = ['.docx'];
const XLSX_EXTENSIONS = ['.xlsx'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'];

export const POST: RequestHandler = async ({ request, locals: { user } }) => {
	if (!user && !allowAnonymousChats) {
		throw error(401, 'common.unauthorized');
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			throw error(400, 'upload.no_file_uploaded');
		}

		if (file.size > 1024 * 1024 * 25) {
			throw error(400, 'upload.file_size_too_large');
		}

		const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.type);
		const lowerName = file.name.toLowerCase();
		const isTextExt = TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
		const isDocxExt = DOCX_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
		const isXlsxExt = XLSX_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
		const isImageExt = IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
		const isAllowedExt = isTextExt || isDocxExt || isXlsxExt || isImageExt;

		if (!isAllowedMime && !isAllowedExt) {
			throw error(400, 'upload.file_type_not_allowed');
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Calculate SHA-256 hash
		const hash = createHash('sha256').update(buffer).digest('hex');
		const extension = file.name.split('.').pop();
		const fileName = `${hash}${extension ? `.${extension}` : ''}`;
		let fileUrl = `/uploads/${fileName}`;
		if (isBlobStorageEnabled()) {
			const result = await put(`uploads/files/${fileName}`, buffer, {
				access: 'public',
				contentType: file.type || undefined,
				addRandomSuffix: false,
				allowOverwrite: true
			});
			fileUrl = result.url;
		} else {
			const filePath = join('static', 'uploads', fileName);
			await mkdir(join('static', 'uploads'), { recursive: true });

			// Check if file already exists
			let exists = false;
			try {
				await access(filePath);
				exists = true;
			} catch {
				// File does not exist
			}

			if (!exists) {
				// Save file to static/uploads
				await writeFile(filePath, buffer);
			}
		}

		let content: string | undefined;
		const isDocxMime =
			file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
		const isXlsxMime =
			file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
		const isText =
			file.type.startsWith('text/') ||
			file.type === 'application/json' ||
			file.type === 'application/javascript' ||
			file.type === 'application/x-javascript' ||
			isTextExt;
		const isDocx = isDocxExt || isDocxMime;
		const isXlsx = isXlsxExt || isXlsxMime;

		if (isText) {
			content = new TextDecoder().decode(arrayBuffer);
		} else if (isDocx || isXlsx) {
			content = await parseAttachmentText({
				buffer,
				filename: file.name,
				contentType: file.type
			});
		}
		await upsertUploadMetadata({
			url: fileUrl,
			originalName: file.name,
			contentType: file.type,
			size: file.size,
			lastModified: file.lastModified,
			hash
		});

		return json({
			url: fileUrl,
			pathname: file.name,
			contentType: file.type,
			content,
			size: file.size,
			hash,
			lastModified: file.lastModified
		});
	} catch (e) {
		handleServerError(e, 'upload.failed');
	}
};
