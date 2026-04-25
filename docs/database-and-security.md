# Org Context v1 Database and Security Design

## Summary
This document defines the core schema, retrieval function, and authorization model for Org Context v1. The database is designed for a Supabase-first implementation using Postgres, `pgvector`, Realtime, and row-level security.

## Extensions and Database Features
- Enable the `vector` extension for `pgvector`.
- Enable Realtime on the chat-related tables that need live updates.
- Add SQL migrations for schema, policies, indexes, and retrieval RPCs.

## Core Tables
### `profiles`
Stores application profile data for each authenticated user.

Suggested fields:
- `id uuid primary key` referencing `auth.users(id)`
- `full_name text not null`
- `company_name text not null`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `workspaces`
Stores top-level collaborative spaces.

Suggested fields:
- `id uuid primary key`
- `name text not null`
- `slug text unique not null`
- `owner_id uuid not null`
- `answer_provider enum('cohere','openai') not null default 'cohere'`
- `created_at timestamptz default now()`

Constraints:
- `answer_provider` must be one of `cohere` or `openai`

### `workspace_members`
Maps users into workspaces.

Suggested fields:
- `workspace_id uuid not null`
- `user_id uuid not null`
- `role enum('owner','member') not null`
- `created_at timestamptz default now()`

Constraints:
- composite primary key on `(workspace_id, user_id)`
- `role` must be one of `owner` or `member`

### `workspace_invites`
Tracks owner-generated invitations for existing users.

Suggested fields:
- `id uuid primary key`
- `workspace_id uuid not null`
- `invited_email text not null`
- `invited_user_id uuid not null`
- `invited_by uuid not null`
- `status enum('pending','accepted','declined') not null default 'pending'`
- `created_at timestamptz default now()`
- `responded_at timestamptz`

Constraints:
- `status` must be one of `pending`, `accepted`, or `declined`
- unique pending invite guard recommended per `(workspace_id, invited_user_id)`

### `channels`
Represents chat channels per workspace. v1 uses only one default channel.

Suggested fields:
- `id uuid primary key`
- `workspace_id uuid not null`
- `name text not null`
- `created_at timestamptz default now()`

Constraints:
- unique `(workspace_id, name)`
- one auto-created `general` row for each workspace in v1

### `chat_messages`
Stores all chat-visible content including user messages, commands, assistant replies, and system notices.

Suggested fields:
- `id uuid primary key`
- `workspace_id uuid not null`
- `channel_id uuid not null`
- `sender_id uuid`
- `message_type enum('user','command','assistant','system') not null`
- `body text not null`
- `command_name text`
- `embedding_status enum('pending','completed','failed') not null default 'pending'`
- `created_at timestamptz default now()`

Constraints:
- `message_type` must be one of `user`, `command`, `assistant`, or `system`
- `embedding_status` must be one of `pending`, `completed`, or `failed`

Notes:
- `sender_id` can be nullable for some assistant or system-generated rows if needed
- `/ask` commands are stored with `message_type='command'`
- Assistant answers are stored with `message_type='assistant'`

### `chat_message_embeddings`
Stores semantic vectors separately from the chat row body.

Suggested fields:
- `message_id uuid primary key`
- `workspace_id uuid not null`
- `channel_id uuid not null`
- `provider text not null default 'cohere'`
- `model text not null default 'embed-v4.0'`
- `embedding vector(1536) not null`
- `created_at timestamptz default now()`

Notes:
- Keep the vector size aligned with the selected Cohere embedding configuration.
- If the Cohere dimension changes, the database vector definition must change too.

## Recommended Indexes
- `workspace_members(user_id)`
- `workspace_members(workspace_id)`
- `workspace_invites(invited_user_id, status)`
- `channels(workspace_id)`
- `chat_messages(workspace_id, channel_id, created_at desc)`
- `chat_messages(sender_id, created_at desc)`
- vector similarity index for `chat_message_embeddings.embedding`
- supporting index for `chat_message_embeddings(workspace_id, channel_id)`

## Retrieval RPC
Create a Postgres function named `match_chat_messages(...)` that:
- accepts `workspace_id`
- accepts `channel_id`
- accepts a query embedding
- accepts `match_count` with default `8`
- computes cosine similarity against `chat_message_embeddings`
- returns top-k matching messages joined back to `chat_messages`
- includes similarity score in the result

Suggested signature:
- `match_chat_messages(workspace_id uuid, channel_id uuid, query_embedding vector(1536), match_count int default 8)`

Expected behavior:
- search only within the provided workspace and channel
- exclude rows without embeddings
- return newest ties in a deterministic way if scores match

## Authorization Model
### RLS expectations
- Users can read and update only their own `profiles` row.
- Users can read a workspace only if they are a member.
- Users can read workspace channels only if they are members of the workspace.
- Users can read chat messages only if they are members of the workspace.
- Users can insert user or command chat messages only in workspaces they belong to.
- Only workspace owners can create invites or update workspace settings.
- Only trusted server-side flows can insert assistant or system messages.

### Membership rules
- Workspace creator is inserted as `owner`.
- Invited users join as `member`.
- A user can belong to multiple workspaces.
- Membership is the base permission check for every workspace-scoped read or write.

### Invite rules
- v1 invites only existing registered users.
- Invite creation should validate the email against a known `profiles` or `auth.users` mapping path.
- Accepting an invite should create membership exactly once.
- Duplicate pending invites should be blocked.

## Operational Security Rules
- Embeddings are stored separately from `chat_messages.body`.
- Service-role access is required for worker-side operations that bypass client restrictions.
- Model provider secrets must never be available in the client bundle.
- Edge Function or worker endpoints must verify the caller or use protected internal access.
- Retrieval requests must never return content from another workspace.

## Implementation Notes
- Keep assistant answer generation on the server.
- Treat `/ask` as a trusted backend operation that performs retrieval and then writes an assistant reply.
- Realtime subscriptions should expose only rows the current user is allowed to see under RLS.
- Use migrations for every schema or policy change so environments stay reproducible.
