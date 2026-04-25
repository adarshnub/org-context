import {
  buildCitations,
  combineUsage,
  createEmbedding,
  generateAnswer,
  getAskTopK,
  planToolRequests,
} from "@/lib/ai";
import { extractAskQuery } from "@/lib/chat";
import { buildAnswerContext, type ContextMessage } from "@/lib/context";
import { normalizeInsertedMessage } from "@/lib/data";
import { getAppConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeTools, executeToolRequests, normalizeEnabledTools } from "@/lib/tools";
import type { ToolExecution } from "@/lib/tools/types";
import type { AnswerProvider, ChatMessage } from "@/lib/types";

type MatchRow = {
  body: string;
  created_at: string;
  external_author_name?: string | null;
  id: string;
  message_type?: "user" | "command" | "assistant" | "system";
  similarity: number;
  sender: { full_name?: string | null } | null;
  sender_id: string | null;
  source?: string;
};

type RecentRow = {
  body: string;
  created_at: string;
  external_author_name?: string | null;
  id: string;
  message_type: "user" | "command" | "assistant" | "system";
  sender: { full_name?: string | null } | null;
  sender_id: string | null;
  source?: string;
};

type TokenBreakdown = {
  inputTokens: number | null;
  model: string;
  outputTokens: number | null;
  phase: string;
  source: string;
};

function toRecentMessage(row: RecentRow): ContextMessage {
  return {
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    messageType: row.message_type,
    senderName:
      row.sender?.full_name ??
      row.external_author_name ??
      (row.sender_id ? "Workspace member" : "Org Context"),
  };
}

async function getContextChannelIds(workspaceId: string, invokingChannelId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("slack_channels")
    .select("channel_id")
    .eq("workspace_id", workspaceId)
    .eq("is_selected", true)
    .eq("include_in_context", true);

  if (error) {
    throw new Error(error.message);
  }

  return [
    ...new Set([
      invokingChannelId,
      ...(data ?? [])
        .map((row) => row.channel_id)
        .filter((channelId): channelId is string => typeof channelId === "string"),
    ]),
  ];
}

export async function runAsk({
  actorName,
  assistantMetadata = {},
  assistantSource = "app",
  channelId,
  commandMetadata = {},
  commandSource = "app",
  senderId,
  text,
  workspaceId,
}: {
  actorName: string;
  assistantMetadata?: Record<string, unknown>;
  assistantSource?: string;
  channelId: string;
  commandMetadata?: Record<string, unknown>;
  commandSource?: string;
  senderId: string | null;
  text: string;
  workspaceId: string;
}) {
  const admin = createAdminClient();
  let runId: string | null = null;
  const commandText = text.trim();
  const question = extractAskQuery(commandText);

  try {
    const { data: workspace, error: workspaceError } = await admin
      .from("workspaces")
      .select("answer_provider, enabled_tools")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      throw new Error(workspaceError?.message ?? "Workspace not found.");
    }

    const { data: commandRow, error: commandError } = await admin
      .from("chat_messages")
      .insert({
        body: commandText,
        channel_id: channelId,
        command_name: "ask",
        embedding_status: "pending",
        external_author_name: senderId ? null : actorName,
        external_metadata: commandMetadata,
        message_type: "command",
        sender_id: senderId,
        source: commandSource,
        workspace_id: workspaceId,
      })
      .select("id, created_at, embedding_status")
      .single();

    if (commandError || !commandRow) {
      throw new Error(commandError?.message ?? "Could not save ask command.");
    }

    const provider = (workspace.answer_provider ?? "cohere") as AnswerProvider;
    const enabledTools = normalizeEnabledTools(workspace.enabled_tools);
    const queryEmbedding = await createEmbedding(question, "search_query");
    const { recentMessageCount } = getAppConfig();
    const contextChannelIds = await getContextChannelIds(workspaceId, channelId);
    const [{ data: matches, error: matchError }, { data: recentRows, error: recentError }] =
      await Promise.all([
        admin.rpc("match_workspace_chat_messages", {
          accepted_message_types: ["user"],
          channel_ids_input: contextChannelIds,
          exclude_message_id_input: commandRow.id,
          match_count: getAskTopK(),
          query_embedding: queryEmbedding,
          workspace_id_input: workspaceId,
        }),
        admin
          .from("chat_messages")
          .select(
            "id, sender_id, body, message_type, created_at, source, external_author_name, sender:profiles!chat_messages_sender_id_fkey(full_name)",
          )
          .eq("workspace_id", workspaceId)
          .eq("channel_id", channelId)
          .in("message_type", ["user", "command", "assistant"])
          .lt("created_at", commandRow.created_at)
          .order("created_at", { ascending: false })
          .limit(recentMessageCount),
      ]);

    if (matchError) {
      throw new Error(matchError.message);
    }

    if (recentError) {
      throw new Error(recentError.message);
    }

    const topMatches = ((matches ?? []) as MatchRow[]).map((match) => ({
      body: match.body,
      createdAt: match.created_at,
      id: match.id,
      messageType: match.message_type,
      senderName:
        match.sender?.full_name ??
        match.external_author_name ??
        (match.source === "slack" ? "Slack user" : "Workspace member"),
      similarity: match.similarity,
    }));
    const recentMessages = ((recentRows ?? []) as RecentRow[])
      .map(toRecentMessage)
      .reverse();
    const initialContext = buildAnswerContext({
      question,
      recentMessages,
      retrievedSnippets: topMatches,
    });
    const { data: runRow, error: runError } = await admin
      .from("chat_context_runs")
      .insert({
        answer_provider: provider,
        channel_id: channelId,
        command_message_id: commandRow.id,
        enabled_tools: enabledTools,
        model_input: initialContext.modelInput,
        question,
        rag_snippets: initialContext.ragSnippets,
        recent_messages: initialContext.recentMessages,
        status: "running",
        system_prompt: initialContext.systemPrompt,
        workspace_id: workspaceId,
      })
      .select("id")
      .single();

    if (runError || !runRow) {
      throw new Error(runError?.message ?? "Could not save context debug run.");
    }

    runId = runRow.id;

    const tokenBreakdown: TokenBreakdown[] = [];
    let toolCalls: ToolExecution[] = [];

    try {
      const toolPlan = await planToolRequests({
        input: initialContext.modelInput,
        provider,
        systemPrompt: initialContext.systemPrompt,
        tools: describeTools(enabledTools),
      });

      if (toolPlan.result) {
        tokenBreakdown.push({
          inputTokens: toolPlan.result.usage.inputTokens,
          model: toolPlan.result.model,
          outputTokens: toolPlan.result.usage.outputTokens,
          phase: "tool_planning",
          source: toolPlan.result.usage.source,
        });
      }

      toolCalls = await executeToolRequests(toolPlan.requests, enabledTools, {
        workspaceId,
      });
    } catch (error) {
      toolCalls = [
        {
          durationMs: 0,
          error: error instanceof Error ? error.message : "Tool planning failed.",
          input: {},
          name: "__tool_planning__",
          status: "failed",
        },
      ];
    }

    const finalContext = buildAnswerContext({
      question,
      recentMessages,
      retrievedSnippets: topMatches,
      toolResults: toolCalls,
    });
    const answerResult = await generateAnswer({
      input: finalContext.modelInput,
      provider,
      systemPrompt: finalContext.systemPrompt,
    });
    tokenBreakdown.push({
      inputTokens: answerResult.usage.inputTokens,
      model: answerResult.model,
      outputTokens: answerResult.usage.outputTokens,
      phase: "answer",
      source: answerResult.usage.source,
    });

    const usage = combineUsage([
      ...tokenBreakdown.map((item) => ({
        inputTokens: item.inputTokens,
        outputTokens: item.outputTokens,
        source: item.source === "provider" ? ("provider" as const) : ("estimated" as const),
      })),
    ]);
    const citations = buildCitations(finalContext.ragSnippets);
    const { data: assistantRow, error: assistantError } = await admin
      .from("chat_messages")
      .insert({
        body: answerResult.text,
        channel_id: channelId,
        citations,
        command_name: null,
        embedding_status: "pending",
        external_author_name: assistantSource === "slack" ? "Org Context" : null,
        external_metadata: assistantMetadata,
        message_type: "assistant",
        sender_id: null,
        source: assistantSource,
        workspace_id: workspaceId,
      })
      .select("id, created_at, embedding_status")
      .single();

    if (assistantError || !assistantRow) {
      throw new Error(assistantError?.message ?? "Could not save assistant reply.");
    }

    await admin
      .from("chat_context_runs")
      .update({
        answer: answerResult.text,
        assistant_message_id: assistantRow.id,
        input_tokens: usage.inputTokens,
        model: answerResult.model,
        model_input: finalContext.modelInput,
        output_tokens: usage.outputTokens,
        rag_snippets: finalContext.ragSnippets,
        recent_messages: finalContext.recentMessages,
        status: "completed",
        system_prompt: finalContext.systemPrompt,
        token_breakdown: tokenBreakdown,
        token_source: usage.source,
        tool_calls: toolCalls,
      })
      .eq("id", runId);

    return {
      answer: answerResult.text,
      assistant: normalizeInsertedMessage({
        body: answerResult.text,
        channelId,
        citations,
        createdAt: assistantRow.created_at,
        embeddingStatus: assistantRow.embedding_status,
        id: assistantRow.id,
        messageType: "assistant",
        senderId: null,
        senderName: "Org Context",
        workspaceId,
      }) satisfies ChatMessage,
      command: normalizeInsertedMessage({
        body: commandText,
        channelId,
        commandName: "ask",
        createdAt: commandRow.created_at,
        embeddingStatus: commandRow.embedding_status,
        id: commandRow.id,
        messageType: "command",
        senderId,
        senderName: actorName,
        workspaceId,
      }) satisfies ChatMessage,
      runId,
    };
  } catch (error) {
    if (runId) {
      await admin
        .from("chat_context_runs")
        .update({
          error: error instanceof Error ? error.message : "Could not run ask command.",
          status: "failed",
        })
        .eq("id", runId);
    }

    throw error;
  }
}
