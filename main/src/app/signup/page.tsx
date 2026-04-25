import Link from "next/link";

import { signupAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms/submit-button";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await redirectIfAuthenticated();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-black/10 bg-white/80 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--accent)]">
            Create account
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-950">
            Start building your project workflow brain.
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            Create your account, then head straight into the dashboard to open
            workspaces and bring your teammates into shared realtime context.
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-500">
            If email confirmation is enabled in Supabase, you will need to
            confirm your email before the first login.
          </p>
          <p className="mt-6 text-sm text-slate-600">
            Already registered?{" "}
            <Link
              className="font-semibold text-slate-900"
              href="/login"
            >
              Log in
            </Link>
            .
          </p>
        </section>

        <section className="rounded-[2rem] border border-black/10 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <form
            action={signupAction}
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="fullName"
              >
                Full name
              </label>
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900"
                id="fullName"
                name="fullName"
                placeholder="Jane Smith"
                required
                type="text"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="companyName"
              >
                Company
              </label>
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900"
                id="companyName"
                name="companyName"
                placeholder="Orbit Labs"
                required
                type="text"
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="email"
              >
                Email
              </label>
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900"
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
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <SubmitButton
              className="mt-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
              pendingLabel="Creating account..."
            >
              Sign up
            </SubmitButton>
          </form>
        </section>
      </div>
    </main>
  );
}
