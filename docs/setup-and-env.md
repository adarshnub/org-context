# Org Context v1 Setup and Environment Guide

## Summary
This guide covers the manual setup required to make Org Context v1 work locally and in deployment. The application code alone is not enough; you also need to provision Supabase, provider API keys, runtime environment variables, and the embedding worker path.

## Manual Setup Checklist
### 1. Local tooling
Install the following on your machine:
- Node.js 20 or newer
- `pnpm` as the recommended package manager
- Supabase CLI
- Optional: Vercel CLI if you plan to deploy on Vercel

Verify locally:
```bash
node -v
pnpm -v
supabase --version
```

### 2. Supabase project setup
You must create and configure a Supabase project manually.

Required setup:
- Create a Supabase project.
- Copy the project URL.
- Copy the public anon key.
- Copy the service-role key for server-only usage.
- Enable email/password auth.
- Disable unused auth providers for v1 if you want to keep the auth surface minimal.
- Configure the site URL.
- Add redirect URLs for local development and production.
- Enable Realtime for the chat tables that need live updates.
- Enable the `vector` extension.
- Create schema, tables, RPCs, and RLS policies through SQL migrations.
- Apply SQL migrations for:
  - schema creation
  - indexes
  - RLS policies
  - retrieval RPCs
- Configure the embedding trigger path:
  - Supabase database webhook plus Edge Function, or
  - another protected worker endpoint reachable from the database trigger flow
- Deploy `main/supabase/functions/embed-chat-message`.
- Wire `public.chat_messages` inserts to the Edge Function with a Database Webhook or the SQL template in `main/supabase/manual_embed_webhook.sql`.

Recommended auth redirect values:
- Local app URL such as `http://localhost:3000`
- Production app URL for your deployed site

### 3. Cohere setup
Required for all embeddings.

Steps:
- Create a Cohere account or project.
- Generate an API key.
- Choose the embedding model.
- Default recommended model: `embed-v4.0`
- Confirm the embedding dimension you will store in Postgres.

Important:
- The `chat_message_embeddings.embedding` vector dimension in Postgres must match the Cohere output dimension you choose.

### 4. OpenAI setup
Required only if you want OpenAI as a workspace answer provider for `/ask`.

Steps:
- Create an OpenAI API key.
- Choose the chat model you want to use for answer generation.

Important:
- Do not block development on this if you plan to use Cohere-only answers first.
- The app should treat `OPENAI_API_KEY` as optional unless a workspace selects `openai`.

### 5. Deployment setup
You must decide where the Next.js app will run.

Required decisions:
- Choose a hosting platform for the Next.js app.
- Add all production environment variables.
- Add the production site URL and redirects in Supabase.
- Ensure server-only secrets are available only to server runtimes.
- Decide where the embedding worker runs in production if not using Supabase Edge Functions.

## Recommended Environment Variables
Create `main/.env.local` for local development:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

COHERE_API_KEY=
COHERE_EMBED_MODEL=embed-v4.0

OPENAI_API_KEY=
OPENAI_CHAT_MODEL=

APP_URL=http://localhost:3000
DEFAULT_ASK_TOP_K=8
```

## Environment Variable Notes
- `NEXT_PUBLIC_SUPABASE_URL` is safe for client-side usage.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe for client-side usage.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-only.
- `COHERE_API_KEY` must stay server-only.
- `COHERE_EMBED_MODEL` should match the model used by the embedding worker.
- `OPENAI_API_KEY` is optional and server-only.
- `OPENAI_CHAT_MODEL` is optional until OpenAI-based answers are enabled.
- `APP_URL` should match the local or deployed app URL.
- `DEFAULT_ASK_TOP_K` should match the retrieval RPC default unless intentionally overridden.

## Local Development Boot Steps
1. Install project dependencies from `main/`.
2. Start Supabase locally with the CLI or connect the app to your hosted Supabase project.
3. Apply SQL migrations.
4. Start the embedding worker path locally if you are using an Edge Function or custom worker.
5. Start the Next.js dev server.

Typical local flow:
```bash
cd main
pnpm install
pnpm dev
```

If you are using local Supabase via CLI, also run the appropriate local Supabase commands before starting the app.

## Things You Must Set Up Manually
These do not happen automatically and must be configured by you:
- Create the Supabase project.
- Turn on email/password auth in Supabase.
- Add local and production auth redirect URLs in Supabase.
- Enable `pgvector` and Realtime in Supabase.
- Provision schema, RLS, indexes, and retrieval RPC migrations.
- Set up the embedding worker path.
- Create a Cohere API key.
- Optionally create an OpenAI API key.
- Add environment variables locally and in production.
- Choose and configure a deployment target for the Next.js app.
- Protect service-role and provider keys from client exposure.

## Troubleshooting Notes
### Auth redirect mismatch
Symptoms:
- login succeeds but redirect fails
- magic links or callbacks land on the wrong URL

Checks:
- confirm `APP_URL`
- confirm Supabase site URL
- confirm local and production redirect URLs in Supabase

### Realtime not enabled
Symptoms:
- messages save but do not appear live on other clients

Checks:
- ensure Realtime is enabled for the relevant table
- verify client subscription is pointed at the right workspace channel
- verify RLS is not blocking visible rows

### Vector dimension mismatch
Symptoms:
- embedding insert fails
- retrieval RPC errors on vector operations

Checks:
- confirm Cohere model and configured output dimension
- confirm Postgres vector column size matches exactly

### Webhook or worker not firing
Symptoms:
- messages stay in `pending`
- no embeddings are created

Checks:
- confirm database webhook or trigger exists
- confirm worker URL is correct
- confirm worker has service-role access where needed
- inspect worker logs and Supabase logs

### Service-role key exposed to client
Symptoms:
- security review or build output reveals private secrets

Checks:
- ensure service-role and provider keys are never prefixed with `NEXT_PUBLIC_`
- ensure server-only code paths import private env values
- inspect bundle and environment loading boundaries
