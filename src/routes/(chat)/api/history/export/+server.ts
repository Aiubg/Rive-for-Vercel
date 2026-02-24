import { getChatsByUserId, getMessagesByChatIds } from '$lib/server/db/queries';
import { handleServerError } from '$lib/server/utils';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type ExportMessage = {
	id: string;
	role: string;
	parentId: string | null;
	parts: unknown;
	attachments: unknown;
	createdAt: string;
};

type ExportChat = {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	visibility: string;
	pinned: boolean;
	messages: ExportMessage[];
};

export const GET: RequestHandler = async ({ locals: { user } }) => {
	if (!user) {
		throw error(401, 'common.unauthorized');
	}

	const chatsRes = await getChatsByUserId({ id: user.id });
	if (chatsRes.isErr()) {
		handleServerError(chatsRes.error, 'common.internal_server_error', { userId: user.id });
	}

	const chats = chatsRes.value;
	const chatIds = chats.map((chat) => chat.id);
	const allMessagesRes = await getMessagesByChatIds({ chatIds });
	if (allMessagesRes.isErr()) {
		handleServerError(allMessagesRes.error, 'common.internal_server_error', { userId: user.id });
	}

	const messagesByChatId = new Map<string, ExportMessage[]>();
	for (const msg of allMessagesRes.value) {
		const mapped: ExportMessage = {
			id: msg.id,
			role: msg.role,
			parentId: msg.parentId ?? null,
			parts: msg.parts,
			attachments: msg.attachments,
			createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : String(msg.createdAt)
		};

		const bucket = messagesByChatId.get(msg.chatId);
		if (bucket) {
			bucket.push(mapped);
		} else {
			messagesByChatId.set(msg.chatId, [mapped]);
		}
	}

	const exportChats: ExportChat[] = [];

	for (const chat of chats) {
		exportChats.push({
			id: chat.id,
			title: chat.title,
			createdAt:
				chat.createdAt instanceof Date ? chat.createdAt.toISOString() : String(chat.createdAt),
			updatedAt:
				chat.updatedAt instanceof Date ? chat.updatedAt.toISOString() : String(chat.updatedAt),
			visibility: chat.visibility,
			pinned: !!chat.pinned,
			messages: messagesByChatId.get(chat.id) ?? []
		});
	}

	const exportPayload = {
		version: 1,
		exportedAt: new Date().toISOString(),
		userId: user.id,
		chats: exportChats
	};

	const dateStamp = new Date().toISOString().slice(0, 10);
	const filename = `rivo-chats-${dateStamp}.json`;

	return new Response(JSON.stringify(exportPayload, null, 2), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
