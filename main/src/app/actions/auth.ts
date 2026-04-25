"use server";

import { redirect } from "next/navigation";

import { getAppConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, signupSchema } from "@/lib/validators";

export async function loginAction(formData: FormData) {
  const values = loginSchema.parse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      redirect(
        `/login?error=${encodeURIComponent(
          "Your email is not confirmed yet. Open the confirmation email from Supabase, then log in again.",
        )}&message=${encodeURIComponent(
          "If you are testing locally, you can also disable Confirm Email in Supabase Auth > Providers > Email.",
        )}&email=${encodeURIComponent(values.email)}`,
      );
    }

    redirect(`/login?error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(values.email)}`);
  }

  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  const values = signupSchema.parse({
    companyName: formData.get("companyName"),
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
  });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    options: {
      data: {
        company_name: values.companyName,
        full_name: values.fullName,
      },
      emailRedirectTo: `${getAppConfig().appUrl}/auth/confirm?next=/dashboard`,
    },
    password: values.password,
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (!data.session) {
    redirect(
      `/login?message=${encodeURIComponent(
        "Check your email to confirm your account before your first login.",
      )}&email=${encodeURIComponent(values.email)}`,
    );
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/");
}
