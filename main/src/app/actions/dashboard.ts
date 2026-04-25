"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { serverDebug, serverError } from "@/lib/debug";
import { slugify } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { workspaceSchema } from "@/lib/validators";

export async function createWorkspaceAction(formData: FormData) {
  const values = workspaceSchema.parse({
    name: formData.get("name"),
  });

  const { user } = await requireUser();
  const admin = createAdminClient();
  const slugBase = slugify(values.name) || "workspace";
  const slug = `${slugBase}-${crypto.randomUUID().slice(0, 6)}`;

  serverDebug("workspace.create.start", {
    slug,
    userEmail: user.email,
    userId: user.id,
    workspaceName: values.name,
  });

  const { data: workspace, error } = await admin
    .from("workspaces")
    .insert({
      name: values.name,
      owner_id: user.id,
      slug,
    })
    .select("id")
    .single();

  if (error || !workspace) {
    serverError("workspace.create.workspace_insert", error, {
      slug,
      userId: user.id,
    });
    redirect(
      `/dashboard?error=${encodeURIComponent(
        error?.message ?? "Failed to create workspace.",
      )}`,
    );
  }

  serverDebug("workspace.create.workspace_inserted", {
    userId: user.id,
    workspaceId: workspace.id,
  });

  const membershipInsert = await admin.from("workspace_members").insert({
    role: "owner",
    user_id: user.id,
    workspace_id: workspace.id,
  });

  if (membershipInsert.error) {
    serverError("workspace.create.membership_insert", membershipInsert.error, {
      userId: user.id,
      workspaceId: workspace.id,
    });
    redirect(
      `/dashboard?error=${encodeURIComponent(membershipInsert.error.message)}`,
    );
  }

  serverDebug("workspace.create.membership_inserted", {
    userId: user.id,
    workspaceId: workspace.id,
  });

  const channelInsert = await admin.from("channels").insert({
    name: "general",
    workspace_id: workspace.id,
  });

  if (channelInsert.error) {
    serverError("workspace.create.channel_insert", channelInsert.error, {
      workspaceId: workspace.id,
    });
    redirect(
      `/dashboard?error=${encodeURIComponent(channelInsert.error.message)}`,
    );
  }

  serverDebug("workspace.create.success", {
    redirectTo: `/workspaces/${workspace.id}`,
    workspaceId: workspace.id,
  });

  revalidatePath("/dashboard");
  redirect(`/workspaces/${workspace.id}`);
}

export async function acceptInviteAction(formData: FormData) {
  const inviteId = String(formData.get("inviteId") ?? "");
  const { supabase, user } = await requireUser();

  const { data: invite } = await supabase
    .from("workspace_invites")
    .select("id, workspace_id")
    .eq("id", inviteId)
    .eq("invited_user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (!invite) {
    redirect("/dashboard?error=Invite not found.");
  }

  const admin = createAdminClient();

  await admin.from("workspace_members").upsert(
    {
      role: "member",
      user_id: user.id,
      workspace_id: invite.workspace_id,
    },
    {
      onConflict: "workspace_id,user_id",
    },
  );

  await admin
    .from("workspace_invites")
    .update({
      responded_at: new Date().toISOString(),
      status: "accepted",
    })
    .eq("id", inviteId);

  revalidatePath("/dashboard");
}

export async function declineInviteAction(formData: FormData) {
  const inviteId = String(formData.get("inviteId") ?? "");
  const { supabase, user } = await requireUser();

  await supabase
    .from("workspace_invites")
    .update({
      responded_at: new Date().toISOString(),
      status: "declined",
    })
    .eq("id", inviteId)
    .eq("invited_user_id", user.id);

  revalidatePath("/dashboard");
}
