import {
  BarChart3,
  Inbox,
  LogOut,
  MessageSquareText,
  Plus,
  Settings2,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import {
  acceptInviteAction,
  createWorkspaceAction,
  declineInviteAction,
} from "@/app/actions/dashboard";
import { logoutAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms/submit-button";
import { getDashboardData } from "@/lib/data";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const { invites, profile, workspaces } = await getDashboardData();

  return (
    <main className="min-h-screen py-6">
      <div className="app-shell grid gap-5">
        <header className="animate-rise flex flex-col gap-5 border-b border-[var(--line)] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1 className="mt-2 text-4xl font-semibold text-[var(--ink)]">
              Welcome, {profile?.full_name ?? "teammate"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Manage workspaces, accept invites, and keep each project channel
              ready for realtime context retrieval.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn-secondary" href="/dashboard/token-usage">
              <BarChart3 size={16} />
              Token usage
            </Link>
            <form action={logoutAction}>
              <SubmitButton className="btn-secondary" pendingLabel="Signing out...">
                <LogOut size={16} />
                Sign out
              </SubmitButton>
            </form>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="animate-rise stagger-1 surface p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-[#13201d] text-white">
                <Plus size={18} />
              </span>
              <div>
                <p className="eyebrow">Create</p>
                <h2 className="text-lg font-bold text-[var(--ink)]">
                  New workspace
                </h2>
              </div>
            </div>

            {error ? (
              <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                {error}
              </p>
            ) : null}

            <form action={createWorkspaceAction} className="mt-5 grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[var(--ink)]">
                  Workspace name
                </span>
                <input
                  className="field"
                  name="name"
                  placeholder="Launch Squad"
                  required
                  type="text"
                />
              </label>
              <SubmitButton className="btn-primary" pendingLabel="Creating...">
                Create workspace <Plus size={16} />
              </SubmitButton>
            </form>

            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <p className="text-sm leading-6 text-[var(--muted)]">
                Every workspace starts with a `general` channel, owner-managed
                invites, and a selectable `/ask` answer provider.
              </p>
            </div>
          </aside>

          <div className="grid gap-5">
            <section className="animate-rise stagger-2 surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">Workspaces</p>
                  <h2 className="mt-1 text-2xl font-semibold text-[var(--ink)]">
                    Active project spaces
                  </h2>
                </div>
                <span className="rounded-md border border-[var(--line)] bg-white/70 px-3 py-2 text-sm font-bold text-[var(--ink)]">
                  {workspaces.length} total
                </span>
              </div>

              <div className="mt-5 grid gap-3">
                {workspaces.length === 0 ? (
                  <div className="surface-plain flex items-start gap-3 p-4">
                    <Inbox className="text-[var(--muted)]" size={20} />
                    <p className="text-sm leading-6 text-[var(--muted)]">
                      No workspaces yet. Create one to open the team chat.
                    </p>
                  </div>
                ) : null}

                {workspaces.map((workspace) => (
                  <article
                    className="group surface-plain grid gap-3 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-teal-500/50 hover:bg-white"
                    key={workspace.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--ink)]">
                          {workspace.name}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {workspace.slug} / {workspace.answerProvider}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                        <UsersRound size={14} />
                        {workspace.role}
                      </span>
                    </div>
                    <div className="h-px bg-[var(--line)] transition group-hover:bg-teal-500/40" />
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="btn-primary"
                        href={`/workspaces/${workspace.id}/chat`}
                      >
                        <MessageSquareText size={16} />
                        Open chat
                      </Link>
                      <Link
                        className="btn-secondary"
                        href={`/workspaces/${workspace.id}`}
                      >
                        <Settings2 size={16} />
                        Overview
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="animate-rise stagger-3 surface p-5">
              <div className="flex items-center gap-3">
                <Inbox className="text-[var(--teal)]" size={20} />
                <div>
                  <p className="eyebrow">Invites</p>
                  <h2 className="text-xl font-semibold text-[var(--ink)]">
                    Pending invitations
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {invites.length === 0 ? (
                  <div className="surface-plain p-4 text-sm text-[var(--muted)]">
                    No pending invites right now.
                  </div>
                ) : null}

                {invites.map((invite) => (
                  <div className="surface-plain p-4" key={invite.id}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="font-bold text-[var(--ink)]">
                          {invite.workspaceName}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          Invited as {invite.invitedEmail}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <form action={acceptInviteAction}>
                          <input name="inviteId" type="hidden" value={invite.id} />
                          <SubmitButton className="btn-primary" pendingLabel="Joining...">
                            Accept
                          </SubmitButton>
                        </form>
                        <form action={declineInviteAction}>
                          <input name="inviteId" type="hidden" value={invite.id} />
                          <SubmitButton className="btn-secondary" pendingLabel="Updating...">
                            Decline
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
