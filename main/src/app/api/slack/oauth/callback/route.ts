import { NextResponse } from "next/server";

import {
  encryptSlackToken,
  exchangeSlackOAuthCode,
  refreshSlackChannels,
  slackCallbackUrl,
  verifySlackState,
} from "@/lib/slack";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard?slackError=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Slack OAuth callback is missing code or state." },
      { status: 400 },
    );
  }

  try {
    const { userId, workspaceId } = verifySlackState(state);
    const result = await exchangeSlackOAuthCode({
      code,
      redirectUri: slackCallbackUrl(),
    });
    const admin = createAdminClient();
    const { error: upsertError } = await admin
      .from("slack_installations")
      .upsert(
        {
          bot_access_token_encrypted: encryptSlackToken(result.botAccessToken),
          bot_user_id: result.botUserId,
          connected_by: userId,
          slack_team_id: result.teamId,
          slack_team_name: result.teamName,
          workspace_id: workspaceId,
        },
        {
          onConflict: "workspace_id",
        },
      );

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    await refreshSlackChannels(workspaceId);

    return NextResponse.redirect(
      new URL(
        `/workspaces/${workspaceId}?slackMessage=${encodeURIComponent(
          `Connected Slack workspace ${result.teamName}.`,
        )}`,
        request.url,
      ),
    );
  } catch (caughtError) {
    return NextResponse.redirect(
      new URL(
        `/dashboard?slackError=${encodeURIComponent(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not connect Slack.",
        )}`,
        request.url,
      ),
    );
  }
}
