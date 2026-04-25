import {
  ArrowLeft,
  BarChart3,
  Bot,
  BrainCircuit,
  Clock3,
  Gauge,
  Layers3,
} from "lucide-react";
import Link from "next/link";

import { getTokenUsageData } from "@/lib/data";
import { formatTimestamp } from "@/lib/utils";

function formatNumber(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSource(source: string) {
  return source === "provider" ? "provider reported" : "estimated";
}

export default async function TokenUsagePage() {
  const usage = await getTokenUsageData();
  const mostUsedModel = usage.models[0]?.model ?? "No model yet";

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
            <h1 className="mt-3 flex items-center gap-3 text-4xl font-semibold text-[var(--ink)]">
              <BarChart3 size={34} />
              Token usage
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Your `/ask` usage across workspaces, including answer models,
              token totals, and whether counts came from a provider response or
              local estimation.
            </p>
          </div>
          <span className="rounded-md border border-[var(--line)] bg-white/70 px-3 py-2 text-sm font-bold text-[var(--ink)]">
            {formatNumber(usage.totals.runCount)} runs tracked
          </span>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="animate-rise stagger-1 surface p-5">
            <div className="flex items-center gap-3">
              <Gauge className="text-[var(--teal)]" size={20} />
              <p className="eyebrow">Total tokens</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-[var(--ink)]">
              {formatNumber(usage.totals.totalTokens)}
            </p>
          </div>
          <div className="animate-rise stagger-1 surface p-5">
            <div className="flex items-center gap-3">
              <Layers3 className="text-[var(--teal)]" size={20} />
              <p className="eyebrow">Input</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-[var(--ink)]">
              {formatNumber(usage.totals.inputTokens)}
            </p>
          </div>
          <div className="animate-rise stagger-2 surface p-5">
            <div className="flex items-center gap-3">
              <Bot className="text-[var(--teal)]" size={20} />
              <p className="eyebrow">Output</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-[var(--ink)]">
              {formatNumber(usage.totals.outputTokens)}
            </p>
          </div>
          <div className="animate-rise stagger-2 surface p-5">
            <div className="flex items-center gap-3">
              <BrainCircuit className="text-[var(--teal)]" size={20} />
              <p className="eyebrow">Top model</p>
            </div>
            <p className="mt-3 truncate text-xl font-semibold text-[var(--ink)]">
              {mostUsedModel}
            </p>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="animate-rise stagger-2 surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Models</p>
                <h2 className="mt-1 text-2xl font-semibold text-[var(--ink)]">
                  Models used by your asks
                </h2>
              </div>
              <span className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                {usage.totals.providerReportedRuns} provider /{" "}
                {usage.totals.estimatedRuns} estimated
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              {usage.models.length === 0 ? (
                <div className="surface-plain p-5 text-sm leading-6 text-[var(--muted)]">
                  Run `/ask` from a workspace chat to start collecting model
                  and token usage.
                </div>
              ) : null}

              {usage.models.map((model) => (
                <article
                  className="surface-plain grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_220px]"
                  key={`${model.provider}:${model.model}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[#13201d] px-2.5 py-1 text-xs font-bold text-white">
                        {model.provider}
                      </span>
                      <h3 className="truncate text-lg font-bold text-[var(--ink)]">
                        {model.model}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {model.runCount} runs / {formatSource(model.source)} /
                      phases: {model.phases.join(", ")}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="eyebrow">In</p>
                      <p className="mt-1 font-bold text-[var(--ink)]">
                        {formatNumber(model.inputTokens)}
                      </p>
                    </div>
                    <div>
                      <p className="eyebrow">Out</p>
                      <p className="mt-1 font-bold text-[var(--ink)]">
                        {formatNumber(model.outputTokens)}
                      </p>
                    </div>
                    <div>
                      <p className="eyebrow">Total</p>
                      <p className="mt-1 font-bold text-[var(--ink)]">
                        {formatNumber(model.totalTokens)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="animate-rise stagger-3 surface p-5">
            <p className="eyebrow">Workspaces</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ink)]">
              Usage by project
            </h2>
            <div className="mt-5 grid gap-2">
              {usage.workspaces.map((workspace) => (
                <Link
                  className="surface-plain block p-3 transition hover:-translate-y-0.5 hover:border-teal-500/50 hover:bg-white"
                  href={`/workspaces/${workspace.workspaceId}/chat`}
                  key={workspace.workspaceId}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--ink)]">
                        {workspace.workspaceName}
                      </p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {workspace.slug || "workspace"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-[var(--teal)]">
                      {formatNumber(workspace.totalTokens)}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-[var(--teal)]"
                      style={{
                        width:
                          usage.totals.totalTokens > 0
                            ? `${Math.max(
                                4,
                                (workspace.totalTokens /
                                  usage.totals.totalTokens) *
                                  100,
                              )}%`
                            : "0%",
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        </section>

        <section className="animate-rise stagger-3 surface p-5">
          <div className="flex items-center gap-3">
            <Clock3 className="text-[var(--teal)]" size={20} />
            <div>
              <p className="eyebrow">Recent</p>
              <h2 className="text-xl font-semibold text-[var(--ink)]">
                Latest tracked asks
              </h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {usage.recentRuns.length === 0 ? (
              <div className="surface-plain p-4 text-sm leading-6 text-[var(--muted)]">
                No token usage has been recorded for your account yet.
              </div>
            ) : null}

            {usage.recentRuns.map((run) => (
              <article
                className="surface-plain grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_280px]"
                key={`${run.workspaceId}:${run.createdAt}:${run.question}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--muted)]">
                    <span>{run.workspaceName}</span>
                    <span>/</span>
                    <span>{formatTimestamp(run.createdAt)}</span>
                    <span>/</span>
                    <span>{run.status}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--ink)]">
                    {run.question}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="eyebrow">Model</p>
                    <p className="mt-1 truncate text-sm font-bold text-[var(--ink)]">
                      {run.model ?? run.answerProvider}
                    </p>
                  </div>
                  <div>
                    <p className="eyebrow">Tokens</p>
                    <p className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {formatNumber(run.totalTokens)}
                    </p>
                  </div>
                  <div>
                    <p className="eyebrow">Source</p>
                    <p className="mt-1 text-sm font-bold text-[var(--ink)]">
                      {run.source}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
