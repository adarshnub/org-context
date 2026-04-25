import { ArrowLeft, BarChart3 } from "lucide-react";

export default function TokenUsageLoading() {
  return (
    <main className="min-h-screen py-6">
      <div className="app-shell grid gap-5">
        <header className="animate-rise flex flex-col gap-5 border-b border-[var(--line)] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)]">
              <ArrowLeft size={16} />
              Dashboard
            </span>
            <h1 className="mt-3 flex items-center gap-3 text-4xl font-semibold text-[var(--ink)]">
              <BarChart3 size={34} />
              Token usage
            </h1>
            <div className="skeleton-sheen mt-4 h-4 w-full max-w-xl rounded-md" />
            <div className="skeleton-sheen mt-2 h-4 w-full max-w-md rounded-md" />
          </div>
          <div className="skeleton-sheen h-10 w-36 rounded-md" />
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div className="surface p-5" key={item}>
              <div className="skeleton-sheen h-4 w-24 rounded-md" />
              <div className="skeleton-sheen mt-4 h-9 w-32 rounded-md" />
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="surface p-5">
            <div className="skeleton-sheen h-6 w-56 rounded-md" />
            <div className="mt-5 grid gap-3">
              {[0, 1, 2].map((item) => (
                <div className="skeleton-sheen h-24 rounded-lg" key={item} />
              ))}
            </div>
          </section>
          <aside className="surface p-5">
            <div className="skeleton-sheen h-6 w-40 rounded-md" />
            <div className="mt-5 grid gap-2">
              {[0, 1, 2, 3].map((item) => (
                <div className="skeleton-sheen h-16 rounded-lg" key={item} />
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
