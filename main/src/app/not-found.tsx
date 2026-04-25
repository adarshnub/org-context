import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <section className="animate-rise surface max-w-xl p-8 text-center">
        <p className="eyebrow">Not found</p>
        <h1 className="mt-4 text-4xl font-semibold text-[var(--ink)]">
          That workspace or page does not exist.
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted)]">
          Head back to the dashboard and pick an active workspace.
        </p>
        <Link className="btn-primary mt-6" href="/dashboard">
          <ArrowLeft size={16} />
          Open dashboard
        </Link>
      </section>
    </main>
  );
}
