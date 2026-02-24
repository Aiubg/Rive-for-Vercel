import { describe, expect, it } from 'vitest';
import { getChatDraftStorageKey } from '$lib/components/multimodal/draft-storage';

describe('getChatDraftStorageKey', () => {
	it('uses chat id for existing conversation drafts', () => {
		expect(getChatDraftStorageKey('chat-123')).toBe('chat_input_draft:chat-123');
	});

	it('falls back to the new chat draft bucket when chat id is missing', () => {
		expect(getChatDraftStorageKey()).toBe('chat_input_draft:new');
		expect(getChatDraftStorageKey(null)).toBe('chat_input_draft:new');
		expect(getChatDraftStorageKey('')).toBe('chat_input_draft:new');
		expect(getChatDraftStorageKey('   ')).toBe('chat_input_draft:new');
	});
});
