import { updateChatUnreadById } from '$lib/server/db/queries';
import { verifyChatOwnership, handleServerError, parseJsonBody } from '$lib/server/utils';
import { ChatUnreadSchema } from '$lib/utils/zod';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { user } }) => {
	const parsed = await parseJsonBody(request, ChatUnreadSchema);
	if (parsed instanceof Response) {
		return parsed;
	}
	const { chatId, unread } = parsed;

	const ownedChat = await verifyChatOwnership({ chatId, user });

	return updateChatUnreadById({ chatId, userId: ownedChat.userId, unread }).match(
		() => new Response(null, { status: 204 }),
		(err) => {
			handleServerError(err, 'common.internal_server_error', { chatId, unread });
		}
	);
};
