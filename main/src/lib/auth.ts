import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getUserOrNull() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return data.user;
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function redirectIfAuthenticated() {
  const user = await getUserOrNull();

  if (user) {
    redirect("/dashboard");
  }
}
