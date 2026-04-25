# Org Context v1 Docs Index

## Summary
This folder contains the handoff documentation set for Org Context v1. The product is a Next.js app rooted in `main/`, backed by Supabase for auth, data, Realtime, and access control, with Cohere-powered embeddings and workspace-level answer-provider switching between Cohere and OpenAI.

## Document Map
- [architecture.md](./architecture.md)
  High-level product scope, system design, and workflow diagrams.
- [implementation-plan.md](./implementation-plan.md)
  Recommended build order, milestones, and phase acceptance criteria.
- [database-and-security.md](./database-and-security.md)
  Schema, indexes, retrieval RPC expectations, and RLS rules.
- [setup-and-env.md](./setup-and-env.md)
  Manual setup, local boot steps, required env vars, and troubleshooting.
- [api-and-app-flows.md](./api-and-app-flows.md)
  Route map, runtime behaviors, and core app flows.
- [test-plan.md](./test-plan.md)
  Verification checklist before shipping.

## Start Here
1. Read [architecture.md](./architecture.md) for the system overview.
2. Read [setup-and-env.md](./setup-and-env.md) before attempting any local or hosted setup.
3. Use [implementation-plan.md](./implementation-plan.md) as the execution order.
4. Use [database-and-security.md](./database-and-security.md) when writing SQL migrations and policies.
