import { voteMessage } from '$lib/server/db/queries';
import { verifyChatOwnership, handleServerError, parseJsonBody } from '$lib/server/utils';
import { VoteSchema } from '$lib/utils/zod';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({
	locals: { user },
	params: { chatId, messageId },
	request
}) => {
	await verifyChatOwnership({ chatId, user });

	const parsed = await parseJsonBody(request, VoteSchema);
	if (parsed instanceof Response) {
		return parsed;
	}
	const { type } = parsed;
	return voteMessage({ chatId, messageId, type }).match(
		() => new Response(null, { status: 204 }),
		(err) => {
			handleServerError(err, 'common.internal_server_error', { chatId, messageId });
		}
	);
};
