import { NextResponse } from "next/server";

import {
  buildCitations,
  combineUsage,
  createEmbedding,
  generateAnswer,
  getAskTopK,
  planToolRequests,
} from "@/lib/ai";
import { extractAskQuery, isAskCommand } from "@/lib/chat";
import {
  buildAnswerContext,
  type ContextMessage,
  type RetrievedCodeSnippet,
} from "@/lib/context";
import { normalizeInsertedMessage } from "@/lib/data";
import { getAppConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { describeTools, executeToolRequests, normalizeEnabledTools } from "@/lib/tools";
import type { ToolExecution } from "@/lib/tools/types";
import { askCommandSchema } from "@/lib/validators";

export const runtime = "nodejs";

type MatchRow = {
  body: string;
  created_at: string;
  id: string;
  message_type?: "user" | "command" | "assistant" | "system";
  similarity: number;
  sender: { full_name?: string | null } | null;
  sender_id: string | null;
};

type RecentRow = {
  body: string;
  created_at: string;
  id: string;
  message_type: "user" | "command" | "assistant" | "system";
  sender: { full_name?: string | null } | null;
  sender_id: string | null;
};

type CodeMatchRow = {
  branch: string;
  chunk_id: string;
  commit_sha: string | null;
  content: string;
  content_preview: string;
  end_line: number;
  github_owner: string;
  github_repo: string;
  path: string;
  repo_url: string;
  similarity: number;
  start_line: number;
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
    senderName: row.sender?.full_name ?? (row.sender_id ? "Workspace member" : "Org Context"),
  };
}

function buildCodeCitations(snippets: RetrievedCodeSnippet[]) {
  return snippets.slice(0, 3).map((snippet) => ({
    branch: snippet.branch,
    codeChunkId: snippet.id,
    commitSha: snippet.commitSha ?? undefined,
    endLine: snippet.endLine,
    excerpt: snippet.content.slice(0, 180),
    path: snippet.path,
    repoName: snippet.repoName,
    similarity: snippet.similarity,
    sourceType: "code_chunk" as const,
    startLine: snippet.startLine,
  }));
}

export async function POST(request: Request) {
  const admin = createAdminClient();
  let runId: string | null = null;

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
          .select("answer_provider, enabled_tools")
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

    const provider = workspace?.answer_provider ?? "cohere";
    const enabledTools = normalizeEnabledTools(workspace?.enabled_tools);
    const queryEmbedding = await createEmbedding(question, "search_query");
    const { recentMessageCount } = getAppConfig();
    const [
      { data: matches, error: matchError },
      { data: codeMatches, error: codeMatchError },
      { data: recentRows, error: recentError },
    ] =
      await Promise.all([
        admin.rpc("match_chat_messages", {
          accepted_message_types: ["user"],
          channel_id_input: payload.channelId,
          exclude_message_id_input: commandRow.id,
          match_count: getAskTopK(),
          query_embedding: queryEmbedding,
          workspace_id_input: payload.workspaceId,
        }),
        admin.rpc("match_repository_code_chunks", {
          match_count: getAskTopK(),
          query_embedding: queryEmbedding,
          workspace_id_input: payload.workspaceId,
        }),
        supabase
          .from("chat_messages")
          .select(
            "id, sender_id, body, message_type, created_at, sender:profiles!chat_messages_sender_id_fkey(full_name)",
          )
          .eq("workspace_id", payload.workspaceId)
          .eq("channel_id", payload.channelId)
          .in("message_type", ["user", "command", "assistant"])
          .lt("created_at", commandRow.created_at)
          .order("created_at", { ascending: false })
          .limit(recentMessageCount),
      ]);

    if (matchError) {
      throw new Error(matchError.message);
    }

    if (codeMatchError) {
      throw new Error(codeMatchError.message);
    }

    if (recentError) {
      throw new Error(recentError.message);
    }

    const topMatches = ((matches ?? []) as MatchRow[]).map((match) => ({
      body: match.body,
      createdAt: match.created_at,
      id: match.id,
      messageType: match.message_type,
      senderName: match.sender?.full_name ?? "Workspace member",
      similarity: match.similarity,
    }));
    const recentMessages = ((recentRows ?? []) as RecentRow[])
      .map(toRecentMessage)
      .reverse();
    const repositorySnippets = ((codeMatches ?? []) as CodeMatchRow[]).map(
      (match) => ({
        branch: match.branch,
        commitSha: match.commit_sha,
        content: match.content,
        endLine: match.end_line,
        id: match.chunk_id,
        path: match.path,
        repoName: `${match.github_owner}/${match.github_repo}`,
        repoUrl: match.repo_url,
        similarity: match.similarity,
        startLine: match.start_line,
      }),
    );
    const initialContext = buildAnswerContext({
      question,
      recentMessages,
      repositorySnippets,
      retrievedSnippets: topMatches,
    });

    const { data: runRow, error: runError } = await admin
      .from("chat_context_runs")
      .insert({
        answer_provider: provider,
        channel_id: payload.channelId,
        command_message_id: commandRow.id,
        enabled_tools: enabledTools,
        model_input: initialContext.modelInput,
        question,
        rag_snippets: initialContext.ragSnippets,
        repository_snippets: initialContext.repositorySnippets,
        recent_messages: initialContext.recentMessages,
        status: "running",
        system_prompt: initialContext.systemPrompt,
        workspace_id: payload.workspaceId,
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

      toolCalls = await executeToolRequests(toolPlan.requests, enabledTools);
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
      repositorySnippets,
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
        source: item.source === "provider" ? "provider" as const : "estimated" as const,
      })),
    ]);
    const citations = [
      ...buildCitations(finalContext.ragSnippets),
      ...buildCodeCitations(finalContext.repositorySnippets),
    ];
    const { data: assistantRow, error: assistantError } = await admin
      .from("chat_messages")
      .insert({
        body: answerResult.text,
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
        repository_snippets: finalContext.repositorySnippets,
        recent_messages: finalContext.recentMessages,
        status: "completed",
        system_prompt: finalContext.systemPrompt,
        token_breakdown: tokenBreakdown,
        token_source: usage.source,
        tool_calls: toolCalls,
      })
      .eq("id", runId);

    return NextResponse.json({
      assistant: normalizeInsertedMessage({
        body: answerResult.text,
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
    if (runId) {
      await admin
        .from("chat_context_runs")
        .update({
          error: error instanceof Error ? error.message : "Could not run ask command.",
          status: "failed",
        })
        .eq("id", runId);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not run ask command.",
      },
      { status: 500 },
    );
  }
}
