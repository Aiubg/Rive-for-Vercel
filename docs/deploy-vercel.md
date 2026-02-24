# Deploy On Vercel

## What changed in this branch

- Switched SvelteKit adapter to `@sveltejs/adapter-vercel`.
- Added Vercel Blob support for file upload/list/preview/delete.
- Kept local filesystem mode as fallback when `BLOB_READ_WRITE_TOKEN` is not set.

## Required environment variables

Set these in Vercel Project Settings -> Environment Variables:

- `LIBSQL_URL` (must be remote in production, e.g. `libsql://...`)
- `LIBSQL_AUTH_TOKEN`
- At least one model key you actually use (for example `DEEPSEEK_API_KEY`)
- `PUBLIC_ALLOW_ANONYMOUS_CHATS` (`true` or `false`)

If you want persistent uploaded files on Vercel:

- `BLOB_READ_WRITE_TOKEN`

Optional tool keys:

- `TAVILY_API_KEY`
- `WOLFRAM_ALPHA_APP_ID`

## Database notes

- Do not use `file:./data/app.db` on Vercel.
- Use Turso/libsql remote URL for production.

## Build settings

- Framework preset: SvelteKit
- Install command: `pnpm install`
- Build command: `pnpm build`

## Quick verification checklist

After first deployment:

1. Sign in and send a message.
2. Confirm streaming response works.
3. Upload a file and refresh page.
4. Confirm uploaded file still appears after refresh.
