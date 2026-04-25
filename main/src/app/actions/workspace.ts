"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import {
  ensureSlackChannelMapping,
  processSlackBackfillJob,
  refreshSlackChannels,
} from "@/lib/slack";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inviteSchema,
  providerSchema,
  slackChannelSettingsSchema,
  toolSettingsSchema,
} from "@/lib/validators";

export async function requireOwner(workspaceId: string, userId: string) {
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

export async function refreshSlackChannelsAction(workspaceId: string) {
  const { user } = await requireUser();
  await requireOwner(workspaceId, user.id);
  await refreshSlackChannels(workspaceId);
  revalidatePath(`/workspaces/${workspaceId}`);
}

export async function updateSlackChannelsAction(
  workspaceId: string,
  formData: FormData,
) {
  const values = slackChannelSettingsSchema.parse({
    selectedChannelIds: formData.getAll("selectedChannelIds"),
  });
  const selected = new Set(values.selectedChannelIds);
  const { user } = await requireUser();
  await requireOwner(workspaceId, user.id);

  const admin = createAdminClient();
  const { data: channels, error: channelsError } = await admin
    .from("slack_channels")
    .select(
      "id, workspace_id, slack_installation_id, channel_id, slack_channel_id, slack_channel_name, is_private, is_selected, include_in_context",
    )
    .eq("workspace_id", workspaceId);

  if (channelsError) {
    throw new Error(channelsError.message);
  }

  for (const channel of channels ?? []) {
    const isSelected = selected.has(channel.id);

    if (isSelected) {
      await ensureSlackChannelMapping({
        channel_id: channel.channel_id,
        id: channel.id,
        include_in_context: channel.include_in_context,
        is_private: channel.is_private,
        is_selected: channel.is_selected,
        slack_channel_id: channel.slack_channel_id,
        slack_channel_name: channel.slack_channel_name,
        slack_installation_id: channel.slack_installation_id,
        workspace_id: channel.workspace_id,
      });
    }

    const { error } = await admin
      .from("slack_channels")
      .update({
        is_selected: isSelected,
      })
      .eq("id", channel.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath(`/workspaces/${workspaceId}`);
  revalidatePath(`/workspaces/${workspaceId}/chat`);
}

export async function startSlackBackfillAction(workspaceId: string) {
  const { user } = await requireUser();
  await requireOwner(workspaceId, user.id);

  const admin = createAdminClient();
  const { data: channels, error: channelsError } = await admin
    .from("slack_channels")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("is_selected", true)
    .eq("backfill_enabled", true);

  if (channelsError) {
    throw new Error(channelsError.message);
  }

  const rows = (channels ?? []).map((channel) => ({
    error: null,
    next_cursor: null,
    slack_channel_id: channel.id,
    status: "pending",
    workspace_id: workspaceId,
  }));

  if (rows.length > 0) {
    const { error } = await admin
      .from("slack_backfill_jobs")
      .upsert(rows, { onConflict: "workspace_id,slack_channel_id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath(`/workspaces/${workspaceId}`);
}

export async function processSlackBackfillBatchAction(workspaceId: string) {
  const { user } = await requireUser();
  await requireOwner(workspaceId, user.id);

  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("slack_backfill_jobs")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("status", ["pending", "running"])
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (job) {
    await processSlackBackfillJob(job.id);
  }

  revalidatePath(`/workspaces/${workspaceId}`);
}
