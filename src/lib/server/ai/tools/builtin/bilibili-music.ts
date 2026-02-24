import { logger } from '$lib/utils/logger';
import type { ToolRecord } from '$lib/server/ai/tools/types';

type BilibiliAction = 'search' | 'media' | 'rank_categories' | 'rank_list';

type RawBilibiliResponse = {
	code?: unknown;
	message?: unknown;
	error?: unknown;
	data?: unknown;
	time?: unknown;
	tips?: unknown;
};

type ApiResult =
	| { ok: true; payload: RawBilibiliResponse }
	| { ok: false; error: string; status?: number };

const BILIBILI_MUSIC_API_URL = 'https://api.cenguigui.cn/api/bilibili/bilibili.php';

const toRecord = (value: unknown): Record<string, unknown> | null => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
};

const toStringValue = (value: unknown): string | undefined => {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed === '' ? undefined : trimmed;
	}
	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(value);
	}
	return undefined;
};

const toNumberValue = (value: unknown): number | undefined => {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return undefined;
};

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
	const parsed = toNumberValue(value);
	if (parsed === undefined) return fallback;
	const int = Math.trunc(parsed);
	if (int < min) return min;
	if (int > max) return max;
	return int;
};

const extractApiError = (payload: RawBilibiliResponse): string => {
	const errorText = toStringValue(payload.error);
	if (errorText) return errorText;

	const messageText = toStringValue(payload.message);
	if (messageText) return messageText;

	return 'Bilibili music API request failed.';
};

const callBilibiliApi = async (params: Record<string, string>): Promise<ApiResult> => {
	const url = new URL(BILIBILI_MUSIC_API_URL);
	for (const [key, value] of Object.entries(params)) {
		if (value.trim() === '') continue;
		url.searchParams.set(key, value);
	}

	try {
		const response = await fetch(url.toString(), {
			method: 'GET'
		});

		if (!response.ok) {
			const body = await response.text();
			logger.error('[bilibili_music] upstream http error', {
				status: response.status,
				body
			});
			return {
				ok: false,
				error: `Bilibili music API HTTP error: ${response.status}`,
				status: response.status
			};
		}

		const payload = (await response.json()) as RawBilibiliResponse;
		const code = toNumberValue(payload.code);
		if (code !== 200) {
			return { ok: false, error: extractApiError(payload), status: code };
		}

		return { ok: true, payload };
	} catch (error) {
		logger.error('[bilibili_music] execution failed', error);
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
};

const normalizeTrack = (value: unknown) => {
	const record = toRecord(value);
	if (!record) return null;

	const item = {
		title: toStringValue(record.title),
		artist: toStringValue(record.artist),
		bvid: toStringValue(record.bvid),
		aid: toStringValue(record.aid),
		duration: toStringValue(record.duration),
		sourceUrl: toStringValue(record.link),
		coverUrl: toStringValue(record.pic)
	};

	if (!item.title || (!item.bvid && !item.aid)) return null;
	return item;
};

const normalizeTracks = (value: unknown) => {
	if (!Array.isArray(value)) return [];
	return value.map((item) => normalizeTrack(item)).filter((item) => item !== null);
};

const normalizeMedia = (value: unknown) => {
	const record = toRecord(value);
	if (!record) return null;

	return {
		audioUrl: toStringValue(record.url),
		quality: toStringValue(record.quality),
		bitrate: toStringValue(record.bitrate),
		duration: toStringValue(record.duration),
		fileSize: toStringValue(record.file_size)
	};
};

const normalizeCategories = (value: unknown) => {
	if (!Array.isArray(value)) return [];

	return value
		.map((item) => {
			const record = toRecord(item);
			if (!record) return null;
			const category = toStringValue(record.name) ?? toStringValue(record.key);
			if (!category) return null;
			return category;
		})
		.filter((item) => item !== null);
};

export const bilibiliMusicTool: ToolRecord = {
	definition: {
		name: 'bilibili_music',
		description:
			'Fetch Bilibili music/video metadata and direct playable media links only. This tool does not create UI player cards. For playback requests, first search for a track, then call operation=media with bvid/aid to get a direct playable URL.',
		parameters: {
			type: 'object',
			properties: {
				operation: {
					type: 'string',
					enum: ['search', 'media', 'rank_categories', 'rank_list'],
					description:
						'Operation to perform. search=keyword lookup, media=get playback URL, rank_categories=list leaderboard categories, rank_list=get leaderboard content.'
				},
				query: {
					type: 'string',
					description: 'Search keyword for music/video content. Required when operation=search.'
				},
				page: {
					type: 'number',
					description: 'Result page for search (1-50).',
					default: 1,
					minimum: 1,
					maximum: 50
				},
				limit: {
					type: 'number',
					description: 'Maximum number of search results (1-30).',
					default: 10,
					minimum: 1,
					maximum: 30
				},
				type: {
					type: 'string',
					description: 'Search type filter, defaults to "music".',
					default: 'music'
				},
				bvid: {
					type: 'string',
					description: 'Bilibili BV id. Required for operation=media when aid is not provided.'
				},
				aid: {
					oneOf: [{ type: 'string' }, { type: 'number' }],
					description: 'Bilibili AV id. Required for operation=media when bvid is not provided.'
				},
				quality: {
					type: 'string',
					description: 'Media quality hint (for example: standard, high, flac).',
					default: 'high'
				},
				category: {
					type: 'string',
					description:
						'Leaderboard category in Chinese, for example: 音乐. Required when operation=rank_list.'
				},
				maxItems: {
					type: 'number',
					description: 'Maximum number of rank items returned locally (1-100).',
					default: 20,
					minimum: 1,
					maximum: 100
				}
			},
			required: ['operation']
		}
	},
	metadata: {
		tags: ['music', 'media', 'bilibili']
	},
	executor: async (args) => {
		const { operation, query, page, limit, type, bvid, aid, quality, category, maxItems } =
			args as {
				operation?: BilibiliAction;
				query?: string;
				page?: number;
				limit?: number;
				type?: string;
				bvid?: string;
				aid?: string | number;
				quality?: string;
				category?: string;
				maxItems?: number;
			};

		logger.debug('[bilibili_music] operation', {
			operation,
			query,
			page,
			limit,
			type,
			bvid,
			aid,
			quality,
			category,
			maxItems
		});

		switch (operation) {
			case 'search': {
				const keyword = typeof query === 'string' ? query.trim() : '';
				if (keyword === '') {
					return { error: 'Parameter "query" is required when operation=search.' };
				}

				const pageValue = clampInt(page, 1, 1, 50);
				const limitValue = clampInt(limit, 10, 1, 30);
				const typeValue = typeof type === 'string' && type.trim() !== '' ? type.trim() : 'music';

				const result = await callBilibiliApi({
					action: 'search',
					query: keyword,
					page: String(pageValue),
					limit: String(limitValue),
					type: typeValue
				});

				if (!result.ok) {
					return { error: result.error, status: result.status };
				}

				const tracks = normalizeTracks(result.payload.data);
				return {
					results: tracks
				};
			}
			case 'media': {
				const bvidValue = typeof bvid === 'string' ? bvid.trim() : '';
				const aidValue = toStringValue(aid);

				if (bvidValue === '' && !aidValue) {
					return { error: 'Either "bvid" or "aid" is required when operation=media.' };
				}

				const qualityValue =
					typeof quality === 'string' && quality.trim() !== '' ? quality.trim() : 'high';

				const result = await callBilibiliApi({
					action: 'media',
					...(bvidValue !== '' ? { bvid: bvidValue } : {}),
					...(aidValue ? { aid: aidValue } : {}),
					quality: qualityValue
				});

				if (!result.ok) {
					return { error: result.error, status: result.status };
				}

				const media = normalizeMedia(result.payload.data);
				if (!media?.audioUrl) {
					return { error: 'No playable audio URL found for this media request.' };
				}

				return media;
			}
			case 'rank_categories': {
				const result = await callBilibiliApi({ action: 'rank_categories' });
				if (!result.ok) {
					return { error: result.error, status: result.status };
				}

				return {
					categories: normalizeCategories(result.payload.data)
				};
			}
			case 'rank_list': {
				const categoryValue = typeof category === 'string' ? category.trim() : '';
				if (categoryValue === '') {
					return { error: 'Parameter "category" is required when operation=rank_list.' };
				}

				const maxItemsValue = clampInt(maxItems, 20, 1, 100);
				const result = await callBilibiliApi({
					action: 'rank_list',
					category: categoryValue
				});
				if (!result.ok) {
					return { error: result.error, status: result.status };
				}

				const allItems = normalizeTracks(result.payload.data);
				return {
					results: allItems.slice(0, maxItemsValue)
				};
			}
			default:
				return {
					error: 'Parameter "operation" must be one of: search, media, rank_categories, rank_list.'
				};
		}
	}
};
