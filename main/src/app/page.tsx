import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-between rounded-[2.5rem] border border-black/10 bg-[var(--card)] p-6 shadow-[0_30px_120px_rgba(15,23,42,0.12)] backdrop-blur md:p-10">
        <header className="flex items-center justify-between gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.4em] text-slate-500">
              Org Context
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              Shared team memory, right inside the workspace chat.
            </h1>
          </div>
          <div className="flex gap-3">
            <Link
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
              href="/login"
            >
              Log in
            </Link>
            <Link
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              href="/signup"
            >
              Start now
            </Link>
          </div>
        </header>

        <section className="grid gap-10 py-16 md:grid-cols-[1.15fr_0.85fr] md:items-end">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="font-mono text-xs uppercase tracking-[0.4em] text-[var(--accent)]">
                Project workflow brain
              </p>
              <h2 className="max-w-3xl text-5xl font-semibold leading-[1.02] text-slate-950 md:text-7xl">
                Capture team chat, retrieve the right context, and keep momentum.
              </h2>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Create multiple workspaces, invite teammates, chat in realtime,
                and use `/ask` to pull semantically similar messages from your
                project history with source-backed answers.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-105"
                href="/signup"
              >
                Create account
              </Link>
              <Link
                className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-900"
                href="/login"
              >
                Open dashboard
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            {[
              "One default group channel per workspace",
              "Supabase Auth + Realtime + Postgres backbone",
              "Cohere embeddings for every chat message",
              "Workspace-level answer provider switching",
            ].map((feature, index) => (
              <div
                className="rounded-[2rem] border border-black/10 bg-white/80 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.08)]"
                key={feature}
              >
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
                  0{index + 1}
                </p>
                <p className="mt-3 text-base leading-7 text-slate-700">{feature}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-black/10 pt-6 font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
          Built for the first phase of Org Context v1
        </footer>
      </div>
    </main>
  );
}
