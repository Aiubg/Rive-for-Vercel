import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import { sha256 } from '@oslojs/crypto/sha2';
import type { Session, User } from '$lib/server/db/schema';
import {
	createSession as createSessionDb,
	deleteSession,
	deleteSessionsForUser,
	extendSession,
	getFullSession
} from '$lib/server/db/queries';
import { ok, type ResultAsync, safeTry } from 'neverthrow';
import type { DbError } from '$lib/server/errors/db';
import ms from 'ms';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/environment';

export function generateSessionToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const token = encodeBase32LowerCaseNoPadding(bytes);
	return token;
}

export function createSession(token: string, userId: string): ResultAsync<Session, DbError> {
	return safeTry(async function* () {
		const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
		const session: Session = {
			id: sessionId,
			userId,
			expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
		};
		yield* createSessionDb(session);
		return ok(session);
	});
}

export function validateSessionToken(token: string): ResultAsync<SessionValidationResult, DbError> {
	return safeTry(async function* () {
		const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
		const { user, session } = yield* getFullSession(sessionId);
		if (Date.now() >= session.expiresAt.getTime()) {
			yield* deleteSession(sessionId);
			return ok({ session: null, user: null });
		}
		if (Date.now() >= session.expiresAt.getTime() - ms('15d')) {
			yield* extendSession(sessionId);
		}
		return ok({ session, user });
	});
}

export function invalidateSession(sessionId: string): ResultAsync<undefined, DbError> {
	return deleteSession(sessionId);
}

export function invalidateAllSessions(userId: string): ResultAsync<undefined, DbError> {
	return deleteSessionsForUser(userId);
}

export function getSessionCookie(event: RequestEvent): string | undefined {
	return event.cookies.get('session');
}

export function setSessionTokenCookie(
	cookies: Cookies,
	token: string,
	expiresAt: Date,
	url?: URL
): void {
	const secure = dev ? url?.protocol === 'https:' : true;
	// Defensive check: ensure expiresAt is a valid date
	const expires = new Date(expiresAt);
	if (isNaN(expires.getTime())) {
		// Fallback to 30 days if invalid
		expires.setTime(Date.now() + 1000 * 60 * 60 * 24 * 30);
	}

	cookies.set('session', token, {
		httpOnly: true,
		secure,
		sameSite: 'lax',
		expires,
		path: '/'
	});
}

export function deleteSessionTokenCookie(cookies: Cookies): void {
	cookies.delete('session', {
		path: '/'
	});
}

export type SessionValidationResult =
	| { session: Session; user: User }
	| { session: null; user: null };
