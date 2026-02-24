import { sequence } from '@sveltejs/kit/hooks';
import { handle as authHandle } from '$lib/server/auth/handle';
import { ensureRunRecovery } from '$lib/server/ai/run-recovery';
import { allowAnonymousChats } from '$lib/utils/constants';
import { initI18n } from '$lib/i18n';
import { type Handle, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';

initI18n();

const runRecoveryHandle: Handle = async ({ event, resolve }) => {
	await ensureRunRecovery();
	return resolve(event);
};

const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('referrer-policy', 'same-origin');
	response.headers.set(
		'permissions-policy',
		'geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()'
	);
	return response;
};

const gateHandle: Handle = async ({ event, resolve }) => {
	const p = event.url.pathname.toLowerCase();
	const isAuthPath = p.startsWith('/signin') || p.startsWith('/signup') || p.startsWith('/signout');
	const isSharePath = p.startsWith('/share/');
	const isFeedPath = p === '/feed.rss';

	if (dev && p === '/.well-known/appspecific/com.chrome.devtools.json') {
		return new Response('Go away, Chrome DevTools!', { status: 404 });
	}

	if (p.startsWith('/.well-known') || isSharePath || isFeedPath) {
		return resolve(event);
	}

	if (!allowAnonymousChats && !event.locals.user && !isAuthPath) {
		const accept = event.request.headers.get('accept') ?? '';
		if (accept.includes('text/html')) {
			throw redirect(302, '/signin');
		}
		if (p.startsWith('/api')) {
			return new Response(JSON.stringify({ message: 'common.unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		throw redirect(302, '/signin');
	}
	return resolve(event);
};

export const handle = sequence(runRecoveryHandle, securityHeadersHandle, authHandle, gateHandle);
