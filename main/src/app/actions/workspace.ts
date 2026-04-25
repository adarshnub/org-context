"use server";

import { revalidatePath } from "next/cache";

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

  const { user } = await requireUser();
  await requireOwner(workspaceId, user.id);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", values.email.toLowerCase())
    .maybeSingle();

  if (!profile) {
    throw new Error("Invite failed because that email is not registered yet.");
  }

  const { error } = await admin.from("workspace_invites").insert({
    invited_by: user.id,
    invited_email: profile.email,
    invited_user_id: profile.id,
    workspace_id: workspaceId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/workspaces/${workspaceId}`);
  revalidatePath("/dashboard");
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
