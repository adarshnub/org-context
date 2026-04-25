import { NextResponse } from "next/server";

import { buildSlackInstallUrl, signSlackState, slackCallbackUrl } from "@/lib/slack";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership || membership.role !== "owner") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    return NextResponse.redirect(
      buildSlackInstallUrl({
        redirectUri: slackCallbackUrl(),
        state: signSlackState({
          userId: user.id,
          workspaceId,
        }),
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not start Slack OAuth.",
      },
      { status: 500 },
    );
  }
}
