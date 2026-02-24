import { getVotesByChatId } from '$lib/server/db/queries';
import { verifyChatOwnership, handleServerError } from '$lib/server/utils';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals: { user }, params: { chatId } }) => {
	await verifyChatOwnership({ chatId, user });

	return getVotesByChatId({ id: chatId }).match(
		(votes) => json(votes),
		(err) => {
			handleServerError(err, 'common.internal_server_error', { chatId });
		}
	);
};
