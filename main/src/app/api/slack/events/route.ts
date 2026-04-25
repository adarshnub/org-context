import { NextResponse } from "next/server";

import {
  ingestSlackMessage,
  type SlackInstallationRow,
  verifySlackRequest,
} from "@/lib/slack";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type SlackEventPayload = {
  challenge?: string;
  event?: {
    channel?: string;
    subtype?: string;
    text?: string;
    thread_ts?: string;
    ts?: string;
    type?: string;
    user?: string;
  };
  event_id?: string;
  team_id?: string;
  type?: string;
};

export async function POST(request: Request) {
  const body = await request.text();

  try {
    verifySlackRequest({
      body,
      signature: request.headers.get("x-slack-signature"),
      timestamp: request.headers.get("x-slack-request-timestamp"),
    });

    const payload = JSON.parse(body) as SlackEventPayload;

    if (payload.type === "url_verification") {
      return NextResponse.json({ challenge: payload.challenge });
    }

    if (payload.type !== "event_callback" || !payload.event || !payload.team_id) {
      return NextResponse.json({ ok: true });
    }

    const admin = createAdminClient();
    const { data: installation, error: installationError } = await admin
      .from("slack_installations")
      .select(
        "id, workspace_id, slack_team_id, slack_team_name, bot_user_id, bot_access_token_encrypted",
      )
      .eq("slack_team_id", payload.team_id)
      .maybeSingle();

    if (installationError) {
      throw new Error(installationError.message);
    }

    if (!installation) {
      return NextResponse.json({ ok: true });
    }

    if (payload.event_id) {
      const { error: eventError } = await admin.from("slack_events").insert({
        event_type: payload.event.type ?? "unknown",
        payload,
        slack_event_id: payload.event_id,
        slack_team_id: payload.team_id,
        workspace_id: installation.workspace_id,
      });

      if (eventError?.code === "23505") {
        return NextResponse.json({ ok: true });
      }

      if (eventError) {
        throw new Error(eventError.message);
      }
    }

    if (
      payload.event.type === "message" &&
      payload.event.channel &&
      payload.event.ts &&
      payload.event.text
    ) {
      await ingestSlackMessage({
        event: {
          channel: payload.event.channel,
          subtype: payload.event.subtype,
          text: payload.event.text,
          thread_ts: payload.event.thread_ts,
          ts: payload.event.ts,
          user: payload.event.user,
        },
        installation: installation as SlackInstallationRow,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not handle Slack event.",
      },
      { status: 500 },
    );
  }
}
