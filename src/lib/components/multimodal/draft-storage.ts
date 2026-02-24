const CHAT_DRAFT_STORAGE_PREFIX = 'chat_input_draft';
const NEW_CHAT_DRAFT_ID = 'new';

export function getChatDraftStorageKey(chatId?: string | null): string {
	const normalizedChatId = typeof chatId === 'string' ? chatId.trim() : '';
	const draftId = normalizedChatId.length > 0 ? normalizedChatId : NEW_CHAT_DRAFT_ID;
	return `${CHAT_DRAFT_STORAGE_PREFIX}:${draftId}`;
}
