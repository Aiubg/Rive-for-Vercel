import { logger } from '$lib/utils/logger';
import { genSalt, hash as bcryptHash } from 'bcrypt-ts';
import { and, asc, desc, eq as rawEq, gte, inArray, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '$env/dynamic/private';
import { err, type ResultAsync, fromPromise, ok, safeTry } from 'neverthrow';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import {
	user,
	chat,
	type User,
	type Message,
	message,
	vote,
	type Session,
	session,
	type AuthUser,
	type Chat,
	type Vote,
	share,
	type Share,
	generationRun,
	type GenerationRun,
	runEvent,
	type RunEvent
} from '$lib/server/db/schema';
import type { DbError } from '$lib/server/errors/db';
import { DbInternalError } from '$lib/server/errors/db';
import ms from 'ms';
import { unwrapSingleQueryResult } from '$lib/server/db/utils';

const LIBSQL_URL = env.LIBSQL_URL;
const LIBSQL_AUTH_TOKEN = env.LIBSQL_AUTH_TOKEN;

const require = createRequire(import.meta.url);

function buildLibsqlUrl(value: string | undefined) {
	const raw = (value ?? 'file:./data/app.db').trim();
	if (raw.startsWith('libsql://') || raw.startsWith('file:')) return raw;
	return pathToFileURL(path.resolve(raw)).href;
}

let cachedDb: ReturnType<typeof drizzle> | null = null;
function getDb() {
	if (cachedDb) return cachedDb;

	try {
		const url = buildLibsqlUrl(LIBSQL_URL);

		if (url.startsWith('file:')) {
			const dbPath = url.slice(5);
			const dbDir = path.dirname(dbPath);
			if (!fs.existsSync(dbDir)) {
				fs.mkdirSync(dbDir, { recursive: true });
			}
		}

		const libsql = require('@libsql/client') as typeof import('@libsql/client');
		const client = libsql.createClient({
			url,
			authToken: LIBSQL_AUTH_TOKEN
		});
		void client.execute('PRAGMA foreign_keys=ON').catch((e) => {
			logger.error('Failed to enable foreign keys', e);
		});
		cachedDb = drizzle(client);
		return cachedDb;
	} catch (e) {
		throw new DbInternalError({ cause: e });
	}
}

const db = new Proxy({} as unknown as ReturnType<typeof drizzle>, {
	get(_target, prop) {
		return (getDb() as unknown as Record<PropertyKey, unknown>)[prop] as never;
	}
});

function eq(left: unknown, right: unknown) {
	return rawEq(left as never, right as never);
}

function isMissingUnreadColumnError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
	return (
		message.toLowerCase().includes('no such column') && message.toLowerCase().includes('unread')
	);
}

export function getAuthUser(email: string): ResultAsync<AuthUser, DbError> {
	return safeTry(async function* () {
		const userResult = yield* fromPromise(
			db.select().from(user).where(eq(user.email, email)),
			(e) => new DbInternalError({ cause: e })
		);
		return unwrapSingleQueryResult(userResult, email, 'User');
	});
}

export function getUserById(userId: string): ResultAsync<User, DbError> {
	return safeTry(async function* () {
		const userResult = yield* fromPromise(
			db.select().from(user).where(eq(user.id, userId)),
			(e) => new DbInternalError({ cause: e })
		);
		return unwrapSingleQueryResult(userResult, userId, 'User');
	});
}

export function createAuthUser(email: string, password: string): ResultAsync<AuthUser, DbError> {
	return safeTry(async function* () {
		const salt = yield* fromPromise(genSalt(10), (e) => new DbInternalError({ cause: e }));
		const passwordHash = yield* fromPromise(
			bcryptHash(password, salt),
			(e) => new DbInternalError({ cause: e })
		);

		const userResult = yield* fromPromise(
			db
				.insert(user)
				.values({ id: crypto.randomUUID(), email, password: passwordHash })
				.returning(),
			(e) => {
				logger.error('Failed to create auth user', e);
				return new DbInternalError({ cause: e });
			}
		);

		return unwrapSingleQueryResult(userResult, email, 'User');
	});
}

export function createSession(value: Session): ResultAsync<Session, DbError> {
	return safeTry(async function* () {
		const sessionResult = yield* fromPromise(
			db.insert(session).values(value).returning(),
			(e) => new DbInternalError({ cause: e })
		);
		return unwrapSingleQueryResult(sessionResult, value.id, 'Session');
	});
}

export function getFullSession(
	sessionId: string
): ResultAsync<{ session: Session; user: User }, DbError> {
	return safeTry(async function* () {
		const sessionResult = yield* fromPromise(
			db
				.select({
					user: {
						id: user.id,
						email: user.email,
						displayName: user.displayName,
						avatarUrl: user.avatarUrl
					},
					session
				})
				.from(session)
				.innerJoin(user, eq(session.userId, user.id))
				.where(eq(session.id, sessionId)),
			(e) => new DbInternalError({ cause: e })
		);
		return unwrapSingleQueryResult(sessionResult, sessionId, 'Session');
	});
}

export function updateUserProfile({
	userId,
	displayName,
	avatarUrl
}: {
	userId: string;
	displayName?: string | null;
	avatarUrl?: string | null;
}): ResultAsync<User, DbError> {
	return safeTry(async function* () {
		const updateValues: Partial<typeof user.$inferInsert> = {};
		if (displayName !== undefined) updateValues.displayName = displayName;
		if (avatarUrl !== undefined) updateValues.avatarUrl = avatarUrl;

		if (Object.keys(updateValues).length === 0) {
			const userResult = yield* fromPromise(
				db.select().from(user).where(eq(user.id, userId)),
				(e) => new DbInternalError({ cause: e })
			);
			return unwrapSingleQueryResult(userResult, userId, 'User');
		}

		const userResult = yield* fromPromise(
			db.update(user).set(updateValues).where(eq(user.id, userId)).returning(),
			(e) => new DbInternalError({ cause: e })
		);
		return unwrapSingleQueryResult(userResult, userId, 'User');
	});
}

export function deleteSession(sessionId: string): ResultAsync<undefined, DbError> {
	return safeTry(async function* () {
		yield* fromPromise(
			db.delete(session).where(eq(session.id, sessionId)),
			(e) => new DbInternalError({ cause: e })
		);

		return ok(undefined);
	});
}

export function extendSession(sessionId: string): ResultAsync<Session, DbError> {
	return safeTry(async function* () {
		const sessionResult = yield* fromPromise(
			db
				.update(session)
				.set({ expiresAt: new Date(Date.now() + ms('30d')) })
				.where(eq(session.id, sessionId))
				.returning(),
			(e) => new DbInternalError({ cause: e })
		);

		return unwrapSingleQueryResult(sessionResult, sessionId, 'Session');
	});
}

export function deleteSessionsForUser(userId: string): ResultAsync<undefined, DbError> {
	return safeTry(async function* () {
		yield* fromPromise(
			db.delete(session).where(eq(session.userId, userId)),
			(e) => new DbInternalError({ cause: e })
		);

		return ok(undefined);
	});
}

export function saveChat({
	id,
	userId,
	title
}: {
	id: string;
	userId: string;
	title: string;
}): ResultAsync<Chat, DbError> {
	return safeTry(async function* () {
		const now = new Date();
		const insertResult = yield* fromPromise(
			db
				.insert(chat)
				.values({
					id,
					createdAt: now,
					updatedAt: now,
					userId,
					title
				})
				.returning(),
			(e) => new DbInternalError({ cause: e })
		);

		return unwrapSingleQueryResult(insertResult, id, 'Chat');
	});
}

export function deleteChatById({ id }: { id: string }): ResultAsync<void, DbError> {
	return safeTry(async function* () {
		yield* fromPromise(
			db.transaction(async (tx) => {
				await tx.delete(vote).where(rawEq(vote.chatId, id));
				await tx.delete(share).where(rawEq(share.chatId, id));
				await tx.delete(message).where(rawEq(message.chatId, id));
				await tx.delete(chat).where(rawEq(chat.id, id));
			}),
			(e) => {
				logger.error('Failed to delete chat', e);
				return new DbInternalError({ cause: e });
			}
		);
		return ok(undefined);
	});
}

export function deleteAllChatsByUserId({ userId }: { userId: string }): ResultAsync<void, DbError> {
	return safeTry(async function* () {
		yield* fromPromise(
			db.transaction(async (tx) => {
				const userChats = await tx
					.select({ id: chat.id })
					.from(chat)
					.where(rawEq(chat.userId, userId));

				const chatIds = userChats.map((c) => c.id);

				if (chatIds.length > 0) {
					// SQLite has a limit on the number of host parameters (default 999)
					// We chunk the deletion to avoid hitting this limit
					const chunkSize = 900;
					for (let i = 0; i < chatIds.length; i += chunkSize) {
						const chunk = chatIds.slice(i, i + chunkSize);
						await tx.delete(vote).where(inArray(vote.chatId, chunk));
						await tx.delete(share).where(inArray(share.chatId, chunk));
						await tx.delete(message).where(inArray(message.chatId, chunk));
					}
					await tx.delete(chat).where(rawEq(chat.userId, userId));
				}
			}),
			(e) => {
				logger.error('Failed to delete all chats', e);
				return new DbInternalError({ cause: e });
			}
		);
		return ok(undefined);
	});
}

export function getChatsByUserId({ id }: { id: string }): ResultAsync<Chat[], DbError> {
	return safeTry(async function* () {
		try {
			const rows = yield* fromPromise(
				db.select().from(chat).where(eq(chat.userId, id)).orderBy(desc(chat.updatedAt)),
				(e) => new DbInternalError({ cause: e })
			);
			return ok(rows);
		} catch (e) {
			if (!isMissingUnreadColumnError(e)) {
				return err(new DbInternalError({ cause: e }));
			}
			const rows = yield* fromPromise(
				db
					.select({
						id: chat.id,
						createdAt: chat.createdAt,
						updatedAt: chat.updatedAt,
						title: chat.title,
						userId: chat.userId,
						visibility: chat.visibility,
						pinned: chat.pinned
					})
					.from(chat)
					.where(eq(chat.userId, id))
					.orderBy(desc(chat.updatedAt)),
				(e) => new DbInternalError({ cause: e })
			);
			return ok(rows.map((row) => ({ ...row, unread: false })));
		}
	});
}

export function getChatById({ id }: { id: string }): ResultAsync<Chat, DbError> {
	return safeTry(async function* () {
		let chatResult: Chat[];
		try {
			chatResult = yield* fromPromise(
				db.select().from(chat).where(eq(chat.id, id)),
				(e) => new DbInternalError({ cause: e })
			);
		} catch (e) {
			if (!isMissingUnreadColumnError(e)) {
				return err(new DbInternalError({ cause: e }));
			}
			const fallbackResult = yield* fromPromise(
				db
					.select({
						id: chat.id,
						createdAt: chat.createdAt,
						updatedAt: chat.updatedAt,
						title: chat.title,
						userId: chat.userId,
						visibility: chat.visibility,
						pinned: chat.pinned
					})
					.from(chat)
					.where(eq(chat.id, id)),
				(e2) => new DbInternalError({ cause: e2 })
			);
			chatResult = fallbackResult.map((row) => ({ ...row, unread: false }));
		}

		return unwrapSingleQueryResult(chatResult, id, 'Chat');
	});
}

export function updateChatTitleById({
	chatId,
	title
}: {
	chatId: string;
	title: string;
}): ResultAsync<undefined, DbError> {
	return safeTry(async function* () {
		yield* fromPromise(
			db.update(chat).set({ title }).where(eq(chat.id, chatId)),
			(e) => new DbInternalError({ cause: e })
		);
		return ok(undefined);
	});
}

export function updateChatPinnedById({
	chatId,
	pinned
}: {
	chatId: string;
	pinned: boolean;
}): ResultAsync<undefined, DbError> {
	return safeTry(async function* () {
		yield* fromPromise(
			db.update(chat).set({ pinned }).where(eq(chat.id, chatId)),
			(e) => new DbInternalError({ cause: e })
		);
		return ok(undefined);
	});
}

export function updateChatUnreadById({
	chatId,
	userId,
	unread
}: {
	chatId: string;
	userId?: string;
	unread: boolean;
}): ResultAsync<undefined, DbError> {
	return safeTry(async function* () {
		const whereClause = userId
			? and(eq(chat.id, chatId), eq(chat.userId, userId))
			: eq(chat.id, chatId);
		yield* fromPromise(
			db.update(chat).set({ unread }).where(whereClause),
			(e) => new DbInternalError({ cause: e })
		);
		return ok(undefined);
	});
}

export function saveMessages({
	messages
}: {
	messages: Array<Message>;
}): ResultAsync<Message[], DbError> {
	return safeTry(async function* () {
		if (messages.length === 0) {
			return ok([]);
		}
		const insertResult = yield* fromPromise(
			db.insert(message).values(messages).onConflictDoNothing().returning(),
			(e) => new DbInternalError({ cause: e })
		);

		const chatId = messages[0]!.chatId;
		yield* fromPromise(
			db.update(chat).set({ updatedAt: new Date() }).where(eq(chat.id, chatId)),
			(e) => new DbInternalError({ cause: e })
		);

		return ok(insertResult);
	});
}

export function getMessagesByChatId({ id }: { id: string }): ResultAsync<Message[], DbError> {
	return safeTry(async function* () {
		const rows = yield* fromPromise(
			db.select().from(message).where(eq(message.chatId, id)).orderBy(asc(message.createdAt)),
			(e) => new DbInternalError({ cause: e })
		);

		return ok(rows);
	});
}

export function getMessagesByChatIds({
	chatIds
}: {
	chatIds: string[];
}): ResultAsync<Message[], DbError> {
	return safeTry(async function* () {
		if (chatIds.length === 0) {
			return ok([]);
		}

		const rows = yield* fromPromise(
			db
				.select()
				.from(message)
				.where(inArray(message.chatId, chatIds))
				.orderBy(asc(message.chatId), asc(message.createdAt)),
			(e) => new DbInternalError({ cause: e })
		);

		return ok(rows);
	});
}

export function voteMessage({
	chatId,
	messageId,
	type
}: {
	chatId: string;
	messageId: string;
	type: 'up' | 'down';
}): ResultAsync<undefined, DbError> {
	return safeTry(async function* () {
		yield* fromPromise(
			db
				.insert(vote)
				.values({
					chatId,
					messageId,
					isUpvoted: type === 'up'
				})
				.onConflictDoUpdate({
					target: [vote.messageId, vote.chatId],
					set: { isUpvoted: type === 'up' }
				}),
			(e) => new DbInternalError({ cause: e })
		);
		return ok(undefined);
	});
}

export function getVotesByChatId({ id }: { id: string }): ResultAsync<Vote[], DbError> {
	return fromPromise(
		db.select().from(vote).where(eq(vote.chatId, id)),
		(e) => new DbInternalError({ cause: e })
	);
}

export function getMessageById({ id }: { id: string }): ResultAsync<Message, DbError> {
	return safeTry(async function* () {
		const msgRows = yield* fromPromise(
			db.select().from(message).where(eq(message.id, id)),
			(e) => new DbInternalError({ cause: e })
		);

		return unwrapSingleQueryResult(msgRows, id, 'Message');
	});
}

export function createGenerationRun({
	run
}: {
	run: GenerationRun;
}): ResultAsync<GenerationRun, DbError> {
	return safeTry(async function* () {
		const rows = yield* fromPromise(
			db.insert(generationRun).values(run).returning(),
			(e) => new DbInternalError({ cause: e })
		);
		return unwrapSingleQueryResult(rows, run.id, 'GenerationRun');
	});
}

export function getGenerationRunById({ id }: { id: string }): ResultAsync<GenerationRun, DbError> {
	return safeTry(async function* () {
		const rows = yield* fromPromise(
			db.select().from(generationRun).where(eq(generationRun.id, id)),
			(e) => new DbInternalError({ cause: e })
		);
		return unwrapSingleQueryResult(rows, id, 'GenerationRun');
	});
}

export function getGenerationRunsByChatId({
	chatId
}: {
	chatId: string;
}): ResultAsync<GenerationRun[], DbError> {
	return fromPromise(
		db
			.select()
			.from(generationRun)
			.where(eq(generationRun.chatId, chatId))
			.orderBy(asc(generationRun.createdAt)),
		(e) => new DbInternalError({ cause: e })
	);
}

export function getActiveGenerationRunByChatId({
	chatId,
	userId
}: {
	chatId: string;
	userId: string;
}): ResultAsync<GenerationRun | null, DbError> {
	return safeTry(async function* () {
		const rows = yield* fromPromise(
			db
				.select()
				.from(generationRun)
				.where(
					and(
						eq(generationRun.chatId, chatId),
						eq(generationRun.userId, userId),
						or(eq(generationRun.status, 'queued'), eq(generationRun.status, 'running'))
					)
				)
				.orderBy(desc(generationRun.createdAt))
				.limit(1),
			(e) => new DbInternalError({ cause: e })
		);
		return ok(rows[0] ?? null);
	});
}

export function updateGenerationRunStatus({
	runId,
	status,
	error
}: {
	runId: string;
	status: string;
	error?: string | null;
}): ResultAsync<undefined, DbError> {
	return safeTry(async function* () {
		yield* fromPromise(
			db
				.update(generationRun)
				.set({
					status,
					error: error ?? null,
					startedAt: status === 'running' ? new Date() : undefined,
					finishedAt:
						status === 'succeeded' || status === 'failed' || status === 'canceled'
							? new Date()
							: undefined
				})
				.where(eq(generationRun.id, runId)),
			(e) => new DbInternalError({ cause: e })
		);
		return ok(undefined);
	});
}

export function appendRunEvent({
	runId,
	chunkJson
}: {
	runId: string;
	chunkJson: string;
}): ResultAsync<RunEvent, DbError> {
	return safeTry(async function* () {
		const event = yield* fromPromise(
			db.transaction(async (tx) => {
				const runRows = await tx
					.select({ cursor: generationRun.cursor })
					.from(generationRun)
					.where(eq(generationRun.id, runId))
					.limit(1);
				const currentCursor = runRows[0]?.cursor ?? 0;
				const nextSeq = currentCursor + 1;

				await tx.update(generationRun).set({ cursor: nextSeq }).where(eq(generationRun.id, runId));
				const inserted = await tx
					.insert(runEvent)
					.values({
						runId,
						seq: nextSeq,
						createdAt: new Date(),
						chunk: chunkJson
					})
					.returning();
				return inserted[0] ?? null;
			}),
			(e) => new DbInternalError({ cause: e })
		);

		if (!event) {
			return err(new DbInternalError({ cause: new Error('Failed to append run event') }));
		}

		return ok(event);
	});
}

export function getRunEventsAfterSeq({
	runId,
	afterSeq
}: {
	runId: string;
	afterSeq: number;
}): ResultAsync<RunEvent[], DbError> {
	return safeTry(async function* () {
		const rows = yield* fromPromise(
			db
				.select()
				.from(runEvent)
				.where(and(eq(runEvent.runId, runId), gte(runEvent.seq, afterSeq + 1)))
				.orderBy(asc(runEvent.seq)),
			(e) => new DbInternalError({ cause: e })
		);
		return ok(rows);
	});
}

export function updateMessagePartsById({
	messageId,
	parts
}: {
	messageId: string;
	parts: Message['parts'];
}): ResultAsync<undefined, DbError> {
	return safeTry(async function* () {
		yield* fromPromise(
			db.update(message).set({ parts }).where(eq(message.id, messageId)),
			(e) => new DbInternalError({ cause: e })
		);
		return ok(undefined);
	});
}

export function getActiveRunChatIdsByUserId({
	userId
}: {
	userId: string;
}): ResultAsync<string[], DbError> {
	return safeTry(async function* () {
		const rows = yield* fromPromise(
			db
				.select({ chatId: generationRun.chatId })
				.from(generationRun)
				.where(
					and(
						eq(generationRun.userId, userId),
						or(eq(generationRun.status, 'queued'), eq(generationRun.status, 'running'))
					)
				),
			(e) => new DbInternalError({ cause: e })
		);
		const uniq = new Set(rows.map((r) => r.chatId));
		return ok([...uniq]);
	});
}

export function failAllActiveGenerationRuns({
	errorKey
}: {
	errorKey?: string | null;
} = {}): ResultAsync<number, DbError> {
	return safeTry(async function* () {
		const ids = yield* fromPromise(
			db
				.select({ id: generationRun.id })
				.from(generationRun)
				.where(or(eq(generationRun.status, 'queued'), eq(generationRun.status, 'running'))),
			(e) => new DbInternalError({ cause: e })
		);

		const runIds = ids
			.map((r) => r.id)
			.filter((id): id is string => typeof id === 'string' && id.length > 0);
		if (runIds.length === 0) return ok(0);

		yield* fromPromise(
			db
				.update(generationRun)
				.set({
					status: 'failed',
					error: errorKey ?? 'run.failed',
					finishedAt: new Date()
				})
				.where(inArray(generationRun.id, runIds)),
			(e) => new DbInternalError({ cause: e })
		);

		return ok(runIds.length);
	});
}

export function deleteMessagesByChatIdAfterTimestamp({
	chatId,
	timestamp
}: {
	chatId: string;
	timestamp: Date;
}): ResultAsync<undefined, DbError> {
	return safeTry(async function* () {
		yield* fromPromise(
			db.delete(message).where(and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))),
			(e) => new DbInternalError({ cause: e })
		);
		return ok(undefined);
	});
}

export function deleteTrailingMessages({ id }: { id: string }): ResultAsync<undefined, DbError> {
	return safeTry(async function* () {
		const message = yield* getMessageById({ id });
		yield* deleteMessagesByChatIdAfterTimestamp({
			chatId: message.chatId,
			timestamp: message.createdAt
		});
		return ok(undefined);
	});
}

export function createShare({
	id,
	chatId,
	userId
}: {
	id: string;
	chatId: string;
	userId: string;
}): ResultAsync<Share, DbError> {
	return safeTry(async function* () {
		const insertResult = yield* fromPromise(
			db
				.insert(share)
				.values({
					id,
					chatId,
					userId,
					createdAt: new Date()
				})
				.returning(),
			(e) => new DbInternalError({ cause: e })
		);

		return unwrapSingleQueryResult(insertResult, id, 'Share');
	});
}

export function getShareById({ id }: { id: string }): ResultAsync<Share, DbError> {
	return safeTry(async function* () {
		const shareResult = yield* fromPromise(
			db.select().from(share).where(eq(share.id, id)),
			(e) => new DbInternalError({ cause: e })
		);

		return unwrapSingleQueryResult(shareResult, id, 'Share');
	});
}

export function getShareByChatId({ chatId }: { chatId: string }): ResultAsync<Share, DbError> {
	return safeTry(async function* () {
		const shareResult = yield* fromPromise(
			db.select().from(share).where(eq(share.chatId, chatId)),
			(e) => new DbInternalError({ cause: e })
		);

		return unwrapSingleQueryResult(shareResult, chatId, 'Share');
	});
}

export function getSharesByUserId({
	userId
}: {
	userId: string;
}): ResultAsync<Array<Share & { chat: { title: string } }>, DbError> {
	return fromPromise(
		db
			.select({
				id: share.id,
				chatId: share.chatId,
				userId: share.userId,
				createdAt: share.createdAt,
				chat: {
					title: chat.title
				}
			})
			.from(share)
			.innerJoin(chat, eq(share.chatId, chat.id))
			.where(eq(share.userId, userId))
			.orderBy(desc(share.createdAt)),
		(e) => new DbInternalError({ cause: e })
	);
}

export function deleteShareById({ id }: { id: string }): ResultAsync<undefined, DbError> {
	return safeTry(async function* () {
		yield* fromPromise(
			db.delete(share).where(eq(share.id, id)),
			(e) => new DbInternalError({ cause: e })
		);
		return ok(undefined);
	});
}

export function getChatByShareId({
	shareId
}: {
	shareId: string;
}): ResultAsync<{ chat: Chat; messages: Message[] }, DbError> {
	return safeTry(async function* () {
		const shareRecord = yield* getShareById({ id: shareId });

		let chatResult: { chatRows: Chat[]; messagesRows: Message[] };
		try {
			chatResult = yield* fromPromise(
				db.transaction(async (tx) => {
					const chatRows = await tx.select().from(chat).where(eq(chat.id, shareRecord.chatId));
					const messagesRows = await tx
						.select()
						.from(message)
						.where(eq(message.chatId, shareRecord.chatId))
						.orderBy(asc(message.createdAt));
					return { chatRows, messagesRows };
				}),
				(e) => new DbInternalError({ cause: e })
			);
		} catch (e) {
			if (!isMissingUnreadColumnError(e)) {
				return err(new DbInternalError({ cause: e }));
			}
			chatResult = yield* fromPromise(
				db.transaction(async (tx) => {
					const chatRows = await tx
						.select({
							id: chat.id,
							createdAt: chat.createdAt,
							updatedAt: chat.updatedAt,
							title: chat.title,
							userId: chat.userId,
							visibility: chat.visibility,
							pinned: chat.pinned
						})
						.from(chat)
						.where(eq(chat.id, shareRecord.chatId));
					const messagesRows = await tx
						.select()
						.from(message)
						.where(eq(message.chatId, shareRecord.chatId))
						.orderBy(asc(message.createdAt));
					return {
						chatRows: chatRows.map((row) => ({ ...row, unread: false })),
						messagesRows
					};
				}),
				(e2) => new DbInternalError({ cause: e2 })
			);
		}

		const chatRecord = yield* unwrapSingleQueryResult(
			chatResult.chatRows,
			shareRecord.chatId,
			'Chat'
		);

		return ok({ chat: chatRecord, messages: chatResult.messagesRows });
	});
}

export function searchChats({ userId, query }: { userId: string; query: string }): ResultAsync<
	Array<{
		chatId: string;
		chatTitle: string;
		messageId?: string;
		messageSnippet: string;
		createdAt: Date;
	}>,
	DbError
> {
	return safeTry(async function* () {
		const escapedQuery = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
		const searchPattern = `%${escapedQuery}%`;
		const results = yield* fromPromise(
			db
				.select({
					chatId: chat.id,
					chatTitle: chat.title,
					messageId: message.id,
					messageParts: message.parts,
					createdAt: message.createdAt,
					updatedAt: chat.updatedAt
				})
				.from(chat)
				.leftJoin(message, eq(chat.id, message.chatId))
				.where(
					and(
						eq(chat.userId, userId),
						or(
							sql`${chat.title} LIKE ${searchPattern} ESCAPE '\\'`,
							sql`${message.parts} LIKE ${searchPattern} ESCAPE '\\'`
						)
					)
				)
				.orderBy(desc(chat.updatedAt), desc(message.createdAt))
				.limit(50),
			(e) => new DbInternalError({ cause: e })
		);

		return ok(
			results.map((r) => {
				let snippet = '';
				if (r.messageParts) {
					snippet = r.messageParts
						.filter((p) => p.type === 'text')
						.map((p) => (p.type === 'text' ? p.text : ''))
						.join(' ');
				}
				snippet = snippet.replace(/\s+/g, ' ').trim();
				if (snippet.length > 240) {
					snippet = `${snippet.slice(0, 240)}...`;
				}

				return {
					chatId: r.chatId,
					chatTitle: r.chatTitle,
					messageId: r.messageId ?? undefined,
					messageSnippet: snippet,
					createdAt: r.createdAt ?? r.updatedAt
				};
			})
		);
	});
}
