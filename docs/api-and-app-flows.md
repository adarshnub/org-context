# Org Context v1 API and App Flows

## Summary
This document defines the main application routes, user-facing flows, and expected backend behaviors for Org Context v1. It intentionally stays at the behavior level so implementation can choose between server actions and route handlers where appropriate.

## Route Map
- `/`
- `/login`
- `/signup`
- `/dashboard`
- `/workspaces/[workspaceId]`

## Route Responsibilities
### `/`
- Public landing page
- Simple placeholder layout for now
- Links users to signup or login

### `/login`
- Email/password login form
- Redirect authenticated users to `/dashboard`

### `/signup`
- Signup form with:
  - `full_name`
  - `company_name`
  - `email`
  - `password`
- Redirect successful signups to `/dashboard`

### `/dashboard`
- Protected route
- Lists workspaces for the current user
- Allows workspace creation
- Shows pending invites with accept and decline actions

### `/workspaces/[workspaceId]`
- Protected route
- Validates the current user is a member of the workspace
- Shows the default group channel chat
- Loads historical messages
- Subscribes to realtime updates
- Exposes invite controls for owners
- Exposes answer-provider selection for owners if that setting is editable in the UI

## Server Behaviors
### Signup action
Expected behavior:
- Create the auth user with email and password
- Create the corresponding `profiles` row
- Start the user session
- Redirect to `/dashboard`

Failure handling:
- Return validation errors for missing or invalid fields
- Surface duplicate-email or auth-provider errors clearly

### Login action
Expected behavior:
- Authenticate with email and password
- Start the user session
- Redirect to `/dashboard`

Failure handling:
- Show invalid credentials without revealing sensitive detail

### Logout action
Expected behavior:
- End the session
- Redirect to `/login` or `/`

### Create workspace action
Expected behavior:
- Insert the workspace record
- Insert owner membership for the creator
- Auto-create the default `general` channel
- Return the newly created workspace route

### Invite member action
Expected behavior:
- Confirm the current user is the workspace owner
- Confirm the invited email belongs to an existing registered user
- Create a pending invite

Failure handling:
- Reject non-owner attempts
- Reject unknown emails
- Reject duplicate pending invites

### Accept invite action
Expected behavior:
- Confirm invite belongs to current user
- Create workspace membership if not already present
- Mark invite as accepted

### Decline invite action
Expected behavior:
- Confirm invite belongs to current user
- Mark invite as declined without creating membership

### Send message route or action
Expected behavior:
- Confirm current user is a workspace member
- Insert a `chat_messages` row
- Default to `message_type='user'` unless the input is a command
- Mark embeddings as `pending` for regular messages that should be indexed
- Let realtime deliver the new message to active clients

### `/ask` route or action
Expected behavior:
- Detect an input starting with `/ask `
- Save the original user command as a `command` message
- Generate the query embedding with Cohere
- Call the similarity-search RPC against the current workspace channel only
- Build the answer context from the retrieved messages
- Call the selected answer provider
- Save the answer as an `assistant` message
- Attach citations or source metadata linking back to retrieved messages
- Let realtime broadcast the answer to connected clients

## Command Behavior
- Messages beginning with `/ask ` are treated as command messages.
- The original command remains visible in chat.
- The answer appears as a separate assistant message.
- Citations should link to retrieved messages or snippets from the same workspace chat.
- Retrieval must exclude messages from every other workspace.

## Realtime Chat Flow
1. Client loads the workspace page.
2. Initial messages are fetched from the database.
3. Client subscribes to Supabase Realtime for that workspace channel.
4. New messages inserted by members appear live for all connected members.
5. Assistant answers inserted by the server also appear through the same realtime channel.

## Ownership and Access Expectations
- Unauthenticated users cannot access `/dashboard` or workspace pages.
- Non-members cannot access workspace chat or data.
- Owners can invite members and manage workspace-level settings.
- Members can participate in chat but cannot manage workspace membership.

## Data Scope Rules
- Workspace pages always act on a single workspace.
- v1 chat uses one default channel per workspace.
- `/ask` searches only the active workspace channel.
- No cross-workspace retrieval is allowed in v1.
