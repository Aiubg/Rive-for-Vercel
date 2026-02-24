import { deleteShareById } from '$lib/server/db/queries';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { handleServerError, verifyShareOwnership } from '$lib/server/utils';

export const DELETE: RequestHandler = async ({ params, locals: { user } }) => {
	const { shareId } = params;
	if (!shareId) {
		throw error(400, 'common.bad_request');
	}

	await verifyShareOwnership({ shareId, user });

	const deleteResult = await deleteShareById({ id: shareId });

	return deleteResult.match(
		() => new Response(null, { status: 204 }),
		(err) => {
			handleServerError(err, 'share.revoke_failed', { shareId });
		}
	);
};
