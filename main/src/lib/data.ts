import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { serverDebug, serverError } from "@/lib/debug";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ChatMessage,
  ChatContextRun,
  Citation,
  PendingInvite,
  WorkspaceDetail,
  WorkspaceMember,
  WorkspaceSummary,
} from "@/lib/types";
import { normalizeEnabledTools } from "@/lib/tools";

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

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
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
    { data: inviteRows, error: invitesError },
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
          "role, workspace:workspaces!inner(id, name, slug, answer_provider, enabled_tools, owner_id)",
        )
        .eq("user_id", user.id),
      supabase
        .from("workspace_invites")
        .select("id, invited_email, workspace_id")
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
    inviteCount: inviteRows?.length ?? 0,
    userId: user.id,
    workspaceCount: memberships?.length ?? 0,
  });

  const workspaceIds = [...new Set((inviteRows ?? []).map((invite) => invite.workspace_id))];
  const admin = createAdminClient();
  const { data: inviteWorkspaces, error: inviteWorkspacesError } =
    workspaceIds.length > 0
      ? await admin
          .from("workspaces")
          .select("id, name, slug")
          .in("id", workspaceIds)
      : { data: [], error: null };

  if (inviteWorkspacesError) {
    serverError("dashboard.load.invite_workspaces", inviteWorkspacesError, {
      userId: user.id,
      workspaceIds,
    });
  }

  const workspaceById = new Map(
    (inviteWorkspaces ?? []).map((workspace) => [workspace.id, workspace]),
  );

  return {
    invites: (inviteRows ?? []).map((invite) => ({
      id: invite.id,
      invitedEmail: invite.invited_email,
      workspaceId: invite.workspace_id,
      workspaceName: workspaceById.get(invite.workspace_id)?.name ?? "Workspace",
      workspaceSlug: workspaceById.get(invite.workspace_id)?.slug ?? "",
    })) satisfies PendingInvite[],
    profile,
    user,
    workspaces: (memberships ?? []).map((membership) => ({
      answerProvider: asSingle(membership.workspace)?.answer_provider ?? "cohere",
      enabledTools: normalizeEnabledTools(asSingle(membership.workspace)?.enabled_tools),
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
      "role, workspace:workspaces!inner(id, name, slug, answer_provider, enabled_tools), workspace_id",
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
      enabledTools: normalizeEnabledTools(asSingle(membership.workspace)?.enabled_tools),
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

export async function getChatContextDebugData(workspaceId: string, runId?: string) {
  const { supabase, user } = await requireUser();

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  const { data: runs, error } = await supabase
    .from("chat_context_runs")
    .select(
      "id, workspace_id, channel_id, command_message_id, assistant_message_id, question, answer, answer_provider, model, system_prompt, model_input, rag_snippets, recent_messages, enabled_tools, tool_calls, token_breakdown, input_tokens, output_tokens, token_source, status, error, created_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(`Could not load context debug data: ${error.message}`);
  }

  const normalizedRuns = (runs ?? []).map(normalizeContextRun);
  const selectedRun =
    normalizedRuns.find((run) => run.id === runId) ?? normalizedRuns[0] ?? null;

  return {
    runs: normalizedRuns,
    selectedRun,
    user,
  };
}

function normalizeContextRun(row: Record<string, unknown>) {
  return {
    answer: typeof row.answer === "string" ? row.answer : null,
    answerProvider: row.answer_provider === "openai" ? "openai" : "cohere",
    assistantMessageId:
      typeof row.assistant_message_id === "string" ? row.assistant_message_id : null,
    channelId: String(row.channel_id),
    commandMessageId:
      typeof row.command_message_id === "string" ? row.command_message_id : null,
    createdAt: String(row.created_at),
    enabledTools: asArray(row.enabled_tools).filter(
      (tool): tool is string => typeof tool === "string",
    ),
    error: typeof row.error === "string" ? row.error : null,
    id: String(row.id),
    inputTokens: typeof row.input_tokens === "number" ? row.input_tokens : null,
    model: typeof row.model === "string" ? row.model : null,
    modelInput: typeof row.model_input === "string" ? row.model_input : null,
    outputTokens: typeof row.output_tokens === "number" ? row.output_tokens : null,
    question: String(row.question ?? ""),
    ragSnippets: asArray(row.rag_snippets),
    recentMessages: asArray(row.recent_messages),
    status: row.status === "failed" || row.status === "running" ? row.status : "completed",
    systemPrompt: typeof row.system_prompt === "string" ? row.system_prompt : null,
    tokenBreakdown: asArray(row.token_breakdown),
    tokenSource: typeof row.token_source === "string" ? row.token_source : "estimated",
    toolCalls: asArray(row.tool_calls),
    workspaceId: String(row.workspace_id),
  } satisfies ChatContextRun;
}
