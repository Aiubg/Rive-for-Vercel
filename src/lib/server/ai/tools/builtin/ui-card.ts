import { logger } from '$lib/utils/logger';
import type { ToolRecord } from '$lib/server/ai/tools/types';

type UiCardType = 'audio-player';

type UiCardArgs = {
	cardType?: UiCardType;
	audioUrl?: string;
	title?: string;
	artist?: string;
	sourceUrl?: string;
	coverUrl?: string;
	quality?: string;
	bitrate?: string;
	duration?: string;
	fileSize?: string;
};

const trimString = (value: unknown): string | undefined => {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

const isHttpUrl = (value: string | undefined): boolean => {
	if (!value) return false;
	try {
		const parsed = new URL(value);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
};

export const uiCardTool: ToolRecord = {
	definition: {
		name: 'ui_card',
		description:
			'Create explicit interactive UI cards in chat. This is a presentation tool (not a data source). Use it only when the user wants an in-chat interactive card. Currently supports cardType="audio-player".',
		parameters: {
			type: 'object',
			properties: {
				cardType: {
					type: 'string',
					enum: ['audio-player'],
					description:
						'The card type to render. Currently only "audio-player" is supported. More card types may be added later.'
				},
				audioUrl: {
					type: 'string',
					description:
						'Direct playable audio URL for cardType="audio-player". Must be an http/https URL.'
				},
				title: {
					type: 'string',
					description: 'Track title shown on the card.'
				},
				artist: {
					type: 'string',
					description: 'Artist/uploader shown on the card.'
				},
				sourceUrl: {
					type: 'string',
					description: 'Optional source page URL, e.g. Bilibili video URL.'
				},
				coverUrl: {
					type: 'string',
					description: 'Optional cover image URL.'
				},
				quality: {
					type: 'string',
					description: 'Optional quality label, e.g. 无损 FLAC.'
				},
				bitrate: {
					type: 'string',
					description: 'Optional bitrate label.'
				},
				duration: {
					type: 'string',
					description: 'Optional duration label.'
				},
				fileSize: {
					type: 'string',
					description: 'Optional file size label.'
				}
			},
			required: ['cardType']
		}
	},
	metadata: {
		tags: ['ui', 'card', 'interactive']
	},
	executor: async (args) => {
		const {
			cardType,
			audioUrl,
			title,
			artist,
			sourceUrl,
			coverUrl,
			quality,
			bitrate,
			duration,
			fileSize
		} = args as UiCardArgs;

		if (cardType !== 'audio-player') {
			return { error: 'Parameter "cardType" must be "audio-player".' };
		}

		const normalizedAudioUrl = trimString(audioUrl);
		const normalizedSourceUrl = trimString(sourceUrl);
		const normalizedCoverUrl = trimString(coverUrl);

		if (!isHttpUrl(normalizedAudioUrl)) {
			return { error: 'Parameter "audioUrl" must be a valid http/https URL.' };
		}
		if (normalizedSourceUrl && !isHttpUrl(normalizedSourceUrl)) {
			return { error: 'Parameter "sourceUrl" must be a valid http/https URL.' };
		}
		if (normalizedCoverUrl && !isHttpUrl(normalizedCoverUrl)) {
			return { error: 'Parameter "coverUrl" must be a valid http/https URL.' };
		}

		const card = {
			type: cardType,
			audioUrl: normalizedAudioUrl,
			title: trimString(title),
			artist: trimString(artist),
			sourceUrl: normalizedSourceUrl,
			coverUrl: normalizedCoverUrl,
			quality: trimString(quality),
			bitrate: trimString(bitrate),
			duration: trimString(duration),
			fileSize: trimString(fileSize)
		};

		logger.debug('[ui_card] card created', {
			cardType: card.type,
			title: card.title,
			audioUrl: card.audioUrl
		});

		return { card };
	}
};
