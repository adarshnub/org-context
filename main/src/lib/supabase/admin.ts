import { createClient } from "@supabase/supabase-js";

import { getServiceRoleKey, getSupabaseEnv } from "@/lib/env";

export function createAdminClient() {
  const { url } = getSupabaseEnv();

  return createClient(url, getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
