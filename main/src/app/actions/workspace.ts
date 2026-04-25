"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteSchema, providerSchema } from "@/lib/validators";

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
  const values = providerSchema.parse({
    provider: formData.get("provider"),
  });

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
    throw new Error(error.message);
  }

  revalidatePath(`/workspaces/${workspaceId}`);
}
