import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { listStoredUploads, upsertUploadMetadata } from '$lib/server/files/upload-store';

const originalCwd = process.cwd();
let testRoot = '';

beforeEach(async () => {
	testRoot = await mkdtemp(join(tmpdir(), 'rivo-upload-store-'));
	process.chdir(testRoot);
	await mkdir(join('static', 'uploads'), { recursive: true });
});

afterEach(async () => {
	process.chdir(originalCwd);
	if (testRoot) {
		await rm(testRoot, { recursive: true, force: true });
		testRoot = '';
	}
});

describe('upload-store metadata writes', () => {
	it('keeps originalName for concurrent uploads', async () => {
		const fixtures = [
			{
				url: '/uploads/a1.txt',
				storedName: 'a1.txt',
				originalName: 'budget-q1.txt'
			},
			{
				url: '/uploads/b2.txt',
				storedName: 'b2.txt',
				originalName: 'roadmap-notes.txt'
			},
			{
				url: '/uploads/c3.txt',
				storedName: 'c3.txt',
				originalName: 'meeting-summary.txt'
			}
		];

		await Promise.all(
			fixtures.map((item) =>
				writeFile(join('static', 'uploads', item.storedName), `content:${item.storedName}`)
			)
		);

		await Promise.all(
			fixtures.map((item, index) =>
				upsertUploadMetadata({
					url: item.url,
					originalName: item.originalName,
					contentType: 'text/plain',
					size: 100 + index,
					lastModified: Date.now() + index,
					hash: item.storedName.replace('.txt', '')
				})
			)
		);

		const files = await listStoredUploads();
		const originalNameByUrl = new Map(files.map((file) => [file.url, file.originalName]));

		for (const item of fixtures) {
			expect(originalNameByUrl.get(item.url)).toBe(item.originalName);
		}
	});
});
