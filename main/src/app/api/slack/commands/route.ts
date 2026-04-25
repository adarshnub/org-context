import { after, NextResponse } from "next/server";

import { runAsk } from "@/lib/ask";
import {
  ensureSlackChannelMapping,
  postSlackMessage,
  verifySlackRequest,
} from "@/lib/slack";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function handleSlackAsk(form: URLSearchParams) {
  const teamId = form.get("team_id");
  const slackChannelId = form.get("channel_id");
  const slackUserId = form.get("user_id");
  const slackUserName = form.get("user_name") ?? "Slack user";
  const rawText = form.get("text")?.trim() ?? "";

  if (!teamId || !slackChannelId) {
    throw new Error("Slack command payload was missing team or channel.");
  }

  const question = rawText.toLowerCase().startsWith("ask ")
    ? rawText.slice(4).trim()
    : rawText;

  if (!question) {
    throw new Error("Try `/orgbrain ask what did we decide about launch?`");
  }

  const admin = createAdminClient();
  const { data: installation, error: installationError } = await admin
    .from("slack_installations")
    .select(
      "id, workspace_id, slack_team_id, slack_team_name, bot_user_id, bot_access_token_encrypted",
    )
    .eq("slack_team_id", teamId)
    .maybeSingle();

  if (installationError || !installation) {
    throw new Error(installationError?.message ?? "Slack workspace is not connected.");
  }

  const { data: slackChannel, error: channelError } = await admin
    .from("slack_channels")
    .select(
      "id, workspace_id, slack_installation_id, channel_id, slack_channel_id, slack_channel_name, is_private, is_selected, include_in_context",
    )
    .eq("workspace_id", installation.workspace_id)
    .eq("slack_channel_id", slackChannelId)
    .eq("is_selected", true)
    .maybeSingle();

  if (channelError || !slackChannel) {
    throw new Error(
      channelError?.message ?? "This Slack channel is not selected for Org Context.",
    );
  }

  const mappedChannelId = await ensureSlackChannelMapping(slackChannel);

  const intro = await postSlackMessage({
    channel: slackChannelId,
    text: `Org Context is checking workspace memory for: “${question}”`,
    workspaceId: installation.workspace_id,
  });
  const threadTs = intro.ts ?? intro.message?.ts;
  const result = await runAsk({
    actorName: slackUserName,
    assistantMetadata: {
      slackChannelId,
      slackTeamId: teamId,
      slackThreadTs: threadTs ?? null,
    },
    assistantSource: "slack",
    channelId: mappedChannelId,
    commandMetadata: {
      slackChannelId,
      slackCommand: "/orgbrain",
      slackTeamId: teamId,
      slackUserId,
    },
    commandSource: "slack",
    senderId: null,
    text: `/ask ${question}`,
    workspaceId: installation.workspace_id,
  });

  await postSlackMessage({
    channel: slackChannelId,
    text: result.answer,
    threadTs,
    workspaceId: installation.workspace_id,
  });
}

export async function POST(request: Request) {
  const body = await request.text();

  try {
    verifySlackRequest({
      body,
      signature: request.headers.get("x-slack-signature"),
      timestamp: request.headers.get("x-slack-request-timestamp"),
    });

    const form = new URLSearchParams(body);

    after(async () => {
      try {
        await handleSlackAsk(form);
      } catch (error) {
        const responseUrl = form.get("response_url");

        if (responseUrl) {
          await fetch(responseUrl, {
            body: JSON.stringify({
              response_type: "ephemeral",
              text:
                error instanceof Error
                  ? error.message
                  : "Org Context could not answer this Slack request.",
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          });
        }
      }
    });

    return NextResponse.json({
      response_type: "ephemeral",
      text: "Org Context is working on it. I’ll post the answer in this channel.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        response_type: "ephemeral",
        text:
          error instanceof Error
            ? error.message
            : "Could not process Slack command.",
      },
      { status: 200 },
    );
  }
}
