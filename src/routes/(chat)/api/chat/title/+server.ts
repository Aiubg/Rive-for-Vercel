import { updateChatTitleById } from '$lib/server/db/queries';
import { verifyChatOwnership, handleServerError, parseJsonBody } from '$lib/server/utils';
import { ChatTitleSchema } from '$lib/utils/zod';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { user } }) => {
	const parsed = await parseJsonBody(request, ChatTitleSchema);
	if (parsed instanceof Response) {
		return parsed;
	}
	const { chatId, title } = parsed;

	await verifyChatOwnership({ chatId, user });

	return updateChatTitleById({ chatId, title }).match(
		() => new Response(null, { status: 204 }),
		(err) => {
			handleServerError(err, 'common.internal_server_error', { chatId, title });
		}
	);
};
