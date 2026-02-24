import { chatModels } from '$lib/ai/model-registry';
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import { SynchronizedCookieSchema } from '$lib/utils/zod';
import { parseJsonBody } from '$lib/server/utils';

export const POST: RequestHandler = async ({ params, cookies, request, url }) => {
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) {
		throw error(403, 'common.forbidden');
	}

	const parsed = await parseJsonBody(request, SynchronizedCookieSchema);
	if (parsed instanceof Response) {
		return parsed;
	}
	const { value } = parsed;
	switch (params.cookieName) {
		case 'selected-model':
			if (!chatModels.find((model) => model.id === value)) {
				throw error(400, 'models.invalid_model');
			}
			break;
		default: {
			throw error(404, 'common.not_found');
		}
	}

	cookies.set(params.cookieName, value, {
		path: '/',
		sameSite: 'lax',
		expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
		httpOnly: true,
		secure: dev ? url.protocol === 'https:' : true
	});
	return new Response(null, {
		status: 200
	});
};
