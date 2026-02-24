import { deleteAllChatsByUserId, getChatsByUserId } from '$lib/server/db/queries';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { handleServerError } from '$lib/server/utils';

export const GET: RequestHandler = async ({ locals: { user } }) => {
	if (!user) {
		throw error(401, 'common.unauthorized');
	}

	return await getChatsByUserId({ id: user.id }).match(
		(chats) => json(chats),
		(err) => {
			handleServerError(err, 'common.internal_server_error', { userId: user.id });
		}
	);
};

export const DELETE: RequestHandler = async ({ locals: { user } }) => {
	if (!user) {
		throw error(401, 'common.unauthorized');
	}

	return await deleteAllChatsByUserId({ userId: user.id }).match(
		() => new Response(null, { status: 204 }),
		(err) => {
			handleServerError(err, 'common.internal_server_error', { userId: user.id });
		}
	);
};
