import { ArrowRight, BrainCircuit, LockKeyhole, MessagesSquare, Sparkles } from "lucide-react";
import Link from "next/link";

const signals = [
  { label: "Realtime", value: "Team chat" },
  { label: "Memory", value: "Cohere vectors" },
  { label: "Answering", value: "Cited /ask" },
];

const features = [
  {
    icon: MessagesSquare,
    title: "Workspace chat",
    text: "A focused shared channel for each project team.",
  },
  {
    icon: BrainCircuit,
    title: "Context retrieval",
    text: "Messages are embedded and searched inside the active workspace.",
  },
  {
    icon: LockKeyhole,
    title: "Scoped access",
    text: "Supabase auth and RLS keep team context bounded.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen py-6">
      <div className="app-shell">
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
          <Link className="flex items-center gap-3" href="/">
            <span className="grid size-10 place-items-center rounded-lg bg-[#13201d] text-white">
              <Sparkles size={18} />
            </span>
            <span>
              <span className="block text-sm font-bold text-[var(--ink)]">
                Org Context
              </span>
              <span className="block text-xs text-[var(--muted)]">
                Project workflow brain
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link className="btn-ghost hidden sm:inline-flex" href="/login">
              Log in
            </Link>
            <Link className="btn-primary" href="/signup">
              Start now <ArrowRight size={16} />
            </Link>
          </nav>
        </header>

        <section className="grid min-h-[calc(100vh-7rem)] gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="animate-rise max-w-3xl">
            <p className="eyebrow">Team context, live and searchable</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.03] text-[var(--ink)] md:text-7xl">
              Org Context
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              A realtime workspace chat that turns project communication into a
              retrievable memory layer. Ask the group chat what happened, what
              was decided, and where the useful context lives.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn-primary" href="/signup">
                Create account <ArrowRight size={16} />
              </Link>
              <Link className="btn-secondary" href="/login">
                Open dashboard
              </Link>
            </div>

            <div className="mt-10 grid max-w-2xl grid-cols-3 border-y border-[var(--line)]">
              {signals.map((signal) => (
                <div className="py-4 pr-4" key={signal.label}>
                  <p className="font-mono text-xs text-[var(--muted)]">
                    {signal.label}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[var(--ink)]">
                    {signal.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-rise stagger-2 surface overflow-hidden">
            <div className="border-b border-[var(--line)] bg-white/70 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">General</p>
                  <p className="mt-1 text-sm font-bold">Launch workspace</p>
                </div>
                <span className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  <span className="size-2 rounded-full bg-emerald-500 [animation:pulse-soft_1.6s_ease-in-out_infinite]" />
                  Live
                </span>
              </div>
            </div>

            <div className="grid gap-3 p-5">
              <div className="max-w-[82%] rounded-lg border border-[var(--line)] bg-white p-4">
                <p className="text-xs font-bold text-[var(--teal)]">Maya</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  We agreed to ship workspace invites before file ingestion.
                </p>
              </div>
              <div className="ml-auto max-w-[86%] rounded-lg bg-[#13201d] p-4 text-white">
                <p className="text-xs font-bold text-lime-200">/ask</p>
                <p className="mt-2 text-sm leading-6">
                  What did we decide about launch scope?
                </p>
              </div>
              <div className="rounded-lg border border-lime-200 bg-lime-50 p-4">
                <p className="text-xs font-bold text-lime-800">Org Context</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Launch scope is workspace creation, existing-user invites, and
                  realtime chat. File ingestion is out of v1.
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                    source 81d4e8
                  </span>
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                    0.842
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 pb-10 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <article
                className={`animate-rise surface-plain p-5 stagger-${index + 1}`}
                key={feature.title}
              >
                <Icon className="text-[var(--teal)]" size={22} />
                <h2 className="mt-4 text-lg font-bold text-[var(--ink)]">
                  {feature.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {feature.text}
                </p>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
