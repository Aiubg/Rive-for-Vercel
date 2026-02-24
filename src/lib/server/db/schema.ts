import type { InferSelectModel } from 'drizzle-orm';
import {
	sqliteTable,
	text,
	integer,
	primaryKey,
	type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { UIMessage } from 'ai';
import type { Attachment } from '$lib/types/attachment';

export const user = sqliteTable('User', (_t) => ({
	id: text('id').primaryKey().notNull(),
	email: text('email').notNull().unique(),
	password: text('password').notNull(),
	displayName: text('displayName'),
	avatarUrl: text('avatarUrl')
}));

export type AuthUser = InferSelectModel<typeof user>;
export type User = Omit<AuthUser, 'password'>;

export const session = sqliteTable('Session', (_t) => ({
	id: text('id').primaryKey().notNull(),
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
}));

export type Session = InferSelectModel<typeof session>;

export const chat = sqliteTable('Chat', (_t) => ({
	id: text('id').primaryKey().notNull(),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' })
		.notNull()
		.default(sql`0`),
	title: text('title').notNull(),
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	visibility: text('visibility').notNull().default('private'),
	pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
	unread: integer('unread', { mode: 'boolean' }).notNull().default(false)
}));

export type Chat = InferSelectModel<typeof chat>;

export const message = sqliteTable('Message', (_t) => ({
	id: text('id').primaryKey().notNull(),
	chatId: text('chatId')
		.notNull()
		.references(() => chat.id, { onDelete: 'cascade' }),
	role: text('role').$type<UIMessage['role']>().notNull(),
	parentId: text('parentId').references((): AnySQLiteColumn => message.id, {
		onDelete: 'set null'
	}),
	parts: text('parts', { mode: 'json' }).$type<UIMessage['parts']>().notNull(),
	attachments: text('attachments', { mode: 'json' }).$type<Attachment[]>().notNull(),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull()
}));

export type Message = InferSelectModel<typeof message>;

export const vote = sqliteTable(
	'Vote',
	(_t) => ({
		chatId: text('chatId')
			.notNull()
			.references(() => chat.id, { onDelete: 'cascade' }),
		messageId: text('messageId')
			.notNull()
			.references(() => message.id, { onDelete: 'cascade' }),
		isUpvoted: integer('isUpvoted', { mode: 'boolean' }).notNull()
	}),
	(t) => ({
		pk: primaryKey({ columns: [t.chatId, t.messageId] })
	})
);

export type Vote = InferSelectModel<typeof vote>;

export const share = sqliteTable('Share', (_t) => ({
	id: text('id').primaryKey().notNull(),
	chatId: text('chatId')
		.notNull()
		.references(() => chat.id, { onDelete: 'cascade' }),
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull()
}));

export type Share = InferSelectModel<typeof share>;

export const generationRun = sqliteTable('GenerationRun', (_t) => ({
	id: text('id').primaryKey().notNull(),
	chatId: text('chatId')
		.notNull()
		.references(() => chat.id, { onDelete: 'cascade' }),
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	status: text('status').notNull(),
	modelId: text('modelId').notNull(),
	userMessageId: text('userMessageId')
		.notNull()
		.references(() => message.id, { onDelete: 'cascade' }),
	assistantMessageId: text('assistantMessageId').notNull(),
	messages: text('messages', { mode: 'json' }).$type<UIMessage[]>().notNull(),
	personalization: text('personalization', { mode: 'json' }).$type<unknown>().notNull(),
	cursor: integer('cursor')
		.notNull()
		.default(sql`0`),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	startedAt: integer('startedAt', { mode: 'timestamp' }),
	finishedAt: integer('finishedAt', { mode: 'timestamp' }),
	error: text('error')
}));

export type GenerationRun = InferSelectModel<typeof generationRun>;

export const runEvent = sqliteTable(
	'RunEvent',
	(_t) => ({
		runId: text('runId')
			.notNull()
			.references(() => generationRun.id, { onDelete: 'cascade' }),
		seq: integer('seq').notNull(),
		createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
		chunk: text('chunk').notNull()
	}),
	(t) => ({
		pk: primaryKey({ columns: [t.runId, t.seq] })
	})
);

export type RunEvent = InferSelectModel<typeof runEvent>;
