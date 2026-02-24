import { error, isHttpError } from '@sveltejs/kit';
import { getChatById, getShareById } from '$lib/server/db/queries';
import type { Chat, Share, User } from '$lib/server/db/schema';
import type { DbError } from '$lib/server/errors/db';
import { logger } from '$lib/utils/logger';
import type { Result } from 'neverthrow';
import type { ZodSchema } from 'zod';

async function verifyOwnership<T extends { userId: string }>(
	user: User | undefined,
	result: Result<T, DbError>
): Promise<T> {
	if (!user) {
		throw error(401, 'common.unauthorized');
	}

	if (result.isErr()) {
		if (result.error._tag === 'DbEntityNotFoundError') {
			throw error(404, 'common.not_found');
		}
		throw error(500, 'common.internal_server_error');
	}

	const entity = result.value;

	if (entity.userId !== user.id) {
		throw error(403, 'common.forbidden');
	}

	return entity;
}

export async function verifyChatOwnership({
	chatId,
	user
}: {
	chatId: string;
	user: User | undefined;
}): Promise<Chat> {
	const chatResult = await getChatById({ id: chatId });
	return verifyOwnership(user, chatResult);
}

export async function verifyShareOwnership({
	shareId,
	user
}: {
	shareId: string;
	user: User | undefined;
}): Promise<Share> {
	const shareResult = await getShareById({ id: shareId });
	return verifyOwnership(user, shareResult);
}

/**
 * Parses the JSON body of a request and validates it against a Zod schema.
 * Handles aborted requests by returning a 204 No Content response.
 * Throws a 400 Bad Request error if validation fails.
 *
 * @param request The incoming Request object
 * @param schema The Zod schema to validate against
 * @returns The parsed and validated data, or a Response (204) if aborted
 * @throws SvelteKit error (400) if JSON is invalid or validation fails
 */
export async function parseJsonBody<T>(
	request: Request,
	schema: ZodSchema<T>
): Promise<T | Response> {
	if (request.signal.aborted) {
		return new Response(null, { status: 204 });
	}

	let json: unknown;
	try {
		json = await request.json();
	} catch (e) {
		if (request.signal.aborted || (e instanceof Error && e.name === 'AbortError')) {
			return new Response(null, { status: 204 });
		}
		throw error(400, 'common.invalid_json');
	}

	try {
		return schema.parse(json);
	} catch (e) {
		logger.warn('JSON validation failed', { error: e, schema: schema.description });
		throw error(400, 'common.invalid_request_data');
	}
}

/**
 * Handles server-side errors by logging them and throwing a SvelteKit error.
 * If the error is already a SvelteKit error (e.g., from `error()`), it is re-thrown.
 */
export function handleServerError(
	e: unknown,
	message = 'common.unknown_error',
	logContext?: Record<string, unknown>,
	status: number = 500
): never {
	if (isHttpError(e)) {
		throw e;
	}

	logger.error(message, { ...logContext, error: e });
	throw error(status, message);
}
