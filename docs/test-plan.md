# Org Context v1 Test Plan

## Summary
This checklist defines the minimum testing needed before Org Context v1 is considered ready for internal use. The focus is correctness, access control, realtime behavior, and retrieval isolation.

## Auth and Session
- Sign up with `full_name`, `company_name`, `email`, and `password`.
- Confirm signup creates both auth user and profile data.
- Log in with a valid email and password.
- Confirm login redirects to `/dashboard`.
- Log out and confirm protected routes are no longer accessible.
- Attempt to access `/dashboard` while logged out and confirm redirect to login.

## Workspace Lifecycle
- Create one workspace and confirm it appears on the dashboard.
- Create multiple workspaces from the same account and confirm each remains accessible.
- Confirm workspace creator is assigned the `owner` role.
- Confirm a default `general` channel is created automatically.

## Invitations
- Invite an existing registered user and confirm a pending invite is created.
- Attempt to invite a non-existent email and confirm the action is rejected.
- Accept a valid invite as the invited user and confirm the workspace becomes visible.
- Decline a valid invite and confirm no membership is created.
- Attempt duplicate pending invites and confirm duplicates are blocked.
- Attempt invite creation as a non-owner and confirm it is rejected.

## Access Control
- Open a workspace as a member and confirm chat data loads.
- Attempt to open a workspace as a non-member and confirm access is denied.
- Attempt to send a message as a non-member and confirm insertion is blocked.
- Verify workspace lists, invites, and messages do not leak across workspaces.
- Verify RLS blocks direct cross-workspace reads and writes.

## Realtime Chat
- Open the same workspace in two browser sessions.
- Send a message from one session and confirm it appears in the other session without refresh.
- Confirm message order is stable when multiple messages are sent quickly.
- Refresh the workspace page and confirm persisted history reloads correctly.

## Embeddings Pipeline
- Send a normal chat message and confirm it is stored immediately.
- Confirm the message begins with `embedding_status='pending'`.
- Confirm the background worker creates a vector row and transitions the message to `completed`.
- Simulate or inspect a worker failure and confirm the message transitions to `failed` without breaking chat UX.
- Confirm duplicate worker invocations do not create duplicate embedding rows.

## `/ask` Retrieval and Answers
- Send several semantically different messages into the same workspace.
- Run `/ask` and confirm the original command stays visible in chat.
- Confirm the retrieval step searches only the current workspace channel.
- Confirm top-k retrieval returns relevant prior messages.
- Confirm the generated assistant reply appears as a separate message.
- Confirm the assistant reply includes source references or citations.
- Confirm switching the workspace answer provider changes only the answer generation backend.
- Confirm embeddings still come from Cohere regardless of answer provider.

## Security and Secrets
- Confirm service-role and provider keys are not exposed in the browser.
- Confirm server-only code paths are the only place private env vars are used.
- Confirm assistant and system messages are not writable through untrusted client paths.

## Manual Verification Before Shipping
- Supabase auth redirects are configured for local and production environments.
- Realtime is enabled for the required tables.
- `pgvector` is enabled and vector dimensions match the selected Cohere embedding setup.
- The embedding webhook or worker is deployed and reachable.
- Required local and production env vars are present.
