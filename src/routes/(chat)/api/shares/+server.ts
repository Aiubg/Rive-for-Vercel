import { getSharesByUserId } from '$lib/server/db/queries';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { handleServerError } from '$lib/server/utils';

export const GET: RequestHandler = async ({ locals: { user } }) => {
	if (!user) {
		throw error(401, 'common.unauthorized');
	}

	const sharesResult = await getSharesByUserId({ userId: user.id });

	return sharesResult.match(
		(shares) => json(shares),
		(err) => {
			handleServerError(err, 'common.internal_server_error', { userId: user.id });
		}
	);
};
