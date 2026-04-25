import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const maxDispatches = Number.parseInt(
  Deno.env.get("GITHUB_SYNC_CRON_DISPATCH_COUNT") ?? "3",
  10,
);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function readJwtPayload(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );

    return JSON.parse(atob(padded)) as { role?: string };
  } catch {
    return null;
  }
}

function isAuthorized(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (serviceRoleKey && token === serviceRoleKey) {
    return true;
  }

  return readJwtPayload(token)?.role === "service_role";
}

Deno.serve(async (request) => {
  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized." }, 401);
  }

  const { data: repositories, error } = await supabase
    .from("workspace_repositories")
    .select("id, workspace_id")
    .eq("sync_hourly", true);

  if (error) {
    return json({ error: error.message }, 500);
  }

  let dispatched = 0;

  for (const repository of repositories ?? []) {
    if (dispatched >= maxDispatches) {
      break;
    }

    const { data: activeJob } = await supabase
      .from("repository_sync_jobs")
      .select("id")
      .eq("repository_id", repository.id)
      .in("status", ["pending", "running"])
      .maybeSingle();

    if (activeJob) {
      continue;
    }

    await fetch(`${supabaseUrl}/functions/v1/github-sync-repo`, {
      body: JSON.stringify({
        repositoryId: repository.id,
        requestedBy: null,
        triggerType: "hourly",
        workspaceId: repository.workspace_id,
      }),
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    }).catch((error) => {
      console.error("[github-sync-cron] dispatch failed", error);
    });

    dispatched += 1;
  }

  return json({
    dispatched,
    ok: true,
    repositories: repositories?.length ?? 0,
  });
});
