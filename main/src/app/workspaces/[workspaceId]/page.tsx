import Link from "next/link";

import {
  inviteUserAction,
  updateWorkspaceProviderAction,
} from "@/app/actions/workspace";
import { SubmitButton } from "@/components/forms/submit-button";
import { ChatRoom } from "@/components/chat/chat-room";
import { getWorkspaceDetail } from "@/lib/data";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { currentUser, workspace } = await getWorkspaceDetail(workspaceId);

  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="rounded-[2rem] border border-black/10 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <Link
                className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500"
                href="/dashboard"
              >
                Back to dashboard
              </Link>
              <h1 className="mt-3 text-4xl font-semibold text-slate-950">
                {workspace.name}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-8 text-slate-600">
                One default group channel, realtime chat, and `/ask` retrieval
                for this workspace only.
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-slate-700">
              Role: {workspace.role} / Provider: {workspace.answerProvider}
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <ChatRoom
            channelId={workspace.channelId}
            currentUserId={currentUser.id}
            currentUserName={currentUser.fullName}
            initialMessages={workspace.messages}
            members={workspace.members}
            workspaceId={workspace.id}
          />

          <div className="grid gap-6">
            <section className="rounded-[2rem] border border-black/10 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
                Workspace members
              </p>
              <div className="mt-5 grid gap-3">
                {workspace.members.map((member) => (
                  <div
                    className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4"
                    key={member.userId}
                  >
                    <p className="font-semibold text-slate-900">
                      {member.fullName}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{member.email}</p>
                    <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
                      {member.role}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {workspace.role === "owner" ? (
              <>
                <section className="rounded-[2rem] border border-black/10 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                  <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
                    Invite teammate
                  </p>
                  <form
                    action={inviteUserAction.bind(null, workspace.id)}
                    className="mt-4 grid gap-3"
                  >
                    <input
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900"
                      name="email"
                      placeholder="teammate@company.com"
                      required
                      type="email"
                    />
                    <SubmitButton
                      className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                      pendingLabel="Inviting..."
                    >
                      Send invite
                    </SubmitButton>
                  </form>
                  <p className="mt-3 text-sm text-slate-500">
                    v1 invites only work for emails that are already registered.
                  </p>
                </section>

                <section className="rounded-[2rem] border border-black/10 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                  <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
                    `/ask` provider
                  </p>
                  <form
                    action={updateWorkspaceProviderAction.bind(null, workspace.id)}
                    className="mt-4 grid gap-3"
                  >
                    <select
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900"
                      defaultValue={workspace.answerProvider}
                      name="provider"
                    >
                      <option value="cohere">Cohere</option>
                      <option value="openai">OpenAI</option>
                    </select>
                    <SubmitButton
                      className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                      pendingLabel="Saving..."
                    >
                      Save provider
                    </SubmitButton>
                  </form>
                </section>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
