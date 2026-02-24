// scripts/sqlite-init.ts
/**
 * Initialize a local SQLite schema compatible with the Drizzle models.
 * This script is useful for setting up a local database without running full migrations.
 * Run via: pnpm db:init-sqlite
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });

const dbUrl = process.env.LIBSQL_URL ?? 'file:./data/app.db';

async function run() {
	const client = createClient({ url: dbUrl });
	const statements = [
		`CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      displayName TEXT,
      avatarUrl TEXT
    );`,
		`CREATE TABLE IF NOT EXISTS Session (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES User(id)
    );`,
		`CREATE TABLE IF NOT EXISTS Chat (
      id TEXT PRIMARY KEY NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      title TEXT NOT NULL,
      userId TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private',
      pinned INTEGER NOT NULL DEFAULT 0,
      unread INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (userId) REFERENCES User(id)
    );`,
		`CREATE TABLE IF NOT EXISTS Message (
      id TEXT PRIMARY KEY NOT NULL,
      chatId TEXT NOT NULL,
      role TEXT NOT NULL,
      parts TEXT NOT NULL,
      attachments TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (chatId) REFERENCES Chat(id)
    );`,
		`CREATE TABLE IF NOT EXISTS Vote (
      chatId TEXT NOT NULL,
      messageId TEXT NOT NULL,
      isUpvoted INTEGER NOT NULL,
      PRIMARY KEY (chatId, messageId),
      FOREIGN KEY (chatId) REFERENCES Chat(id),
      FOREIGN KEY (messageId) REFERENCES Message(id)
    );`,
		`CREATE TABLE IF NOT EXISTS Share (
      id TEXT PRIMARY KEY NOT NULL,
      chatId TEXT NOT NULL,
      userId TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (chatId) REFERENCES Chat(id),
      FOREIGN KEY (userId) REFERENCES User(id)
    );`
	];

	for (const sql of statements) {
		await client.execute(sql);
	}
	console.log('SQLite schema initialized at', dbUrl);
}

run().catch((e) => {
	console.error(e);
	process.exit(1);
});
