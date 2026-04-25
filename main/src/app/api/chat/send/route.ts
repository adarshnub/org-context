import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { normalizeInsertedMessage } from "@/lib/data";
import { sendMessageSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = sendMessageSchema.parse(await request.json());

    if (payload.text.trim().startsWith("/ask ")) {
      return NextResponse.json(
        { error: "Use /api/chat/ask for ask commands." },
        { status: 400 },
      );
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", payload.workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const { data: message, error } = await supabase
      .from("chat_messages")
      .insert({
        body: payload.text.trim(),
        channel_id: payload.channelId,
        command_name: null,
        embedding_status: "pending",
        message_type: "user",
        sender_id: user.id,
        workspace_id: payload.workspaceId,
      })
      .select("id, created_at, embedding_status")
      .single();

    if (error || !message) {
      return NextResponse.json(
        { error: error?.message ?? "Could not save message." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: normalizeInsertedMessage({
        body: payload.text.trim(),
        channelId: payload.channelId,
        createdAt: message.created_at,
        embeddingStatus: message.embedding_status,
        id: message.id,
        messageType: "user",
        senderId: user.id,
        senderName: profile?.full_name ?? user.email ?? "You",
        workspaceId: payload.workspaceId,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not send message.",
      },
      { status: 500 },
    );
  }
}
