import Link from "next/link";

import { redirectIfAuthenticated } from "@/lib/auth";
import { loginAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms/submit-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await redirectIfAuthenticated();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const email = typeof params.email === "string" ? params.email : "";
  const message = typeof params.message === "string" ? params.message : null;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-black/10 bg-white/80 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--accent)]">
            Welcome back
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-950">
            Log into your team memory hub.
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            Continue into your dashboard to create workspaces, invite teammates,
            and search your chat history with `/ask`.
          </p>
          <p className="mt-6 text-sm text-slate-600">
            Need an account?{" "}
            <Link
              className="font-semibold text-slate-900"
              href="/signup"
            >
              Sign up here
            </Link>
            .
          </p>
        </section>

        <section className="rounded-[2rem] border border-black/10 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <form
            action={loginAction}
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="email"
              >
                Email
              </label>
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900"
                defaultValue={email}
                id="email"
                name="email"
                placeholder="jane@company.com"
                required
                type="email"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="password"
              >
                Password
              </label>
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900"
                id="password"
                name="password"
                required
                type="password"
              />
            </div>
            {error ? <p className="text-sm leading-6 text-rose-600">{error}</p> : null}
            {message ? (
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                {message}
              </p>
            ) : null}
          <SubmitButton
            className="mt-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
            pendingLabel="Logging in..."
          >
            Log in
            </SubmitButton>
          </form>
        </section>
      </div>
    </main>
  );
}
