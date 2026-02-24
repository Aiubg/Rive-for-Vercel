import { describe, expect, it } from 'vitest';
import { uiCardTool } from '$lib/server/ai/tools/builtin/ui-card';
import type { ToolContext } from '$lib/server/ai/tools/types';

const defaultContext: ToolContext = {
	env: 'dev'
};

describe('ui_card tool', () => {
	it('creates an audio-player card', async () => {
		const result = (await uiCardTool.executor(
			{
				cardType: 'audio-player',
				audioUrl: 'https://cdn.example.com/audio/song.mp3',
				title: 'Blue Sky',
				artist: 'Rivo Band',
				sourceUrl: 'https://www.bilibili.com/video/BV1abc',
				quality: 'high',
				bitrate: '320 kbps',
				duration: '03:20'
			},
			defaultContext
		)) as {
			error?: string;
			status?: string;
			card?: {
				type?: string;
				audioUrl?: string;
				title?: string;
				artist?: string;
				sourceUrl?: string;
				quality?: string;
			};
		};

		expect(result.error).toBeUndefined();
		expect(result.status).toBe('created');
		expect(result.card?.type).toBe('audio-player');
		expect(result.card?.audioUrl).toBe('https://cdn.example.com/audio/song.mp3');
		expect(result.card?.title).toBe('Blue Sky');
		expect(result.card?.artist).toBe('Rivo Band');
		expect(result.card?.sourceUrl).toBe('https://www.bilibili.com/video/BV1abc');
		expect(result.card?.quality).toBe('high');
	});

	it('rejects unsupported card type', async () => {
		const result = (await uiCardTool.executor(
			{
				cardType: 'weather' as never,
				audioUrl: 'https://cdn.example.com/audio/song.mp3'
			},
			defaultContext
		)) as { error?: string };

		expect(result.error).toBe('Parameter "cardType" must be "audio-player".');
	});

	it('rejects invalid audio URL', async () => {
		const result = (await uiCardTool.executor(
			{
				cardType: 'audio-player',
				audioUrl: 'not-a-url'
			},
			defaultContext
		)) as { error?: string };

		expect(result.error).toBe('Parameter "audioUrl" must be a valid http/https URL.');
	});
});
