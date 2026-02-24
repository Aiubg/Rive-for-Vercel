import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { allowAnonymousChats } from '$lib/utils/constants';
import { handleServerError, parseJsonBody } from '$lib/server/utils';
import { RenameFileSchema } from '$lib/utils/zod';
import { parseUploadUrl, renameUploadMetadata } from '$lib/server/files/upload-store';

export const PATCH: RequestHandler = async ({ request, locals: { user } }) => {
	if (!user && !allowAnonymousChats) {
		throw error(401, 'common.unauthorized');
	}

	try {
		const parsed = await parseJsonBody(request, RenameFileSchema);
		if (parsed instanceof Response) {
			return parsed;
		}
		const { url, name } = parsed;

		if (!parseUploadUrl(url)) {
			throw error(403, 'common.forbidden');
		}

		await renameUploadMetadata(url, name);
		return json({ success: true });
	} catch (e) {
		handleServerError(e, 'upload.failed');
	}
};
