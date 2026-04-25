import { z } from "zod";

import { createEmbedding } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSlackTokenForWorkspace,
  postSlackMessage,
  slackApi,
} from "@/lib/slack";
import type { ToolExecutionContext } from "@/lib/tools/types";

const sendMessageSchema = z.object({
  channelId: z.string().min(1),
  text: z.string().min(1).max(3000),
  threadTs: z.string().min(1).optional(),
});

const fetchThreadSchema = z.object({
  channelId: z.string().min(1),
  threadTs: z.string().min(1),
});

const permalinkSchema = z.object({
  channelId: z.string().min(1),
  messageTs: z.string().min(1),
});

const searchSchema = z.object({
  query: z.string().min(1).max(500),
});

async function assertConnectedChannel(workspaceId: string, slackChannelId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("slack_channels")
    .select("slack_channel_id, slack_channel_name")
    .eq("workspace_id", workspaceId)
    .eq("slack_channel_id", slackChannelId)
    .eq("is_selected", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Slack channel is not connected to this workspace.");
  }

  return data;
}

export const slackListChannelsTool = {
  description: "List Slack channels connected to this workspace.",
  async execute(_input: Record<string, never>, context: ToolExecutionContext) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("slack_channels")
      .select("slack_channel_id, slack_channel_name, is_private, include_in_context")
      .eq("workspace_id", context.workspaceId)
      .eq("is_selected", true)
      .order("slack_channel_name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return {
      channels: data ?? [],
    };
  },
  inputSchema: z.object({}),
  name: "slack.listChannels" as const,
};

export const slackSendMessageTool = {
  description: "Send a Slack message to a connected Slack channel.",
  async execute(input: z.infer<typeof sendMessageSchema>, context: ToolExecutionContext) {
    await assertConnectedChannel(context.workspaceId, input.channelId);
    const result = await postSlackMessage({
      channel: input.channelId,
      text: input.text,
      threadTs: input.threadTs,
      workspaceId: context.workspaceId,
    });

    return {
      channel: input.channelId,
      ts: result.ts ?? result.message?.ts ?? null,
    };
  },
  inputSchema: sendMessageSchema,
  name: "slack.sendMessage" as const,
};

export const slackFetchThreadTool = {
  description: "Fetch replies from a Slack thread in a connected channel.",
  async execute(input: z.infer<typeof fetchThreadSchema>, context: ToolExecutionContext) {
    await assertConnectedChannel(context.workspaceId, input.channelId);
    const { token } = await getSlackTokenForWorkspace(context.workspaceId);
    const payload = await slackApi<{
      messages?: Array<{
        text?: string;
        ts?: string;
        user?: string;
      }>;
    }>({
      body: {
        channel: input.channelId,
        ts: input.threadTs,
      },
      method: "conversations.replies",
      token,
    });

    return {
      messages: (payload.messages ?? []).slice(0, 20),
    };
  },
  inputSchema: fetchThreadSchema,
  name: "slack.fetchThread" as const,
};

export const slackGetPermalinkTool = {
  description: "Get a Slack permalink for a message in a connected channel.",
  async execute(input: z.infer<typeof permalinkSchema>, context: ToolExecutionContext) {
    await assertConnectedChannel(context.workspaceId, input.channelId);
    const { token } = await getSlackTokenForWorkspace(context.workspaceId);
    const payload = await slackApi<{ permalink?: string }>({
      body: {
        channel: input.channelId,
        message_ts: input.messageTs,
      },
      method: "chat.getPermalink",
      token,
    });

    return {
      permalink: payload.permalink ?? null,
    };
  },
  inputSchema: permalinkSchema,
  name: "slack.getPermalink" as const,
};

export const slackSearchSyncedMessagesTool = {
  description: "Search locally synced Slack messages in this workspace.",
  async execute(input: z.infer<typeof searchSchema>, context: ToolExecutionContext) {
    const admin = createAdminClient();
    const { data: channels, error: channelsError } = await admin
      .from("slack_channels")
      .select("channel_id")
      .eq("workspace_id", context.workspaceId)
      .eq("is_selected", true)
      .eq("include_in_context", true);

    if (channelsError) {
      throw new Error(channelsError.message);
    }

    const channelIds = (channels ?? [])
      .map((channel) => channel.channel_id)
      .filter((channelId): channelId is string => typeof channelId === "string");

    if (channelIds.length === 0) {
      return {
        matches: [],
      };
    }

    const embedding = await createEmbedding(input.query, "search_query");
    const { data, error } = await admin.rpc("match_workspace_chat_messages", {
      accepted_message_types: ["user"],
      channel_ids_input: channelIds,
      exclude_message_id_input: null,
      match_count: 6,
      query_embedding: embedding,
      workspace_id_input: context.workspaceId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      matches: ((data ?? []) as Array<Record<string, unknown>>).map((match) => ({
        body: String(match.body ?? ""),
        createdAt: String(match.created_at ?? ""),
        score: typeof match.similarity === "number" ? match.similarity : null,
        source: typeof match.source === "string" ? match.source : null,
      })),
    };
  },
  inputSchema: searchSchema,
  name: "slack.searchSyncedMessages" as const,
};
