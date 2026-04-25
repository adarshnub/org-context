import { ArrowLeft, Bug, Clock3 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getChatContextDebugData } from "@/lib/data";
import { isContextDebugPageEnabled } from "@/lib/env";
import { formatTimestamp } from "@/lib/utils";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-lg border border-[var(--line)] bg-[#13201d] p-4 text-xs leading-6 text-lime-50">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default async function ChatDebugPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isContextDebugPageEnabled()) {
    notFound();
  }

  const { workspaceId } = await params;
  const query = await searchParams;
  const runId = typeof query.runId === "string" ? query.runId : undefined;
  const { runs, selectedRun } = await getChatContextDebugData(workspaceId, runId);

  return (
    <main className="min-h-screen py-6">
      <div className="app-shell grid gap-5">
        <header className="animate-rise flex flex-col gap-5 border-b border-[var(--line)] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] transition hover:text-[var(--ink)]"
              href={`/workspaces/${workspaceId}/chat`}
            >
              <ArrowLeft size={16} />
              Back to chat
            </Link>
            <h1 className="mt-3 flex items-center gap-3 text-4xl font-semibold text-[var(--ink)]">
              <Bug size={32} />
              `/ask` context debug
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Dev-only inspector for the context, tools, and token usage captured
              during `/ask` runs.
            </p>
          </div>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
            ORG_CONTEXT_DEBUG_PAGE=true
          </span>
        </header>

        <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="surface p-4">
            <p className="eyebrow">Recent runs</p>
            <div className="mt-4 grid gap-2">
              {runs.length === 0 ? (
                <p className="text-sm leading-6 text-[var(--muted)]">
                  No `/ask` debug runs yet.
                </p>
              ) : null}
              {runs.map((run) => (
                <Link
                  className={`rounded-lg border p-3 text-sm transition hover:border-[var(--teal)] ${
                    selectedRun?.id === run.id
                      ? "border-[var(--teal)] bg-white"
                      : "border-[var(--line)] bg-white/60"
                  }`}
                  href={`/workspaces/${workspaceId}/chat/debug?runId=${run.id}`}
                  key={run.id}
                >
                  <span className="flex items-center gap-2 font-bold text-[var(--ink)]">
                    <Clock3 size={14} />
                    {formatTimestamp(run.createdAt)}
                  </span>
                  <span className="mt-2 line-clamp-2 block text-xs leading-5 text-[var(--muted)]">
                    {run.question}
                  </span>
                  <span className="mt-2 block text-xs font-bold text-[var(--teal)]">
                    {run.status}
                  </span>
                </Link>
              ))}
            </div>
          </aside>

          {selectedRun ? (
            <section className="grid gap-5">
              <section className="surface p-5">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="surface-plain p-4">
                    <p className="eyebrow">Input tokens</p>
                    <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">
                      {selectedRun.inputTokens ?? "n/a"}
                    </p>
                  </div>
                  <div className="surface-plain p-4">
                    <p className="eyebrow">Output tokens</p>
                    <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">
                      {selectedRun.outputTokens ?? "n/a"}
                    </p>
                  </div>
                  <div className="surface-plain p-4">
                    <p className="eyebrow">Token source</p>
                    <p className="mt-2 text-xl font-semibold text-[var(--ink)]">
                      {selectedRun.tokenSource}
                    </p>
                  </div>
                  <div className="surface-plain p-4">
                    <p className="eyebrow">Model</p>
                    <p className="mt-2 text-xl font-semibold text-[var(--ink)]">
                      {selectedRun.model ?? selectedRun.answerProvider}
                    </p>
                  </div>
                </div>
              </section>

              <section className="surface p-5">
                <p className="eyebrow">Question</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--ink)]">
                  {selectedRun.question}
                </p>
                {selectedRun.answer ? (
                  <>
                    <p className="eyebrow mt-5">Answer</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--ink)]">
                      {selectedRun.answer}
                    </p>
                  </>
                ) : null}
                {selectedRun.error ? (
                  <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {selectedRun.error}
                  </p>
                ) : null}
              </section>

              <section className="surface p-5">
                <p className="eyebrow">System prompt</p>
                <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-white/70 p-4 text-xs leading-6 text-[var(--ink)]">
                  {selectedRun.systemPrompt ?? "No system prompt captured."}
                </pre>
                <p className="eyebrow mt-5">Final model input</p>
                <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-white/70 p-4 text-xs leading-6 text-[var(--ink)]">
                  {selectedRun.modelInput ?? "No model input captured."}
                </pre>
              </section>

              <section className="grid gap-5 xl:grid-cols-2">
                <div className="surface p-5">
                  <p className="eyebrow">RAG snippets</p>
                  <JsonBlock value={selectedRun.ragSnippets} />
                </div>
                <div className="surface p-5">
                  <p className="eyebrow">Recent messages</p>
                  <JsonBlock value={selectedRun.recentMessages} />
                </div>
                <div className="surface p-5 xl:col-span-2">
                  <p className="eyebrow">Repository snippets</p>
                  <JsonBlock value={selectedRun.repositorySnippets} />
                </div>
                <div className="surface p-5">
                  <p className="eyebrow">Enabled tools</p>
                  <JsonBlock value={selectedRun.enabledTools} />
                </div>
                <div className="surface p-5">
                  <p className="eyebrow">Tool calls</p>
                  <JsonBlock value={selectedRun.toolCalls} />
                </div>
                <div className="surface p-5 xl:col-span-2">
                  <p className="eyebrow">Token breakdown</p>
                  <JsonBlock value={selectedRun.tokenBreakdown} />
                </div>
              </section>
            </section>
          ) : (
            <section className="surface grid min-h-96 place-items-center p-8 text-center">
              <div>
                <Bug className="mx-auto text-[var(--teal)]" size={32} />
                <p className="mt-3 text-lg font-bold text-[var(--ink)]">
                  No context runs captured yet.
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Run `/ask` in this workspace chat to populate the inspector.
                </p>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
