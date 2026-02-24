import { createShare, getShareByChatId } from '$lib/server/db/queries';
import { verifyChatOwnership, handleServerError, parseJsonBody } from '$lib/server/utils';
import { error, json } from '@sveltejs/kit';
import { ShareChatSchema } from '$lib/utils/zod';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { user } }) => {
	const chatId = url.searchParams.get('chatId');
	if (!chatId) {
		throw error(400, 'common.bad_request');
	}

	await verifyChatOwnership({ chatId, user });

	const shareResult = await getShareByChatId({ chatId });

	return shareResult.match(
		(share) => json(share),
		(err) => {
			if (err._tag === 'DbEntityNotFoundError') {
				return json(null);
			}
			handleServerError(err, 'share.load_failed', { chatId });
		}
	);
};

export const POST: RequestHandler = async ({ request, locals: { user } }) => {
	const parsed = await parseJsonBody(request, ShareChatSchema);
	if (parsed instanceof Response) {
		return parsed;
	}
	const { chatId } = parsed;

	await verifyChatOwnership({ chatId, user });

	// Check if share already exists
	const existingShare = await getShareByChatId({ chatId });
	if (existingShare.isOk()) {
		return json(existingShare.value);
	}
	if (existingShare.error._tag !== 'DbEntityNotFoundError') {
		handleServerError(existingShare.error, 'share.load_failed', { chatId });
	}

	const shareId = crypto.randomUUID();
	const createResult = await createShare({
		id: shareId,
		chatId,
		userId: user!.id
	});

	return createResult.match(
		(share) => json(share),
		(err) => {
			handleServerError(err, 'share.generate_failed', { chatId, shareId });
		}
	);
};
