import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { allowAnonymousChats } from '$lib/utils/constants';
import { listStoredUploads } from '$lib/server/files/upload-store';
import { handleServerError } from '$lib/server/utils';

export const load: PageServerLoad = async ({ locals: { user } }) => {
	if (!user && !allowAnonymousChats) {
		throw error(401, 'common.unauthorized');
	}

	try {
		const files = await listStoredUploads();
		return { files };
	} catch (e) {
		handleServerError(e, 'upload.failed');
	}
};
