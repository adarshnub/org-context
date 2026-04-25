import { ArrowRight, KeyRound, Mail } from "lucide-react";
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
    <main className="min-h-screen py-6">
      <div className="app-shell grid min-h-[calc(100vh-3rem)] gap-8 lg:grid-cols-[0.9fr_1fr] lg:items-center">
        <section className="animate-rise">
          <Link className="eyebrow" href="/">
            Org Context
          </Link>
          <h1 className="mt-5 max-w-xl text-5xl font-semibold leading-[1.05] text-[var(--ink)]">
            Return to your team memory hub.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[var(--muted)]">
            Pick up the workspace thread, invite teammates, and ask the chat
            what the project already knows.
          </p>
          <p className="mt-8 text-sm text-[var(--muted)]">
            Need an account?{" "}
            <Link className="font-bold text-[var(--teal)]" href="/signup">
              Create one
            </Link>
            .
          </p>
        </section>

        <section className="animate-rise stagger-1 surface p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-[#13201d] text-white">
              <KeyRound size={18} />
            </span>
            <div>
              <p className="eyebrow">Login</p>
              <h2 className="text-xl font-bold text-[var(--ink)]">
                Access dashboard
              </h2>
            </div>
          </div>

          <form action={loginAction} className="grid gap-4">
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                <Mail size={15} />
                Email
              </span>
              <input
                className="field"
                defaultValue={email}
                name="email"
                placeholder="jane@company.com"
                required
                type="email"
              />
            </label>
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                <KeyRound size={15} />
                Password
              </span>
              <input className="field" name="password" required type="password" />
            </label>

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                {message}
              </p>
            ) : null}

            <SubmitButton className="btn-primary mt-2" pendingLabel="Logging in...">
              Log in <ArrowRight size={16} />
            </SubmitButton>
          </form>
        </section>
      </div>
    </main>
  );
}
