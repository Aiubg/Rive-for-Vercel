import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { handleServerError, parseJsonBody } from '$lib/server/utils';
import { allowAnonymousChats } from '$lib/utils/constants';
import { DeleteFileSchema } from '$lib/utils/zod';
import { parseUploadUrl, removeStoredUploadByUrl } from '$lib/server/files/upload-store';

export const DELETE: RequestHandler = async ({ request, locals: { user } }) => {
	if (!user && !allowAnonymousChats) {
		throw error(401, 'common.unauthorized');
	}

	try {
		const parsed = await parseJsonBody(request, DeleteFileSchema);
		if (parsed instanceof Response) {
			return parsed;
		}
		const { url } = parsed;

		const fileName = parseUploadUrl(url);
		if (!fileName) {
			throw error(403, 'common.forbidden');
		}

		await removeStoredUploadByUrl(url);

		return json({ success: true });
	} catch (e) {
		handleServerError(e, 'upload.delete_failed');
	}
};
