import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-xl rounded-[2rem] border border-black/10 bg-white/85 p-10 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--accent)]">
          Not found
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-slate-950">
          That workspace or page doesn&apos;t exist.
        </h1>
        <p className="mt-4 text-base leading-8 text-slate-600">
          Head back to the dashboard to pick a valid workspace.
        </p>
        <Link
          className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          href="/dashboard"
        >
          Open dashboard
        </Link>
      </div>
    </main>
  );
}
