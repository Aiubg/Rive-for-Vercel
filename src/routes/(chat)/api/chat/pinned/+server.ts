import { updateChatPinnedById } from '$lib/server/db/queries';
import { verifyChatOwnership, handleServerError, parseJsonBody } from '$lib/server/utils';
import { PinnedSchema } from '$lib/utils/zod';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { user } }) => {
	const parsed = await parseJsonBody(request, PinnedSchema);
	if (parsed instanceof Response) {
		return parsed;
	}
	const { chatId, pinned } = parsed;

	await verifyChatOwnership({ chatId, user });

	return updateChatPinnedById({ chatId, pinned }).match(
		() => new Response(null, { status: 204 }),
		(err) => {
			handleServerError(err, 'common.internal_server_error', { chatId, pinned });
		}
	);
};
