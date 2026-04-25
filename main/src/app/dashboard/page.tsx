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
    <main className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="grid gap-4 rounded-[2rem] border border-black/10 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--accent)]">
              Dashboard
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-slate-950">
              Welcome, {profile?.full_name ?? "teammate"}.
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-8 text-slate-600">
              Create multiple workspaces, keep each team in a shared realtime
              channel, and let `/ask` retrieve the right context from the chat
              history.
            </p>
          </div>
          <form action={logoutAction}>
            <SubmitButton
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
              pendingLabel="Signing out..."
            >
              Sign out
            </SubmitButton>
          </form>
        </header>

        <section className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-black/10 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
              Create workspace
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">
              Start a new team context space.
            </h2>
            {error ? (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                {error}
              </p>
            ) : null}
            <form
              action={createWorkspaceAction}
              className="mt-6 grid gap-3"
            >
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900"
                name="name"
                placeholder="Launch Squad"
                required
                type="text"
              />
              <SubmitButton
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                pendingLabel="Creating..."
              >
                Create workspace
              </SubmitButton>
            </form>

            <div className="mt-8 rounded-[1.5rem] bg-slate-50 p-4 text-sm leading-7 text-slate-600">
              Each workspace starts with one default realtime chat channel named
              `general`, owner-managed invites, and provider selection for
              `/ask`.
            </div>
          </div>

          <div className="grid gap-6">
            <section className="rounded-[2rem] border border-black/10 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
                    Workspaces
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    Your active spaces
                  </h2>
                </div>
                <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-slate-700">
                  {workspaces.length} total
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                {workspaces.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                    No workspaces yet. Create your first one from the panel on
                    the left.
                  </div>
                ) : null}
                {workspaces.map((workspace) => (
                  <Link
                    className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-slate-900 hover:bg-white"
                    href={`/workspaces/${workspace.id}`}
                    key={workspace.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {workspace.name}
                      </h3>
                      <span className="rounded-full bg-white px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
                        {workspace.role}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      Slug: {workspace.slug} · `/ask` provider:{" "}
                      {workspace.answerProvider}
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-black/10 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
                Pending invites
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Invitations waiting for you
              </h2>

              <div className="mt-5 grid gap-4">
                {invites.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                    No pending invites right now.
                  </div>
                ) : null}
                {invites.map((invite) => (
                  <div
                    className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"
                    key={invite.id}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {invite.workspaceName}
                        </h3>
                        <p className="mt-2 text-sm text-slate-600">
                          Invited as {invite.invitedEmail}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <form action={acceptInviteAction}>
                          <input
                            name="inviteId"
                            type="hidden"
                            value={invite.id}
                          />
                          <SubmitButton
                            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                            pendingLabel="Joining..."
                          >
                            Accept
                          </SubmitButton>
                        </form>
                        <form action={declineInviteAction}>
                          <input
                            name="inviteId"
                            type="hidden"
                            value={invite.id}
                          />
                          <SubmitButton
                            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                            pendingLabel="Updating..."
                          >
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
