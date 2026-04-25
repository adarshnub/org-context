"use client";

import { GitBranch, GitFork, RefreshCcw, Trash2, X } from "lucide-react";
import { useState } from "react";

import {
  connectGitHubRepositoryAction,
  disconnectGitHubRepositoryAction,
  syncGitHubRepositoryAction,
} from "@/app/actions/workspace";
import { SubmitButton } from "@/components/forms/submit-button";
import { formatTimestamp } from "@/lib/utils";
import type { WorkspaceRepository } from "@/lib/types";

function shortSha(value: string | null) {
  return value ? value.slice(0, 8) : "not indexed";
}

function statusClass(status: WorkspaceRepository["syncStatus"]) {
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "failed") {
    return "bg-rose-50 text-rose-700";
  }

  if (status === "partial") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-sky-50 text-sky-700";
}

export function GitHubRepositoriesPanel({
  canManage,
  repoError,
  repoMessage,
  repositories,
  workspaceId,
}: {
  canManage: boolean;
  repoError: string | null;
  repoMessage: string | null;
  repositories: WorkspaceRepository[];
  workspaceId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="animate-rise stagger-3 surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-[#13201d] text-white">
            <GitFork size={19} />
          </span>
          <div>
            <p className="eyebrow">GitHub</p>
            <h2 className="text-lg font-bold text-[var(--ink)]">
              Indexed repositories
            </h2>
          </div>
        </div>
        {canManage ? (
          <button
            className="btn-primary"
            onClick={() => setOpen(true)}
            type="button"
          >
            <GitFork size={16} />
            Connect repo
          </button>
        ) : null}
      </div>

      {repoError ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700">
          {repoError}
        </p>
      ) : null}
      {repoMessage ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-700">
          {repoMessage}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3">
        {repositories.length === 0 ? (
          <div className="surface-plain p-4 text-sm leading-6 text-[var(--muted)]">
            No repositories connected yet. Connect a GitHub repo to let `/ask`
            use code evidence alongside chat memory.
          </div>
        ) : null}

        {repositories.map((repository) => (
          <article className="surface-plain p-4" key={repository.id}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-bold text-[var(--ink)]">
                    {repository.githubOwner}/{repository.githubRepo}
                  </h3>
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-bold ${statusClass(
                      repository.syncStatus,
                    )}`}
                  >
                    {repository.syncStatus}
                  </span>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--muted)]">
                  <GitBranch size={13} />
                  {repository.branch}
                  <span>/</span>
                  commit {shortSha(repository.lastIndexedCommitSha)}
                  <span>/</span>
                  {repository.hasToken ? "private token stored" : "public/no token"}
                </p>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                  {repository.fileCount} files / {repository.chunkCount} chunks
                  {repository.lastSyncedAt
                    ? ` / synced ${formatTimestamp(repository.lastSyncedAt)}`
                    : ""}
                </p>
                {repository.lastSync?.error ? (
                  <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                    {repository.lastSync.error}
                  </p>
                ) : null}
              </div>

              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  <form action={syncGitHubRepositoryAction.bind(null, workspaceId)}>
                    <input
                      name="repositoryId"
                      type="hidden"
                      value={repository.id}
                    />
                    <SubmitButton
                      className="btn-secondary"
                      pendingLabel="Syncing..."
                    >
                      <RefreshCcw size={16} />
                      Sync now
                    </SubmitButton>
                  </form>
                  <form
                    action={disconnectGitHubRepositoryAction.bind(null, workspaceId)}
                  >
                    <input
                      name="repositoryId"
                      type="hidden"
                      value={repository.id}
                    />
                    <SubmitButton
                      className="btn-ghost border-rose-200 text-rose-700"
                      pendingLabel="Removing..."
                    >
                      <Trash2 size={16} />
                      Disconnect
                    </SubmitButton>
                  </form>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#13201d]/45 p-4 backdrop-blur-sm">
          <section className="surface w-full max-w-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Connect source</p>
                <h3 className="mt-1 text-2xl font-semibold text-[var(--ink)]">
                  Index a GitHub repository
                </h3>
              </div>
              <button
                aria-label="Close GitHub repository modal"
                className="btn-ghost px-3"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <form
              action={connectGitHubRepositoryAction.bind(null, workspaceId)}
              className="mt-5 grid gap-4"
            >
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[var(--ink)]">
                  Repository URL
                </span>
                <input
                  className="field"
                  name="repoUrl"
                  placeholder="https://github.com/owner/repo"
                  required
                  type="url"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[var(--ink)]">
                  Branch
                </span>
                <input
                  className="field"
                  defaultValue="main"
                  name="branch"
                  required
                  type="text"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[var(--ink)]">
                  GitHub token (recommended)
                </span>
                <input
                  className="field"
                  name="accessToken"
                  placeholder="Required for private repos; recommended for public repos"
                  type="password"
                />
                <span className="text-xs leading-5 text-[var(--muted)]">
                  Public repos can sync without a token, but GitHub gives
                  unauthenticated Edge Function traffic a much lower rate limit.
                </span>
              </label>
              <label className="surface-plain flex items-start gap-3 p-3">
                <input
                  className="mt-1 size-4 accent-[#0f766e]"
                  defaultChecked
                  name="syncHourly"
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-bold text-[var(--ink)]">
                    Sync every hour
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                    Hourly syncs call the Edge Function directly and only
                    re-index files changed since the last indexed commit.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--line)] pt-4">
                <button
                  className="btn-secondary"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <SubmitButton className="btn-primary" pendingLabel="Syncing...">
                  <GitFork size={16} />
                  Connect and sync
                </SubmitButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
