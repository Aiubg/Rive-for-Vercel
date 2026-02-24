import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { allowAnonymousChats } from '$lib/utils/constants';
import { handleServerError } from '$lib/server/utils';
import { listStoredUploads } from '$lib/server/files/upload-store';

export const GET: RequestHandler = async ({ locals: { user } }) => {
	if (!user && !allowAnonymousChats) {
		throw error(401, 'common.unauthorized');
	}

	try {
		const files = await listStoredUploads();
		return json({ files });
	} catch (e) {
		handleServerError(e, 'upload.failed');
	}
};
