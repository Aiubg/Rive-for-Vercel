import type { Message as DBMessage, Chat } from '$lib/types/db';
import type { Attachment } from '$lib/types/attachment';
import type { UIMessageWithTree, MessagePart } from '$lib/types/message';
import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';

/**
 * Converts database messages to UI message format.
 */
export function convertToUIMessages(messages: Array<DBMessage>): UIMessageWithTree[] {
	return messages.map((message) => ({
		id: message.id,
		content: '',
		role: message.role,
		parts: message.parts as UIMessageWithTree['parts'],
		createdAt: message.createdAt,
		attachments: message.attachments,
		parentId: message.parentId
	}));
}

/**
 * Computes the default selected message IDs for each parent to form a path to the last message.
 */
export function computeDefaultSelectedMessageIds(
	messages: Array<UIMessageWithTree>
): Record<string, string> {
	if (messages.length === 0) return {};
	const newSelected: Record<string, string> = {};
	const messageMap = new Map(messages.map((m) => [m.id, m]));
	let current = messages[messages.length - 1];
	while (current) {
		const pid = current.parentId || 'root';
		if (!newSelected[pid]) {
			newSelected[pid] = current.id;
		}
		const currentParentId = current.parentId;
		if (!currentParentId) break;
		const parent = messageMap.get(currentParentId);
		if (!parent) break;
		current = parent;
	}
	return newSelected;
}

/**
 * Returns the path of messages from root to the end based on selected siblings.
 */
export function getMessagePath(
	messages: Array<UIMessageWithTree>,
	selectedMessageIds: Record<string, string>
): Array<UIMessageWithTree> {
	const messagesByParentId: Record<string, Array<UIMessageWithTree>> = {};
	messages.forEach((m) => {
		const pid = m.parentId || 'root';
		if (!messagesByParentId[pid]) messagesByParentId[pid] = [];
		messagesByParentId[pid].push(m);
	});

	const path: Array<UIMessageWithTree> = [];
	let currentParentId = 'root';

	while (messagesByParentId[currentParentId]) {
		const options = messagesByParentId[currentParentId];
		if (!options || options.length === 0) break;
		const selectedId = selectedMessageIds[currentParentId];
		const selectedMessage = selectedId ? options.find((m) => m.id === selectedId) : options[0];
		if (!selectedMessage) break;
		path.push(selectedMessage);
		currentParentId = selectedMessage.id;
	}

	return path;
}

function isUserMessage<T extends { role: string }>(message: T): message is T & { role: 'user' } {
	return message.role === 'user';
}

/**
 * Finds the most recent message with 'user' role.
 */
export function getMostRecentUserMessage<T extends { role: string }>(
	messages: Array<T>
): (T & { role: 'user' }) | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message && isUserMessage(message)) {
			return message;
		}
	}
	return undefined;
}

/**
 * Type guard to check if a message has attachments.
 */
export function hasAttachments(
	m: UIMessageWithTree
): m is UIMessageWithTree & { attachments: Attachment[] } {
	return Array.isArray(m.attachments);
}

/**
 * Extracts all plain text content from a message's parts.
 */
export function extractTextFromMessage(message: UIMessageWithTree) {
	if (!message.parts) return '';
	try {
		return message.parts
			.map((part: MessagePart) => {
				if (part.type === 'text') {
					return part.text ?? '';
				}
				return '';
			})
			.filter(Boolean)
			.join('\n')
			.trim();
	} catch (_) {
		return '';
	}
}

/**
 * Gets a preview text for a message, prioritizing text parts then reasoning/tools.
 */
export function getMessagePreviewText(message: UIMessageWithTree) {
	const text = extractTextFromMessage(message);
	if (text) return text;

	if (!message.parts) return '';

	try {
		const parts = message.parts;
		for (const part of parts) {
			if (part.type === 'reasoning' && part.text) {
				return part.text;
			}
			if (part.type === 'tool-invocation' || part.type === 'dynamic-tool') {
				const toolName = part.toolName || part.toolInvocation?.toolName;
				if (toolName) return `[${toolName}]`;
			}
		}
	} catch (_) {
		// ignore
	}

	return '';
}

export type GroupedChats = {
	pinned: Chat[];
	today: Chat[];
	yesterday: Chat[];
	lastWeek: Chat[];
	lastMonth: Chat[];
	older: Chat[];
};

/**
 * Groups chats into time-based categories (Today, Yesterday, etc.)
 */
export function groupChatsByDate(chats: Chat[]): GroupedChats {
	const now = new Date();
	const oneWeekAgo = subWeeks(now, 1);
	const oneMonthAgo = subMonths(now, 1);

	const groups: GroupedChats = {
		pinned: [],
		today: [],
		yesterday: [],
		lastWeek: [],
		lastMonth: [],
		older: []
	};

	for (const chat of chats) {
		if (chat.pinned) {
			groups.pinned.push(chat);
			continue;
		}

		const chatDate = new Date(chat.updatedAt);

		if (isToday(chatDate)) {
			groups.today.push(chat);
		} else if (isYesterday(chatDate)) {
			groups.yesterday.push(chat);
		} else if (chatDate > oneWeekAgo) {
			groups.lastWeek.push(chat);
		} else if (chatDate > oneMonthAgo) {
			groups.lastMonth.push(chat);
		} else {
			groups.older.push(chat);
		}
	}

	// Sort each group by updatedAt descending
	for (const key in groups) {
		groups[key as keyof GroupedChats].sort(
			(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		);
	}

	return groups;
}

/**
 * Enriches visible messages with sibling information for branching navigation.
 */
export function computeMessagesWithSiblings(
	messages: Array<UIMessageWithTree>,
	visibleMessages: Array<UIMessageWithTree>
) {
	const siblingsMap = new Map<string, string[]>();
	for (const m of messages) {
		const pid = m.parentId || 'root';
		if (!siblingsMap.has(pid)) {
			siblingsMap.set(pid, []);
		}
		siblingsMap.get(pid)!.push(m.id);
	}

	return visibleMessages.map((m) => {
		const pid = m.parentId || 'root';
		const siblings = siblingsMap.get(pid) || [m.id];
		return {
			message: m,
			siblings,
			currentIndex: siblings.indexOf(m.id)
		};
	});
}
