import { createSession, generateSessionToken, setSessionTokenCookie } from '$lib/server/auth';
import { createAuthUser, getAuthUser } from '$lib/server/db/queries';
import type { AuthUser } from '$lib/server/db/schema';
import { DbEntityNotFoundError, DbInternalError } from '$lib/server/errors/db';
import { fail, redirect } from '@sveltejs/kit';
import { compare } from 'bcrypt-ts';
import { err, ok, safeTry } from 'neverthrow';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

type SqliteErrorWithCode = Error & { code?: string };

export const load: PageServerLoad = ({ locals }) => {
	if (locals.session) {
		throw redirect(307, '/');
	}
};

const emailSchema = z.string().email();
const passwordSchema = z.string().min(8);

export const actions: Actions = {
	default: async ({ request, params, cookies, url }) => {
		const formData = await request.formData();
		const rawEmail = formData.get('email');
		const email = emailSchema.safeParse(rawEmail);
		if (!email.success) {
			return fail(400, {
				success: false,
				message: 'auth.invalid_email',
				email: (rawEmail ?? undefined) as string | undefined
			} as const);
		}
		const password = passwordSchema.safeParse(formData.get('password'));
		if (!password.success) {
			return fail(400, { success: false, message: 'auth.invalid_password' } as const);
		}

		const actionResult = safeTry(async function* () {
			let user: AuthUser;
			if (params.authType === 'signup') {
				user = yield* createAuthUser(email.data, password.data);
			} else {
				user = yield* getAuthUser(email.data);
				const passwordIsCorrect = await compare(password.data, user.password);
				if (!passwordIsCorrect) {
					return err(undefined);
				}
			}

			const token = generateSessionToken();
			const session = yield* createSession(token, user.id);
			setSessionTokenCookie(cookies, token, session.expiresAt, url);
			return ok(undefined);
		});

		return actionResult.match(
			() => redirect(303, '/'),
			(error) => {
				if (params.authType === 'signin') {
					if (error instanceof DbEntityNotFoundError || error === undefined) {
						return fail(400, {
							success: false,
							message: 'auth.invalid_credentials'
						});
					}
					return fail(400, {
						success: false,
						message: 'auth.sign_in_failed'
					});
				}

				if (params.authType === 'signup') {
					if (
						error instanceof DbInternalError &&
						error.cause instanceof Error &&
						(error.cause as SqliteErrorWithCode).code === 'SQLITE_CONSTRAINT_UNIQUE'
					) {
						return fail(400, {
							success: false,
							message: 'auth.user_already_exists'
						});
					}
					return fail(400, {
						success: false,
						message: 'auth.sign_up_failed'
					});
				}

				return fail(400, {
					success: false,
					message: 'common.unknown_error'
				});
			}
		);
	}
};
