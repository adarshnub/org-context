"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/env";

export function createClient() {
  const { anonKey, url } = getSupabaseEnv();

  return createBrowserClient(url, anonKey);
}
