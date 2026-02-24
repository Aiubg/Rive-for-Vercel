import { ActiveRunQuerySchema } from '$lib/utils/zod';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveGenerationRunByChatId } from '$lib/server/db/queries';
import { handleServerError } from '$lib/server/utils';

export const GET: RequestHandler = async ({ url, locals: { user } }) => {
	if (!user) {
		throw error(401, 'common.unauthorized');
	}

	const { chatId } = ActiveRunQuerySchema.parse({
		chatId: url.searchParams.get('chatId') ?? ''
	});

	const runRes = await getActiveGenerationRunByChatId({ chatId, userId: user.id });
	if (runRes.isErr()) {
		handleServerError(runRes.error, 'common.internal_server_error', { chatId });
	}

	const run = runRes.value;
	return new Response(JSON.stringify({ run }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
