import { ArrowRight, Building2, KeyRound, Mail, UserRound } from "lucide-react";
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
    <main className="min-h-screen py-6">
      <div className="app-shell grid min-h-[calc(100vh-3rem)] gap-8 lg:grid-cols-[0.9fr_1fr] lg:items-center">
        <section className="animate-rise">
          <Link className="eyebrow" href="/">
            Org Context
          </Link>
          <h1 className="mt-5 max-w-xl text-5xl font-semibold leading-[1.05] text-[var(--ink)]">
            Create the first workspace memory layer.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[var(--muted)]">
            Sign up, create a workspace, and start turning the team channel into
            searchable project context.
          </p>
          <p className="mt-8 text-sm text-[var(--muted)]">
            Already registered?{" "}
            <Link className="font-bold text-[var(--teal)]" href="/login">
              Log in
            </Link>
            .
          </p>
        </section>

        <section className="animate-rise stagger-1 surface p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-[#13201d] text-white">
              <UserRound size={18} />
            </span>
            <div>
              <p className="eyebrow">Signup</p>
              <h2 className="text-xl font-bold text-[var(--ink)]">
                Build your profile
              </h2>
            </div>
          </div>

          <form action={signupAction} className="grid gap-4">
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                <UserRound size={15} />
                Full name
              </span>
              <input
                className="field"
                name="fullName"
                placeholder="Jane Smith"
                required
                type="text"
              />
            </label>
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                <Building2 size={15} />
                Company
              </span>
              <input
                className="field"
                name="companyName"
                placeholder="Orbit Labs"
                required
                type="text"
              />
            </label>
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                <Mail size={15} />
                Email
              </span>
              <input
                className="field"
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
            ) : (
              <p className="text-sm leading-6 text-[var(--muted)]">
                If Supabase email confirmation is enabled, confirm your email
                before the first login.
              </p>
            )}

            <SubmitButton className="btn-primary mt-2" pendingLabel="Creating account...">
              Sign up <ArrowRight size={16} />
            </SubmitButton>
          </form>
        </section>
      </div>
    </main>
  );
}
