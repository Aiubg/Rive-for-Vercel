import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

const MAX_EXTRACTED_CHARS = 200_000;

type ParseArgs = {
	buffer: Buffer;
	filename: string;
	contentType?: string | null;
};

function getExtension(filename: string): string {
	const idx = filename.lastIndexOf('.');
	return idx === -1 ? '' : filename.slice(idx + 1).toLowerCase();
}

function clampContent(text: string): string {
	if (text.length <= MAX_EXTRACTED_CHARS) return text;
	return `${text.slice(0, MAX_EXTRACTED_CHARS)}\n\n[Content truncated at ${MAX_EXTRACTED_CHARS} characters]`;
}

function normalizeLineEndings(text: string): string {
	return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export async function parseAttachmentText({ buffer, filename, contentType }: ParseArgs) {
	const ext = getExtension(filename);
	const mime = (contentType || '').toLowerCase();

	if (
		ext === 'docx' ||
		mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	) {
		const result = await mammoth.extractRawText({ buffer });
		const raw = typeof result.value === 'string' ? result.value : '';
		return clampContent(normalizeLineEndings(raw.trim()));
	}

	if (
		ext === 'xlsx' ||
		mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	) {
		const workbook = XLSX.read(buffer, { type: 'buffer' });
		const sheetTexts: string[] = [];

		for (const name of workbook.SheetNames) {
			const sheet = workbook.Sheets[name];
			if (!sheet) continue;
			const csv = XLSX.utils.sheet_to_csv(sheet, {
				blankrows: false,
				FS: '\t'
			});
			if (csv.trim().length === 0) continue;
			sheetTexts.push(`# Sheet: ${name}\n${csv.trim()}`);
		}

		const combined = sheetTexts.join('\n\n');
		return clampContent(normalizeLineEndings(combined));
	}

	return undefined;
}
