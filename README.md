# Rivo

[English](./README.md) | [简体中文](./README.zh-CN.md)

An open-source AI chatbot template built with SvelteKit and the AI SDK.

## Project Introduction

Rivo is a full-stack AI chat application template focused on practical extensibility:

- Multi-provider LLM integration via AI SDK
- Modern frontend stack: SvelteKit + Svelte 5 + Tailwind CSS
- File upload support: `.txt`, `.md`, `.docx`, `.xlsx`
- Persistent chat data with Drizzle ORM + libsql (SQLite/Turso)
- Built-in internationalization (`en`, `zh-CN`)

## Getting Started

### 1. Requirements

- Node.js `>= 20.19.0`
- pnpm `>= 10`

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local`, then fill in your real keys.

```bash
# macOS / Linux
cp .env.example .env.local

# PowerShell
Copy-Item .env.example .env.local
```

Minimum local database config:

```bash
LIBSQL_URL=file:./data/app.db
LIBSQL_AUTH_TOKEN=
```

The default chat model is DeepSeek. Set the corresponding API key in `.env.local`.

### 4. Prepare database artifacts

```bash
pnpm db:generate
```

Optional: initialize local SQLite with the helper script.

```bash
pnpm db:init-sqlite
```

### 5. Start the development server

```bash
pnpm dev
```

Open `http://localhost:5173`.

## Common Scripts

Run commands with `pnpm <script>`:

- `dev`: start local development server
- `build`: build production bundle
- `preview`: preview the production build locally
- `check`: run Svelte and TypeScript checks
- `lint`: run Prettier check and ESLint
- `test`: run Vitest test suite
- `db:generate`: generate Drizzle migration artifacts
- `db:push`: push schema to database
- `db:studio`: open Drizzle Studio

## Notes

- Keep secrets in `.env.local`; do not commit keys.
- Local development uses `file:` based libsql URLs.
- Production can use remote libsql URLs such as `libsql://...`.
- Vercel deployment guide: `docs/deploy-vercel.md`.
