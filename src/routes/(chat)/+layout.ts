import type { Chat } from '$lib/types/db';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, fetch }) => {
	const { user } = data;
	let chats = Promise.resolve<Chat[]>([]);
	if (user) {
		chats = fetch('/api/history')
			.then((res) => (res.ok ? res.json() : []))
			.catch(() => []);
	}
	return {
		chats,
		...data
	};
};
