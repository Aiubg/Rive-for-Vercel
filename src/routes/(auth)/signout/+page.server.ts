import { deleteSessionTokenCookie, invalidateSession } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, cookies }) => {
	if (locals.session) {
		invalidateSession(locals.session.id);
		deleteSessionTokenCookie(cookies);
	}

	throw redirect(307, '/signin');
};
