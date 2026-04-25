import { ArrowLeft, Settings2 } from "lucide-react";
import Link from "next/link";

import { ChatRoom } from "@/components/chat/chat-room";
import { getWorkspaceDetail } from "@/lib/data";

export default async function WorkspaceChatPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { currentUser, workspace } = await getWorkspaceDetail(workspaceId);

  return (
    <main className="h-dvh overflow-hidden py-4">
      <div className="app-shell flex h-full min-h-0 flex-col gap-3">
        <header className="animate-rise flex shrink-0 flex-col gap-3 border-b border-[var(--line)] pb-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] transition hover:text-[var(--ink)]"
              href={`/workspaces/${workspace.id}`}
            >
              <ArrowLeft size={16} />
              Workspace overview
            </Link>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--ink)] md:text-4xl">
              {workspace.name} chat
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Realtime group communication for the default `general` channel.
              Use `/ask` here to retrieve sourced context from this workspace.
            </p>
          </div>
          <Link className="btn-secondary" href={`/workspaces/${workspace.id}`}>
            <Settings2 size={16} />
            Settings
          </Link>
        </header>

        <section className="animate-rise stagger-1 flex min-h-0 flex-1">
          <ChatRoom
            channelId={workspace.channelId}
            currentUserId={currentUser.id}
            currentUserName={currentUser.fullName}
            initialMessages={workspace.messages}
            members={workspace.members}
            workspaceId={workspace.id}
          />
        </section>
      </div>
    </main>
  );
}
