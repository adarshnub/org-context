import { ArrowLeft, Radio, Settings2 } from "lucide-react";

export default function WorkspaceChatLoading() {
  return (
    <main className="h-dvh overflow-hidden py-4">
      <div className="app-shell flex h-full min-h-0 flex-col gap-3">
        <header className="animate-rise flex shrink-0 flex-col gap-3 border-b border-[var(--line)] pb-3 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)]">
              <ArrowLeft size={16} />
              Workspace overview
            </span>
            <div className="skeleton-sheen mt-3 h-10 w-72 rounded-md" />
            <div className="skeleton-sheen mt-3 h-4 w-full max-w-xl rounded-md" />
            <div className="skeleton-sheen mt-2 h-4 w-full max-w-md rounded-md" />
          </div>
          <span className="btn-secondary pointer-events-none opacity-70">
            <Settings2 size={16} />
            Settings
          </span>
        </header>

        <section className="animate-rise stagger-1 surface flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-white/70 px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-[#13201d] text-white">
                <Radio size={18} />
              </span>
              <div>
                <div className="skeleton-sheen h-3 w-28 rounded-md" />
                <div className="skeleton-sheen mt-2 h-5 w-48 rounded-md" />
              </div>
            </div>
            <div className="skeleton-sheen h-9 w-40 rounded-md" />
          </div>

          <div className="grid min-h-0 flex-1 content-start gap-3 p-5">
            <div className="skeleton-sheen h-20 w-[min(34rem,82%)] rounded-lg" />
            <div className="skeleton-sheen ml-auto h-24 w-[min(38rem,88%)] rounded-lg" />
            <div className="skeleton-sheen h-16 w-[min(28rem,72%)] rounded-lg" />
          </div>
        </section>

        <section className="surface shrink-0 p-3">
          <div className="skeleton-sheen h-3 w-20 rounded-md" />
          <div className="skeleton-sheen mt-3 h-16 rounded-lg" />
          <div className="mt-3 flex justify-end">
            <div className="skeleton-sheen h-11 w-28 rounded-lg" />
          </div>
        </section>
      </div>
    </main>
  );
}
