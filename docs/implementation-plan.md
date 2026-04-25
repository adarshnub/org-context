# Org Context v1 Implementation Plan

## Summary
This document defines the recommended build order for Org Context v1. The goal is to reach a usable first release quickly while preserving a clean path for future expansion into richer workspace knowledge features.

The app root is `main/`. Supabase is the system of record for auth, database, realtime, and access control. Cohere handles embeddings, while `/ask` answer generation can use Cohere or OpenAI based on workspace configuration.

## Phase 1: App Foundation
### Goals
- Scaffold a Next.js App Router app inside `main/`
- Set up TypeScript, Tailwind, linting, and environment validation
- Add Supabase browser and server clients
- Establish public and authenticated route groups

### Work
- Initialize the Next.js project in `main/`
- Configure shared layout, metadata, fonts, and base styling
- Add a small environment parsing layer for required server and client envs
- Add reusable Supabase helpers for browser, server component, and server action contexts
- Create initial route structure for:
  - `/`
  - `/login`
  - `/signup`
  - `/dashboard`
  - `/workspaces/[workspaceId]`

### Acceptance criteria
- App boots locally from `main/`
- Missing required env vars fail loudly during startup
- Public routes load without session
- Protected routes can enforce authentication

## Phase 2: Auth and Profile System
### Goals
- Implement email/password auth
- Collect profile data at signup
- Add session-aware redirects and logout
- Persist user profile data alongside Supabase auth users

### Work
- Build signup form with:
  - `full_name`
  - `company_name`
  - `email`
  - `password`
- Build login form with email and password
- Add logout action
- On signup, create the Supabase auth user and corresponding `profiles` row
- Redirect authenticated users away from auth pages into the dashboard
- Redirect unauthenticated access to protected routes back to login

### Acceptance criteria
- Signup creates both auth user and profile record
- Login redirects to `/dashboard`
- Logout ends session cleanly
- Auth redirects work consistently

## Phase 3: Workspace and Membership Model
### Goals
- Allow each user to create multiple workspaces
- Add workspace membership and ownership rules
- Support inviting existing users only

### Work
- Build dashboard workspace list and create-workspace form
- On workspace creation:
  - insert workspace record
  - insert owner membership
  - create default `general` channel
- Add pending-invite view to the dashboard
- Add owner-only invite form inside the workspace
- Validate invited email against existing registered users
- Add accept and decline invite flows

### Acceptance criteria
- One user can create multiple workspaces
- Workspace creator becomes owner automatically
- Default `general` channel is created automatically
- Invites work only for existing users
- Accepted invites create usable memberships

## Phase 4: Chat Foundation
### Goals
- Deliver the base workspace group chat experience
- Persist messages and stream them in realtime

### Work
- Build workspace chat page with:
  - header and workspace identity
  - message list
  - message composer
  - member invite surface for owners
- Load historical messages for the current workspace channel
- Subscribe to Supabase Realtime for new messages
- Implement optimistic UI for message send
- Enforce membership on message reads and writes

### Acceptance criteria
- Only members can access workspace chat
- Sent messages are persisted and displayed
- Realtime messages propagate across multiple clients
- Non-members cannot read or post

## Phase 5: Embeddings Pipeline
### Goals
- Index chat messages for semantic retrieval without blocking chat usage

### Work
- Add embedding status fields to chat messages
- Create database webhook or trigger path for new user messages
- Build Edge Function or equivalent worker for:
  - fetching the message payload
  - generating a Cohere embedding
  - storing the vector in `chat_message_embeddings`
  - marking the message as completed or failed
- Add retry-safe logic so duplicate worker invocations do not create duplicate embedding rows
- Log failures for operational visibility

### Acceptance criteria
- User messages insert immediately
- Embeddings complete asynchronously
- Failed embeddings do not break chat
- Embedding status transitions are visible and consistent

## Phase 6: `/ask` Flow
### Goals
- Turn chat history into a workspace-scoped retrieval and answer experience

### Work
- Detect messages that begin with `/ask `
- Save the raw command as a visible command message
- Generate the query embedding using Cohere
- Call `match_chat_messages` with the current workspace and channel only
- Use top-k retrieved messages to build the answer context
- Route answer generation through the workspace-selected provider:
  - Cohere
  - OpenAI
- Save the answer as an assistant message with citations or source references
- Broadcast the assistant message through realtime updates

### Acceptance criteria
- `/ask` works from the workspace chat input
- Retrieval is limited to the current workspace channel
- Responses include traceable sources
- Switching provider changes only answer generation, not retrieval

## Phase 7: Hardening and Operability
### Goals
- Secure the system and make it supportable in development and production

### Work
- Finalize RLS and ownership checks
- Add request validation around auth, workspace creation, invites, and chat send
- Add basic rate limiting for sensitive flows if needed
- Add empty states and resilient error UI
- Add operational docs for setup, environments, and background jobs

### Acceptance criteria
- RLS blocks cross-workspace access
- Only owners can manage invites and workspace settings
- Common failure cases show usable UI states
- Setup docs are complete enough for a fresh machine

## Cross-Cutting Implementation Notes
- Use server actions for form-driven mutations when practical.
- Use route handlers for chat send and `/ask` flows if request/response structure is cleaner there.
- Keep service-role and provider API calls on the server only.
- Prefer simple v1 abstractions over future-proofed complexity.
- Do not expand beyond one default channel in this first milestone.
