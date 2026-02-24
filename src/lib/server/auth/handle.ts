import { logger } from '$lib/utils/logger';
import type { Handle } from '@sveltejs/kit';
import {
	deleteSessionTokenCookie,
	getSessionCookie,
	setSessionTokenCookie,
	validateSessionToken
} from '.';

export const handle: Handle = async ({ event, resolve }) => {
	const token = getSessionCookie(event);
	if (!token) {
		return resolve(event);
	}

	const validatedTokenResult = await validateSessionToken(token);
	if (validatedTokenResult.isErr()) {
		logger.error('Session validation failed', validatedTokenResult.error);
	} else {
		const { session, user } = validatedTokenResult.value;
		if (session) {
			setSessionTokenCookie(event.cookies, token, session.expiresAt, event.url);
			event.locals.session = session;
			event.locals.user = user;
		} else {
			deleteSessionTokenCookie(event.cookies);
		}
	}

	return resolve(event);
};
