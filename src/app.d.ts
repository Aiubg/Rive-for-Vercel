import type { Session, User } from '$lib/server/db/schema';

declare global {
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
		}
	}
}

declare module 'mode-watcher' {
	export * from 'mode-watcher/dist/index.js';
}

declare module 'svelte-exmarkdown' {
	interface SnippetRenderers {
		citation?: unknown;
	}
}

export {};
