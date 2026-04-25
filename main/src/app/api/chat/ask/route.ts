import { NextResponse } from "next/server";

import { runAsk } from "@/lib/ask";
import { isAskCommand } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";
import { askCommandSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = askCommandSchema.parse(await request.json());

    if (!isAskCommand(payload.text)) {
      return NextResponse.json(
        { error: "Ask requests must start with /ask ." },
        { status: 400 },
      );
    }

    const [{ data: membership }, { data: profile }] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", payload.workspaceId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single(),
    ]);

    if (!membership) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const result = await runAsk({
      actorName: profile?.full_name ?? user.email ?? "You",
      channelId: payload.channelId,
      senderId: user.id,
      text: payload.text,
      workspaceId: payload.workspaceId,
    });

    return NextResponse.json({
      assistant: result.assistant,
      message: result.command,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not run ask command.",
      },
      { status: 500 },
    );
  }
}
