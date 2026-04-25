import {
  ArrowLeft,
  Bot,
  MailPlus,
  MessageSquareText,
  Settings2,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import {
  inviteUserAction,
  updateWorkspaceProviderAction,
} from "@/app/actions/workspace";
import { SubmitButton } from "@/components/forms/submit-button";
import { getWorkspaceDetail } from "@/lib/data";

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceId } = await params;
  const query = await searchParams;
  const inviteError =
    typeof query.inviteError === "string" ? query.inviteError : null;
  const inviteMessage =
    typeof query.inviteMessage === "string" ? query.inviteMessage : null;
  const { workspace } = await getWorkspaceDetail(workspaceId);

  return (
    <main className="min-h-screen py-6">
      <div className="app-shell grid gap-5">
        <header className="animate-rise flex flex-col gap-5 border-b border-[var(--line)] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] transition hover:text-[var(--ink)]"
              href="/dashboard"
            >
              <ArrowLeft size={16} />
              Dashboard
            </Link>
            <h1 className="mt-3 text-4xl font-semibold text-[var(--ink)]">
              {workspace.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Workspace overview, members, invite controls, and `/ask` provider
              settings. The live group chat now has its own focused page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn-primary" href={`/workspaces/${workspace.id}/chat`}>
              <MessageSquareText size={16} />
              Open chat
            </Link>
            <span className="rounded-md border border-[var(--line)] bg-white/70 px-3 py-2 text-sm font-bold text-[var(--ink)]">
              {workspace.role}
            </span>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="animate-rise stagger-1 surface p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-[#13201d] text-white">
                <MessageSquareText size={18} />
              </span>
              <div>
                <p className="eyebrow">Group channel</p>
                <h2 className="text-2xl font-semibold text-[var(--ink)]">
                  {workspace.channelName}
                </h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="surface-plain p-4">
                <p className="eyebrow">Messages</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">
                  {workspace.messages.length}
                </p>
              </div>
              <div className="surface-plain p-4">
                <p className="eyebrow">Members</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">
                  {workspace.members.length}
                </p>
              </div>
              <div className="surface-plain p-4">
                <p className="eyebrow">Provider</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">
                  {workspace.answerProvider}
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
                Use the chat page when you want the realtime communication
                surface. This overview stays reserved for workspace state,
                membership, and owner settings.
              </p>
              <Link
                className="btn-primary mt-5"
                href={`/workspaces/${workspace.id}/chat`}
              >
                <MessageSquareText size={16} />
                Go to group chat
              </Link>
            </div>
          </section>

          <aside className="grid content-start gap-5">
            <section className="animate-rise stagger-2 surface p-5">
              <div className="flex items-center gap-3">
                <UsersRound className="text-[var(--teal)]" size={20} />
                <div>
                  <p className="eyebrow">Members</p>
                  <h2 className="text-lg font-bold text-[var(--ink)]">
                    Workspace team
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-2">
                {workspace.members.map((member) => (
                  <div className="surface-plain p-3" key={member.userId}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--ink)]">
                          {member.fullName}
                        </p>
                        <p className="truncate text-xs text-[var(--muted)]">
                          {member.email}
                        </p>
                      </div>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-[var(--muted)]">
                        {member.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {workspace.role === "owner" ? (
              <>
                <section className="animate-rise stagger-2 surface p-5">
                  <div className="flex items-center gap-3">
                    <MailPlus className="text-[var(--teal)]" size={20} />
                    <div>
                      <p className="eyebrow">Invite</p>
                      <h2 className="text-lg font-bold text-[var(--ink)]">
                        Add teammate
                      </h2>
                    </div>
                  </div>
                  <form
                    action={inviteUserAction.bind(null, workspace.id)}
                    className="mt-5 grid gap-3"
                  >
                    <input
                      className="field"
                      name="email"
                      placeholder="teammate@company.com"
                      required
                      type="email"
                    />
                    <SubmitButton className="btn-primary" pendingLabel="Inviting...">
                      Send invite
                    </SubmitButton>
                  </form>
                  {inviteError ? (
                    <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700">
                      {inviteError}
                    </p>
                  ) : null}
                  {inviteMessage ? (
                    <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-700">
                      {inviteMessage}
                    </p>
                  ) : null}
                </section>

                <section className="animate-rise stagger-3 surface p-5">
                  <div className="flex items-center gap-3">
                    <Settings2 className="text-[var(--teal)]" size={20} />
                    <div>
                      <p className="eyebrow">Settings</p>
                      <h2 className="text-lg font-bold text-[var(--ink)]">
                        Answer provider
                      </h2>
                    </div>
                  </div>
                  <form
                    action={updateWorkspaceProviderAction.bind(null, workspace.id)}
                    className="mt-5 grid gap-3"
                  >
                    <label className="grid gap-2">
                      <span className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                        <Bot size={16} />
                        `/ask` model
                      </span>
                      <select
                        className="field"
                        defaultValue={workspace.answerProvider}
                        name="provider"
                      >
                        <option value="cohere">Cohere</option>
                        <option value="openai">OpenAI</option>
                      </select>
                    </label>
                    <SubmitButton className="btn-secondary" pendingLabel="Saving...">
                      Save provider
                    </SubmitButton>
                  </form>
                </section>
              </>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
