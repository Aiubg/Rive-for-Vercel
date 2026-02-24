import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchChats } from '$lib/server/db/queries';
import { handleServerError } from '$lib/server/utils';

export const GET: RequestHandler = async ({ url, locals }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'common.unauthorized');
	}

	const rawQ = url.searchParams.get('q');
	const q = typeof rawQ === 'string' ? rawQ.trim() : '';
	if (!q) {
		return json({ results: [] });
	}
	if (q.length > 200) {
		throw error(400, 'chat.search_query_too_long');
	}

	const searchResult = await searchChats({ userId: user.id, query: q });

	if (searchResult.isErr()) {
		handleServerError(searchResult.error, 'common.internal_server_error', { userId: user.id, q });
	}

	return json({ results: searchResult.value });
};
