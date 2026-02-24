import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveRunChatIdsByUserId } from '$lib/server/db/queries';
import { handleServerError } from '$lib/server/utils';

export const GET: RequestHandler = async ({ locals: { user } }) => {
	if (!user) {
		throw error(401, 'common.unauthorized');
	}

	const res = await getActiveRunChatIdsByUserId({ userId: user.id });
	if (res.isErr()) {
		handleServerError(res.error, 'common.internal_server_error', { userId: user.id });
	}

	return new Response(JSON.stringify({ chatIds: res.value }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
