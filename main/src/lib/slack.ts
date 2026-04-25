import crypto from "node:crypto";

import { getAppConfig, getSlackConfig, hasSlackConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

type SlackApiResponse<T> = T & {
  error?: string;
  ok: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
};

export type SlackInstallationRow = {
  bot_access_token_encrypted: string;
  bot_user_id: string | null;
  id: string;
  slack_team_id: string;
  slack_team_name: string;
  workspace_id: string;
};

type SlackChannelRow = {
  channel_id: string | null;
  id: string;
  include_in_context: boolean;
  is_private: boolean;
  is_selected: boolean;
  slack_channel_id: string;
  slack_channel_name: string;
  slack_installation_id: string;
  workspace_id: string;
};

type SlackConversation = {
  id: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_private?: boolean;
  name?: string;
};

type SlackMessageEvent = {
  channel: string;
  channel_type?: string;
  event_ts?: string;
  subtype?: string;
  text?: string;
  thread_ts?: string;
  ts: string;
  user?: string;
};

type SlackHistoryMessage = {
  bot_id?: string;
  subtype?: string;
  text?: string;
  thread_ts?: string;
  ts: string;
  user?: string;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function keyBytes() {
  return crypto
    .createHash("sha256")
    .update(getSlackConfig().tokenEncryptionKey)
    .digest();
}

export function encryptSlackToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSlackToken(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");

  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Slack token is not in the expected encrypted format.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    keyBytes(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function signSlackState(payload: { userId: string; workspaceId: string }) {
  const body = JSON.stringify({
    ...payload,
    nonce: crypto.randomUUID(),
    ts: Date.now(),
  });
  const encoded = base64UrlEncode(body);
  const signature = crypto
    .createHmac("sha256", getSlackConfig().signingSecret)
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

export function verifySlackState(state: string) {
  const [encoded, signature] = state.split(".");

  if (!encoded || !signature) {
    throw new Error("Invalid Slack OAuth state.");
  }

  const expected = crypto
    .createHmac("sha256", getSlackConfig().signingSecret)
    .update(encoded)
    .digest("base64url");

  if (!safeEqual(signature, expected)) {
    throw new Error("Slack OAuth state signature did not match.");
  }

  const parsed = JSON.parse(base64UrlDecode(encoded)) as {
    ts?: number;
    userId?: string;
    workspaceId?: string;
  };

  if (!parsed.userId || !parsed.workspaceId || !parsed.ts) {
    throw new Error("Slack OAuth state was missing required fields.");
  }

  if (Date.now() - parsed.ts > 10 * 60 * 1000) {
    throw new Error("Slack OAuth state expired.");
  }

  return {
    userId: parsed.userId,
    workspaceId: parsed.workspaceId,
  };
}

export function buildSlackInstallUrl({
  redirectUri,
  state,
}: {
  redirectUri: string;
  state: string;
}) {
  const { clientId } = getSlackConfig();
  const scopes = [
    "channels:history",
    "channels:join",
    "channels:read",
    "chat:write",
    "commands",
    "groups:history",
    "groups:read",
    "users:read",
  ];
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scopes.join(","));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return url.toString();
}

export function verifySlackRequest({
  body,
  signature,
  timestamp,
}: {
  body: string;
  signature: string | null;
  timestamp: string | null;
}) {
  if (!hasSlackConfig()) {
    throw new Error("Slack is not configured.");
  }

  if (!signature || !timestamp) {
    throw new Error("Slack signature headers are missing.");
  }

  const timestampNumber = Number.parseInt(timestamp, 10);

  if (!Number.isFinite(timestampNumber)) {
    throw new Error("Slack request timestamp is invalid.");
  }

  if (Math.abs(Date.now() / 1000 - timestampNumber) > 60 * 5) {
    throw new Error("Slack request timestamp is too old.");
  }

  const base = `v0:${timestamp}:${body}`;
  const expected = `v0=${crypto
    .createHmac("sha256", getSlackConfig().signingSecret)
    .update(base)
    .digest("hex")}`;

  if (!safeEqual(signature, expected)) {
    throw new Error("Slack request signature did not match.");
  }
}

export async function slackApi<T>({
  body,
  method,
  token,
}: {
  body?: Record<string, unknown>;
  method: string;
  token: string;
}) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    method: body ? "POST" : "GET",
  });
  const payload = (await response.json()) as SlackApiResponse<T>;

  if (!payload.ok) {
    throw new Error(`Slack ${method} failed: ${payload.error ?? response.status}`);
  }

  return payload;
}

export async function exchangeSlackOAuthCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  const { clientId, clientSecret } = getSlackConfig();
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const payload = (await response.json()) as SlackApiResponse<{
    access_token?: string;
    bot_user_id?: string;
    team?: {
      id?: string;
      name?: string;
    };
  }>;

  if (!payload.ok || !payload.access_token || !payload.team?.id) {
    throw new Error(`Slack OAuth failed: ${payload.error ?? "missing token"}`);
  }

  return {
    botAccessToken: payload.access_token,
    botUserId: payload.bot_user_id ?? null,
    teamId: payload.team.id,
    teamName: payload.team.name ?? "Slack workspace",
  };
}

export async function getWorkspaceSlackInstallation(workspaceId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("slack_installations")
    .select(
      "id, workspace_id, slack_team_id, slack_team_name, bot_user_id, bot_access_token_encrypted",
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SlackInstallationRow | null) ?? null;
}

export async function getSlackTokenForWorkspace(workspaceId: string) {
  const installation = await getWorkspaceSlackInstallation(workspaceId);

  if (!installation) {
    throw new Error("Slack is not connected for this workspace.");
  }

  return {
    installation,
    token: decryptSlackToken(installation.bot_access_token_encrypted),
  };
}

export async function refreshSlackChannels(workspaceId: string) {
  const admin = createAdminClient();
  const { installation, token } = await getSlackTokenForWorkspace(workspaceId);
  const allChannels: SlackConversation[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL("https://slack.com/api/conversations.list");
    url.searchParams.set("types", "public_channel,private_channel");
    url.searchParams.set("exclude_archived", "true");
    url.searchParams.set("limit", "200");

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = (await response.json()) as SlackApiResponse<{
      channels?: SlackConversation[];
    }>;

    if (!payload.ok) {
      throw new Error(`Slack conversations.list failed: ${payload.error ?? response.status}`);
    }

    allChannels.push(...(payload.channels ?? []));
    cursor = payload.response_metadata?.next_cursor || undefined;
  } while (cursor);

  const existing = await admin
    .from("slack_channels")
    .select("slack_channel_id, is_selected")
    .eq("workspace_id", workspaceId);
  const selectedById = new Map(
    ((existing.data ?? []) as Array<{ is_selected: boolean; slack_channel_id: string }>).map(
      (row) => [row.slack_channel_id, row.is_selected],
    ),
  );
  const rows = allChannels
    .filter((channel) => channel.id && channel.name)
    .map((channel) => ({
      backfill_enabled: true,
      include_in_context: true,
      is_private: Boolean(channel.is_private || channel.is_group),
      is_selected:
        selectedById.get(channel.id) ??
        channel.name?.toLowerCase() === "all-orgbrain",
      slack_channel_id: channel.id,
      slack_channel_name: channel.name,
      slack_installation_id: installation.id,
      workspace_id: workspaceId,
    }));

  if (rows.length > 0) {
    const { error } = await admin
      .from("slack_channels")
      .upsert(rows, { onConflict: "workspace_id,slack_channel_id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  return rows.length;
}

export async function ensureSlackChannelMapping(slackChannel: SlackChannelRow) {
  if (slackChannel.channel_id) {
    return slackChannel.channel_id;
  }

  const admin = createAdminClient();
  const baseName = `slack-${slackChannel.slack_channel_name}`.toLowerCase();
  const channelName = baseName.replace(/[^a-z0-9-_]/g, "-").slice(0, 80);
  const { data: channel, error: channelError } = await admin
    .from("channels")
    .upsert(
      {
        name: channelName,
        workspace_id: slackChannel.workspace_id,
      },
      {
        onConflict: "workspace_id,name",
      },
    )
    .select("id")
    .single();

  if (channelError || !channel) {
    throw new Error(channelError?.message ?? "Could not create Slack channel mapping.");
  }

  const { error } = await admin
    .from("slack_channels")
    .update({ channel_id: channel.id })
    .eq("id", slackChannel.id);

  if (error) {
    throw new Error(error.message);
  }

  return channel.id as string;
}

async function getSlackUserName(token: string, userId?: string) {
  if (!userId) {
    return "Slack user";
  }

  try {
    const payload = await slackApi<{
      user?: {
        profile?: {
          display_name?: string;
          real_name?: string;
        };
        real_name?: string;
        name?: string;
      };
    }>({
      method: "users.info",
      token,
      body: {
        user: userId,
      },
    });

    return (
      payload.user?.profile?.display_name ||
      payload.user?.profile?.real_name ||
      payload.user?.real_name ||
      payload.user?.name ||
      "Slack user"
    );
  } catch {
    return "Slack user";
  }
}

async function getPermalink({
  channel,
  messageTs,
  token,
}: {
  channel: string;
  messageTs: string;
  token: string;
}) {
  try {
    const payload = await slackApi<{ permalink?: string }>({
      body: {
        channel,
        message_ts: messageTs,
      },
      method: "chat.getPermalink",
      token,
    });

    return payload.permalink ?? null;
  } catch {
    return null;
  }
}

export async function ingestSlackMessage({
  event,
  installation,
}: {
  event: SlackMessageEvent | SlackHistoryMessage & { channel: string };
  installation: SlackInstallationRow;
}) {
  if (!event.text?.trim() || event.subtype || ("bot_id" in event && event.bot_id)) {
    return null;
  }

  const admin = createAdminClient();
  const { token } = await getSlackTokenForWorkspace(installation.workspace_id);
  const { data: slackChannel, error: channelError } = await admin
    .from("slack_channels")
    .select(
      "id, workspace_id, slack_installation_id, channel_id, slack_channel_id, slack_channel_name, is_private, is_selected, include_in_context",
    )
    .eq("workspace_id", installation.workspace_id)
    .eq("slack_channel_id", event.channel)
    .eq("is_selected", true)
    .maybeSingle();

  if (channelError) {
    throw new Error(channelError.message);
  }

  if (!slackChannel) {
    return null;
  }

  const { data: existingMessage, error: existingError } = await admin
    .from("slack_messages")
    .select("chat_message_id")
    .eq("slack_team_id", installation.slack_team_id)
    .eq("slack_channel_external_id", event.channel)
    .eq("slack_message_ts", event.ts)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingMessage?.chat_message_id) {
    return null;
  }

  const mappedChannelId = await ensureSlackChannelMapping(slackChannel as SlackChannelRow);
  const authorName = await getSlackUserName(token, event.user);
  const permalink = await getPermalink({
    channel: event.channel,
    messageTs: event.ts,
    token,
  });
  const createdAt = new Date(Number(event.ts.split(".")[0]) * 1000).toISOString();
  const { data: message, error } = await admin
    .from("chat_messages")
    .insert({
      body: event.text.trim(),
      channel_id: mappedChannelId,
      command_name: null,
      created_at: createdAt,
      embedding_status: "pending",
      external_author_name: authorName,
      external_metadata: {
        permalink,
        slackChannelId: event.channel,
        slackChannelName: (slackChannel as SlackChannelRow).slack_channel_name,
        slackTeamId: installation.slack_team_id,
        slackThreadTs: event.thread_ts ?? null,
        slackTs: event.ts,
        slackUserId: event.user ?? null,
      },
      message_type: "user",
      sender_id: null,
      source: "slack",
      workspace_id: installation.workspace_id,
    })
    .select("id")
    .single();

  if (error || !message) {
    if (error?.code === "23505") {
      return null;
    }

    throw new Error(error?.message ?? "Could not save Slack message.");
  }

  await admin.from("slack_messages").upsert(
    {
      chat_message_id: message.id,
      permalink,
      slack_channel_external_id: event.channel,
      slack_channel_id: (slackChannel as SlackChannelRow).id,
      slack_message_ts: event.ts,
      slack_team_id: installation.slack_team_id,
      slack_thread_ts: event.thread_ts ?? null,
      slack_user_id: event.user ?? null,
      workspace_id: installation.workspace_id,
    },
    {
      onConflict: "slack_team_id,slack_channel_external_id,slack_message_ts",
    },
  );

  return message.id as string;
}

export async function processSlackBackfillJob(jobId: string) {
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("slack_backfill_jobs")
    .select(
      "id, workspace_id, slack_channel_id, next_cursor, imported_count, slack_channel:slack_channels!inner(slack_channel_id, workspace_id, slack_installation_id)",
    )
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    throw new Error(jobError?.message ?? "Backfill job not found.");
  }

  const { installation, token } = await getSlackTokenForWorkspace(String(job.workspace_id));
  const slackChannel = Array.isArray(job.slack_channel)
    ? job.slack_channel[0]
    : job.slack_channel;
  const cursor = typeof job.next_cursor === "string" ? job.next_cursor : undefined;
  const url = new URL("https://slack.com/api/conversations.history");
  url.searchParams.set("channel", String(slackChannel.slack_channel_id));
  url.searchParams.set("limit", "100");

  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = (await response.json()) as SlackApiResponse<{
    has_more?: boolean;
    messages?: SlackHistoryMessage[];
  }>;

  if (!payload.ok) {
    await admin
      .from("slack_backfill_jobs")
      .update({
        error: payload.error ?? "Slack history failed.",
        status: "failed",
      })
      .eq("id", jobId);
    throw new Error(payload.error ?? "Slack history failed.");
  }

  let imported = 0;

  for (const message of payload.messages ?? []) {
    const id = await ingestSlackMessage({
      event: {
        ...message,
        channel: String(slackChannel.slack_channel_id),
      },
      installation,
    });

    if (id) {
      imported += 1;
    }
  }

  const nextCursor = payload.response_metadata?.next_cursor || null;
  await admin
    .from("slack_backfill_jobs")
    .update({
      error: null,
      imported_count: Number(job.imported_count ?? 0) + imported,
      next_cursor: nextCursor,
      status: nextCursor || payload.has_more ? "running" : "completed",
    })
    .eq("id", jobId);

  return imported;
}

export async function postSlackMessage({
  channel,
  text,
  threadTs,
  workspaceId,
}: {
  channel: string;
  text: string;
  threadTs?: string;
  workspaceId: string;
}) {
  const { token } = await getSlackTokenForWorkspace(workspaceId);

  return slackApi<{ message?: { ts?: string }; ts?: string }>({
    body: {
      channel,
      text,
      thread_ts: threadTs,
    },
    method: "chat.postMessage",
    token,
  });
}

export function slackCallbackUrl() {
  return `${getAppConfig().appUrl}/api/slack/oauth/callback`;
}
