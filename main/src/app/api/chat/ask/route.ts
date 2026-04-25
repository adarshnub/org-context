import { NextResponse } from "next/server";

import {
  buildCitations,
  createEmbedding,
  generateAnswer,
  getAskTopK,
} from "@/lib/ai";
import { extractAskQuery, isAskCommand } from "@/lib/chat";
import { normalizeInsertedMessage } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { askCommandSchema } from "@/lib/validators";

type MatchRow = {
  body: string;
  created_at: string;
  id: string;
  similarity: number;
  sender: { full_name?: string | null } | null;
  sender_id: string | null;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
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

    const [{ data: membership }, { data: profile }, { data: workspace }] =
      await Promise.all([
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
        supabase
          .from("workspaces")
          .select("answer_provider")
          .eq("id", payload.workspaceId)
          .single(),
      ]);

    if (!membership) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const commandText = payload.text.trim();
    const question = extractAskQuery(commandText);
    const { data: commandRow, error: commandError } = await supabase
      .from("chat_messages")
      .insert({
        body: commandText,
        channel_id: payload.channelId,
        command_name: "ask",
        embedding_status: "pending",
        message_type: "command",
        sender_id: user.id,
        workspace_id: payload.workspaceId,
      })
      .select("id, created_at, embedding_status")
      .single();

    if (commandError || !commandRow) {
      return NextResponse.json(
        { error: commandError?.message ?? "Could not save ask command." },
        { status: 500 },
      );
    }

    const queryEmbedding = await createEmbedding(question, "search_query");
    const { data: matches, error: matchError } = await admin.rpc(
      "match_chat_messages",
      {
        channel_id_input: payload.channelId,
        match_count: getAskTopK(),
        query_embedding: queryEmbedding,
        workspace_id_input: payload.workspaceId,
      },
    );

    if (matchError) {
      throw new Error(matchError.message);
    }

    const topMatches = ((matches ?? []) as MatchRow[]).map((match) => ({
      body: match.body,
      createdAt: match.created_at,
      id: match.id,
      senderName: match.sender?.full_name ?? "Workspace member",
      similarity: match.similarity,
    }));

    const answer = await generateAnswer({
      provider: workspace?.answer_provider ?? "cohere",
      question,
      snippets: topMatches,
    });

    const citations = buildCitations(topMatches);
    const { data: assistantRow, error: assistantError } = await admin
      .from("chat_messages")
      .insert({
        body: answer,
        channel_id: payload.channelId,
        citations,
        command_name: null,
        embedding_status: "pending",
        message_type: "assistant",
        sender_id: null,
        workspace_id: payload.workspaceId,
      })
      .select("id, created_at, embedding_status")
      .single();

    if (assistantError || !assistantRow) {
      throw new Error(assistantError?.message ?? "Could not save assistant reply.");
    }

    return NextResponse.json({
      assistant: normalizeInsertedMessage({
        body: answer,
        channelId: payload.channelId,
        citations,
        createdAt: assistantRow.created_at,
        embeddingStatus: assistantRow.embedding_status,
        id: assistantRow.id,
        messageType: "assistant",
        senderId: null,
        senderName: "Org Context",
        workspaceId: payload.workspaceId,
      }),
      message: normalizeInsertedMessage({
        body: commandText,
        channelId: payload.channelId,
        commandName: "ask",
        createdAt: commandRow.created_at,
        embeddingStatus: commandRow.embedding_status,
        id: commandRow.id,
        messageType: "command",
        senderId: user.id,
        senderName: profile?.full_name ?? user.email ?? "You",
        workspaceId: payload.workspaceId,
      }),
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
