import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { handleServerError, parseJsonBody } from '$lib/server/utils';
import { getUserById, updateUserProfile } from '$lib/server/db/queries';
import { UpdateProfileSchema } from '$lib/utils/zod';

export const GET: RequestHandler = async ({ locals: { user } }) => {
	if (!user) {
		throw error(401, 'common.unauthorized');
	}

	return await getUserById(user.id).match(
		(profile) =>
			json({
				id: profile.id,
				email: profile.email,
				displayName: profile.displayName ?? null,
				avatarUrl: profile.avatarUrl ?? null
			}),
		(err) => {
			handleServerError(err, 'common.internal_server_error', { userId: user.id });
		}
	);
};

export const PATCH: RequestHandler = async ({ locals: { user }, request }) => {
	if (!user) {
		throw error(401, 'common.unauthorized');
	}

	try {
		const parsed = await parseJsonBody(request, UpdateProfileSchema);
		if (parsed instanceof Response) {
			return parsed;
		}

		let displayName: string | null | undefined;
		if (parsed.displayName === null) {
			displayName = null;
		} else if (typeof parsed.displayName === 'string') {
			const trimmed = parsed.displayName.trim();
			displayName = trimmed.length > 0 ? trimmed : null;
		}

		let avatarUrl: string | null | undefined;
		if (parsed.avatarUrl === null) {
			avatarUrl = null;
		} else if (typeof parsed.avatarUrl === 'string') {
			const trimmed = parsed.avatarUrl.trim();
			avatarUrl = trimmed.length > 0 ? trimmed : null;
		}

		return await updateUserProfile({
			userId: user.id,
			displayName,
			avatarUrl
		}).match(
			(updated) =>
				json({
					id: updated.id,
					email: updated.email,
					displayName: updated.displayName ?? null,
					avatarUrl: updated.avatarUrl ?? null
				}),
			(err) => {
				handleServerError(err, 'common.internal_server_error', { userId: user.id });
			}
		);
	} catch (e) {
		handleServerError(e, 'common.internal_server_error', { userId: user.id });
	}
};
