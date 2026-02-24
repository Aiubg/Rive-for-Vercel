import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { allowAnonymousChats } from '$lib/utils/constants';
import { handleServerError } from '$lib/server/utils';
import { getUploadPreview } from '$lib/server/files/upload-store';
import { UploadForbiddenError, UploadNotFoundError } from '$lib/server/errors/upload';

export const GET: RequestHandler = async ({ locals: { user }, url }) => {
	if (!user && !allowAnonymousChats) {
		throw error(401, 'common.unauthorized');
	}

	const uploadUrl = url.searchParams.get('url');
	if (!uploadUrl) {
		throw error(400, 'common.bad_request');
	}

	try {
		const preview = await getUploadPreview(uploadUrl);
		return json(preview);
	} catch (e) {
		if (e instanceof UploadForbiddenError) {
			throw error(403, 'common.forbidden');
		}
		if (e instanceof UploadNotFoundError) {
			throw error(404, 'common.not_found');
		}
		handleServerError(e, 'upload.failed');
	}
};
