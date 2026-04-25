import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { serverDebug, serverError } from "@/lib/debug";
import type {
  ChatMessage,
  Citation,
  PendingInvite,
  WorkspaceDetail,
  WorkspaceMember,
  WorkspaceSummary,
} from "@/lib/types";

type RawMessageRow = {
  body: string;
  channel_id: string;
  citations: Citation[] | null;
  command_name: string | null;
  created_at: string;
  embedding_status: ChatMessage["embeddingStatus"];
  id: string;
  message_type: ChatMessage["messageType"];
  sender_id: string | null;
  sender?: { full_name?: string | null } | null;
  workspace_id: string;
};

function asSingle<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function getDashboardData() {
  const { supabase, user } = await requireUser();

  serverDebug("dashboard.load.start", {
    userEmail: user.email,
    userId: user.id,
  });

  const [
    { data: profile, error: profileError },
    { data: memberships, error: membershipsError },
    { data: invites, error: invitesError },
  ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, company_name, email")
        .eq("id", user.id)
        .single(),
      supabase
        .from("workspace_members")
        .select(
          "role, workspace:workspaces!inner(id, name, slug, answer_provider, owner_id)",
        )
        .eq("user_id", user.id),
      supabase
        .from("workspace_invites")
        .select(
          "id, invited_email, workspace_id, workspace:workspaces!inner(name, slug)",
        )
        .eq("invited_user_id", user.id)
        .eq("status", "pending"),
    ]);

  if (profileError || membershipsError || invitesError) {
    serverError("dashboard.load", profileError ?? membershipsError ?? invitesError, {
      profileError,
      membershipsError,
      invitesError,
      userId: user.id,
    });
  }

  serverDebug("dashboard.load.success", {
    hasProfile: Boolean(profile),
    inviteCount: invites?.length ?? 0,
    userId: user.id,
    workspaceCount: memberships?.length ?? 0,
  });

  return {
    invites: (invites ?? []).map((invite) => ({
      id: invite.id,
      invitedEmail: invite.invited_email,
      workspaceId: invite.workspace_id,
      workspaceName: asSingle(invite.workspace)?.name ?? "Workspace",
      workspaceSlug: asSingle(invite.workspace)?.slug ?? "",
    })) satisfies PendingInvite[],
    profile,
    user,
    workspaces: (memberships ?? []).map((membership) => ({
      answerProvider: asSingle(membership.workspace)?.answer_provider ?? "cohere",
      id: asSingle(membership.workspace)?.id ?? "",
      name: asSingle(membership.workspace)?.name ?? "Workspace",
      ownerId: asSingle(membership.workspace)?.owner_id ?? "",
      role: membership.role,
      slug: asSingle(membership.workspace)?.slug ?? "",
    })) satisfies WorkspaceSummary[],
  };
}

export async function getWorkspaceDetail(workspaceId: string) {
  const { supabase, user } = await requireUser();

  serverDebug("workspace.load.start", {
    userEmail: user.email,
    userId: user.id,
    workspaceId,
  });

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select(
      "role, workspace:workspaces!inner(id, name, slug, answer_provider), workspace_id",
    )
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    serverError("workspace.load.membership", membershipError, {
      userId: user.id,
      workspaceId,
    });
    throw new Error(`Could not load workspace membership: ${membershipError.message}`);
  }

  if (!membership) {
    serverDebug("workspace.load.membership_missing", {
      userId: user.id,
      workspaceId,
    });
    notFound();
  }

  serverDebug("workspace.load.membership_found", {
    role: membership.role,
    userId: user.id,
    workspaceId,
  });

  const [
    { data: channel, error: channelError },
    { data: memberRows, error: membersError },
    { data: messageRows, error: messagesError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    supabase
      .from("channels")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .eq("name", "general")
      .single(),
    supabase
      .from("workspace_members")
      .select(
        "role, user_id, profile:profiles!workspace_members_user_id_fkey(full_name, email)",
      )
      .eq("workspace_id", workspaceId),
    supabase
      .from("chat_messages")
      .select(
        "id, workspace_id, channel_id, sender_id, body, message_type, command_name, embedding_status, created_at, citations, sender:profiles!chat_messages_sender_id_fkey(full_name)",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single(),
  ]);

  const loadError =
    channelError ?? membersError ?? messagesError ?? profileError ?? null;

  if (loadError) {
    serverError("workspace.load.data", loadError, {
      channelError,
      membersError,
      messagesError,
      profileError,
      userId: user.id,
      workspaceId,
    });
    throw new Error(`Could not load workspace data: ${loadError.message}`);
  }

  if (!channel) {
    serverDebug("workspace.load.channel_missing", {
      userId: user.id,
      workspaceId,
    });
    notFound();
  }

  const members =
    (memberRows ?? []).map((row) => ({
      email: asSingle(row.profile)?.email ?? "",
      fullName: asSingle(row.profile)?.full_name ?? "Workspace member",
      role: row.role,
      userId: row.user_id,
    })) satisfies WorkspaceMember[];

  const memberNameMap = new Map(members.map((member) => [member.userId, member.fullName]));
  const messages =
    (messageRows ?? []).map((row) => normalizeMessageRow(row as RawMessageRow, memberNameMap)) satisfies ChatMessage[];

  serverDebug("workspace.load.success", {
    channelId: channel.id,
    memberCount: members.length,
    messageCount: messages.length,
    userId: user.id,
    workspaceId,
  });

  return {
    currentUser: {
      email: asSingle(profile)?.email ?? user.email ?? "",
      fullName: asSingle(profile)?.full_name ?? user.email ?? "You",
      id: user.id,
    },
    workspace: {
      answerProvider: asSingle(membership.workspace)?.answer_provider ?? "cohere",
      channelId: channel.id,
      channelName: channel.name,
      id: asSingle(membership.workspace)?.id ?? workspaceId,
      members,
      messages,
      name: asSingle(membership.workspace)?.name ?? "Workspace",
      role: membership.role,
      slug: asSingle(membership.workspace)?.slug ?? "",
    } satisfies WorkspaceDetail,
  };
}

export function normalizeInsertedMessage({
  body,
  channelId,
  citations,
  commandName = null,
  createdAt,
  embeddingStatus,
  id,
  messageType,
  senderId,
  senderName,
  workspaceId,
}: {
  body: string;
  channelId: string;
  citations?: Citation[] | null;
  commandName?: string | null;
  createdAt: string;
  embeddingStatus: ChatMessage["embeddingStatus"];
  id: string;
  messageType: ChatMessage["messageType"];
  senderId: string | null;
  senderName: string;
  workspaceId: string;
}) {
  return {
    body,
    channelId,
    citations: citations ?? [],
    commandName,
    createdAt,
    embeddingStatus,
    id,
    messageType,
    senderId,
    senderName,
    workspaceId,
  } satisfies ChatMessage;
}

function normalizeMessageRow(row: RawMessageRow, memberNameMap: Map<string, string>) {
  return normalizeInsertedMessage({
    body: row.body,
    channelId: row.channel_id,
    citations: row.citations ?? [],
    commandName: row.command_name,
    createdAt: row.created_at,
    embeddingStatus: row.embedding_status,
    id: row.id,
    messageType: row.message_type,
    senderId: row.sender_id,
    senderName:
      row.sender?.full_name ??
      (row.sender_id ? memberNameMap.get(row.sender_id) : null) ??
      "Org Context",
    workspaceId: row.workspace_id,
  });
}
