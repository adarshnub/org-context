# Org Context

Org Context is a Next.js App Router application rooted in `main/`. It is designed around workspace-scoped team chat, Supabase auth and realtime data, async Cohere embeddings, and `/ask`-based retrieval over chat history.

## Run locally
1. Copy `.env.example` to `.env.local`.
2. Fill in your Supabase and provider credentials.
3. Install dependencies:

```bash
npm install
```

4. Start the dev server:

```bash
npm run dev
```

## Project highlights
- Landing page, signup, login, dashboard, and workspace chat
- Supabase SSR clients and `proxy.ts` auth refresh
- Workspace ownership, invites, and provider selection actions
- `/api/chat/send` and `/api/chat/ask` route handlers
- Supabase SQL migration for the v1 schema
- Supabase Edge Function scaffold for async message embeddings

## Required manual setup
Use the docs in `../docs/` for the full setup sequence:
- `../docs/setup-and-env.md`
- `../docs/database-and-security.md`
- `../docs/implementation-plan.md`
