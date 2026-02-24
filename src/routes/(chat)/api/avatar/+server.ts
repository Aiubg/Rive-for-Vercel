import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ fetch, url }) => {
	const name = url.searchParams.get('name') ?? 'U';
	const background = url.searchParams.get('background') ?? 'random';

	if (name.length > 200) {
		throw error(400, 'common.bad_request');
	}
	if (background.length > 32 || !/^[a-zA-Z0-9#_-]+$/.test(background)) {
		throw error(400, 'common.bad_request');
	}

	const upstreamUrl = new URL('https://ui-avatars.com/api/');
	upstreamUrl.searchParams.set('name', name);
	upstreamUrl.searchParams.set('background', background);

	let upstreamResponse: Response;
	try {
		upstreamResponse = await fetch(upstreamUrl, { signal: AbortSignal.timeout(10_000) });
	} catch {
		throw error(504, 'common.request_failed');
	}
	const contentType = upstreamResponse.headers.get('content-type') ?? 'image/png';
	const body = await upstreamResponse.arrayBuffer();

	return new Response(body, {
		status: upstreamResponse.status,
		headers: {
			'content-type': contentType,
			'cache-control': 'public, max-age=86400'
		}
	});
};
