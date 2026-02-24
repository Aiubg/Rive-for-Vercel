import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({
	path: '.env.local'
});

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './src/lib/server/db/migrations',
	dialect: 'turso',
	dbCredentials: {
		url: process.env.LIBSQL_URL ?? 'file:./data/app.db',
		authToken: process.env.LIBSQL_AUTH_TOKEN
	}
});
