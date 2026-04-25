"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getServiceRoleKey, getSupabaseEnv } from "@/lib/env";
import { encryptGitHubToken, parseGitHubRepoUrl } from "@/lib/github";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  githubRepositorySchema,
  inviteSchema,
  providerSchema,
  repositoryIdSchema,
  toolSettingsSchema,
} from "@/lib/validators";

async function requireOwner(workspaceId: string, userId: string) {
  const { supabase } = await requireUser();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership || membership.role !== "owner") {
    throw new Error("Only workspace owners can manage this setting.");
  }
}

async function runGitHubSyncFunction({
  repositoryId,
  requestedBy,
  triggerType,
  workspaceId,
}: {
  repositoryId: string;
  requestedBy: string | null;
  triggerType: "manual" | "hourly";
  workspaceId: string;
}) {
  const { url } = getSupabaseEnv();
  const response = await fetch(`${url}/functions/v1/github-sync-repo`, {
    body: JSON.stringify({
      repositoryId,
      requestedBy,
      triggerType,
      workspaceId,
    }),
    headers: {
      Authorization: `Bearer ${getServiceRoleKey()}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    result?: { status?: "completed" | "failed" | "partial" | "pending" | "running" };
    status?: string;
  } | null;

  if (!response.ok) {
    throw new Error(
      payload?.error ?? `GitHub sync failed with status ${response.status}.`,
    );
  }

  if (!payload?.result?.status) {
    throw new Error(
      payload?.status === "no_job"
        ? "GitHub sync function did not run the direct sync request. Redeploy the github-sync-repo Edge Function, then try again."
        : "GitHub sync function completed without a sync result. Check the Edge Function deployment and logs.",
    );
  }

  return payload;
}

export async function inviteUserAction(workspaceId: string, formData: FormData) {
  const values = inviteSchema.parse({
    email: formData.get("email"),
  });
  const normalizedEmail = values.email.toLowerCase();

  const { user } = await requireUser();
  await requireOwner(workspaceId, user.id);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!profile) {
    redirect(
      `/workspaces/${workspaceId}?inviteError=${encodeURIComponent(
        "That email is not registered yet. Ask them to sign up first.",
      )}`,
    );
  }

  if (profile.id === user.id) {
    redirect(
      `/workspaces/${workspaceId}?inviteError=${encodeURIComponent(
        "You are already the owner of this workspace.",
      )}`,
    );
  }

  const { data: existingMembership } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (existingMembership) {
    redirect(
      `/workspaces/${workspaceId}?inviteError=${encodeURIComponent(
        "That teammate is already a member of this workspace.",
      )}`,
    );
  }

  const { data: existingInvite } = await admin
    .from("workspace_invites")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("invited_user_id", profile.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvite) {
    redirect(
      `/workspaces/${workspaceId}?inviteMessage=${encodeURIComponent(
        "That teammate already has a pending invite.",
      )}`,
    );
  }

  const { error } = await admin.from("workspace_invites").insert({
    invited_by: user.id,
    invited_email: profile.email,
    invited_user_id: profile.id,
    workspace_id: workspaceId,
  });

  if (error) {
    if (error.code === "23505") {
      redirect(
        `/workspaces/${workspaceId}?inviteMessage=${encodeURIComponent(
          "That teammate already has a pending invite.",
        )}`,
      );
    }

    redirect(
      `/workspaces/${workspaceId}?inviteError=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/workspaces/${workspaceId}`);
  revalidatePath("/dashboard");
  redirect(
    `/workspaces/${workspaceId}?inviteMessage=${encodeURIComponent(
      `Invite sent to ${profile.email}.`,
    )}`,
  );
}

export async function updateWorkspaceProviderAction(
  workspaceId: string,
  formData: FormData,
) {
  const parsedValues = providerSchema.safeParse({
    provider: formData.get("provider"),
  });

  if (!parsedValues.success) {
    redirect(
      `/workspaces/${workspaceId}?providerError=${encodeURIComponent(
        "Choose a valid provider option.",
      )}`,
    );
  }

  const values = parsedValues.data;

  const { user } = await requireUser();
  await requireOwner(workspaceId, user.id);

  const admin = createAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({
      answer_provider: values.provider,
    })
    .eq("id", workspaceId);

  if (error) {
    redirect(
      `/workspaces/${workspaceId}?providerError=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/workspaces/${workspaceId}`);
  revalidatePath("/dashboard");
  redirect(
    `/workspaces/${workspaceId}?providerMessage=${encodeURIComponent(
      `Saved provider: ${values.provider}.`,
    )}`,
  );
}

export async function updateWorkspaceProviderInlineAction(
  workspaceId: string,
  formData: FormData,
) {
  const parsedValues = providerSchema.safeParse({
    provider: formData.get("provider"),
  });

  if (!parsedValues.success) {
    return {
      error: "Choose a valid provider option.",
      ok: false as const,
    };
  }

  const values = parsedValues.data;

  try {
    const { user } = await requireUser();
    await requireOwner(workspaceId, user.id);

    const admin = createAdminClient();
    const { error } = await admin
      .from("workspaces")
      .update({
        answer_provider: values.provider,
      })
      .eq("id", workspaceId);

    if (error) {
      return {
        error: error.message,
        ok: false as const,
      };
    }

    revalidatePath(`/workspaces/${workspaceId}`);
    revalidatePath("/dashboard");

    return {
      ok: true as const,
      provider: values.provider,
    };
  } catch (caughtError) {
    return {
      error:
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save provider.",
      ok: false as const,
    };
  }
}

export async function updateWorkspaceToolsAction(
  workspaceId: string,
  formData: FormData,
) {
  const values = toolSettingsSchema.parse({
    enabledTools: formData.getAll("enabledTools"),
  });

  const { user } = await requireUser();
  await requireOwner(workspaceId, user.id);

  const admin = createAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({
      enabled_tools: values.enabledTools,
    })
    .eq("id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/workspaces/${workspaceId}`);
  revalidatePath(`/workspaces/${workspaceId}/chat`);
}

export async function connectGitHubRepositoryAction(
  workspaceId: string,
  formData: FormData,
) {
  const parsedValues = githubRepositorySchema.safeParse({
    accessToken: formData.get("accessToken") || undefined,
    branch: formData.get("branch"),
    repoUrl: formData.get("repoUrl"),
    syncHourly: formData.get("syncHourly") === "on",
  });

  if (!parsedValues.success) {
    redirect(
      `/workspaces/${workspaceId}?repoError=${encodeURIComponent(
        parsedValues.error.issues[0]?.message ?? "Check the repository details.",
      )}`,
    );
  }

  const values = parsedValues.data;
  const { user } = await requireUser();
  await requireOwner(workspaceId, user.id);

  let parsedRepo;

  try {
    parsedRepo = parseGitHubRepoUrl(values.repoUrl);
  } catch (error) {
    redirect(
      `/workspaces/${workspaceId}?repoError=${encodeURIComponent(
        error instanceof Error ? error.message : "Enter a valid GitHub URL.",
      )}`,
    );
  }

  const encryptedAccessToken = values.accessToken?.trim()
    ? encryptGitHubToken(values.accessToken)
    : null;
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("workspace_repositories")
    .select("id, encrypted_access_token")
    .eq("workspace_id", workspaceId)
    .eq("github_owner", parsedRepo.owner)
    .eq("github_repo", parsedRepo.repo)
    .eq("branch", values.branch)
    .maybeSingle();

  const repositoryPayload = {
    branch: values.branch,
    github_owner: parsedRepo.owner,
    github_repo: parsedRepo.repo,
    repo_url: parsedRepo.url,
    sync_hourly: values.syncHourly,
    workspace_id: workspaceId,
  };
  let repositoryId = existing?.id as string | undefined;

  if (repositoryId) {
    const { error } = await admin
      .from("workspace_repositories")
      .update({
        ...repositoryPayload,
        ...(encryptedAccessToken
          ? { encrypted_access_token: encryptedAccessToken }
          : {}),
      })
      .eq("id", repositoryId);

    if (error) {
      redirect(
        `/workspaces/${workspaceId}?repoError=${encodeURIComponent(error.message)}`,
      );
    }
  } else {
    const { data: repository, error } = await admin
      .from("workspace_repositories")
      .insert({
        ...repositoryPayload,
        created_by: user.id,
        encrypted_access_token: encryptedAccessToken,
      })
      .select("id")
      .single();

    if (error || !repository) {
      redirect(
        `/workspaces/${workspaceId}?repoError=${encodeURIComponent(
          error?.message ?? "Could not connect repository.",
        )}`,
      );
    }

    repositoryId = repository.id;
  }

  if (!repositoryId) {
    redirect(
      `/workspaces/${workspaceId}?repoError=${encodeURIComponent(
        "Could not resolve repository connection.",
      )}`,
    );
  }

  let syncStatus = "completed";

  try {
    const syncResult = await runGitHubSyncFunction({
      repositoryId,
      requestedBy: user.id,
      triggerType: "manual",
      workspaceId,
    });
    syncStatus = syncResult?.result?.status ?? syncStatus;
  } catch (error) {
    redirect(
      `/workspaces/${workspaceId}?repoError=${encodeURIComponent(
        error instanceof Error ? error.message : "Could not sync repository.",
      )}`,
    );
  }

  revalidatePath(`/workspaces/${workspaceId}`);
  redirect(
    `/workspaces/${workspaceId}?repoMessage=${encodeURIComponent(
      `Connected ${parsedRepo.owner}/${parsedRepo.repo}; sync finished with status: ${syncStatus}.`,
    )}`,
  );
}

export async function syncGitHubRepositoryAction(
  workspaceId: string,
  formData: FormData,
) {
  const values = repositoryIdSchema.parse({
    repositoryId: formData.get("repositoryId"),
  });
  const { user } = await requireUser();
  await requireOwner(workspaceId, user.id);

  const admin = createAdminClient();
  const { data: repository } = await admin
    .from("workspace_repositories")
    .select("id")
    .eq("id", values.repositoryId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!repository) {
    redirect(
      `/workspaces/${workspaceId}?repoError=${encodeURIComponent(
        "Repository connection was not found.",
      )}`,
    );
  }

  let syncStatus = "completed";

  try {
    const syncResult = await runGitHubSyncFunction({
      repositoryId: values.repositoryId,
      requestedBy: user.id,
      triggerType: "manual",
      workspaceId,
    });
    syncStatus = syncResult?.result?.status ?? syncStatus;
  } catch (error) {
    redirect(
      `/workspaces/${workspaceId}?repoError=${encodeURIComponent(
        error instanceof Error ? error.message : "Could not sync repository.",
      )}`,
    );
  }

  revalidatePath(`/workspaces/${workspaceId}`);
  redirect(
    `/workspaces/${workspaceId}?repoMessage=${encodeURIComponent(
      `Repository sync finished with status: ${syncStatus}.`,
    )}`,
  );
}

export async function disconnectGitHubRepositoryAction(
  workspaceId: string,
  formData: FormData,
) {
  const values = repositoryIdSchema.parse({
    repositoryId: formData.get("repositoryId"),
  });
  const { user } = await requireUser();
  await requireOwner(workspaceId, user.id);

  const admin = createAdminClient();
  const { error } = await admin
    .from("workspace_repositories")
    .delete()
    .eq("id", values.repositoryId)
    .eq("workspace_id", workspaceId);

  if (error) {
    redirect(
      `/workspaces/${workspaceId}?repoError=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/workspaces/${workspaceId}`);
  revalidatePath(`/workspaces/${workspaceId}/chat`);
  redirect(
    `/workspaces/${workspaceId}?repoMessage=${encodeURIComponent(
      "Repository disconnected.",
    )}`,
  );
}
