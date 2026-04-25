import { buildAnswerInstructions } from "@/lib/chat";
import { getAppConfig } from "@/lib/env";
import type { ChatMessage, MessageType } from "@/lib/types";

export type ContextMessage = Pick<
  ChatMessage,
  "body" | "createdAt" | "id" | "messageType" | "senderName"
>;

export type RetrievedSnippet = {
  body: string;
  createdAt: string;
  id: string;
  messageType?: MessageType;
  senderName: string;
  similarity: number;
};

export type RetrievedCodeSnippet = {
  branch: string;
  commitSha: string | null;
  content: string;
  endLine: number;
  id: string;
  path: string;
  repoName: string;
  repoUrl: string;
  similarity: number;
  startLine: number;
};

export type ToolResultForContext = {
  error?: string;
  input: unknown;
  name: string;
  output?: unknown;
  status: string;
};

export type AnswerContext = {
  modelInput: string;
  ragSnippets: RetrievedSnippet[];
  repositorySnippets: RetrievedCodeSnippet[];
  recentMessages: ContextMessage[];
  systemPrompt: string;
};

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatRecentMessage(message: ContextMessage, index: number) {
  return [
    `Recent message ${index + 1}`,
    `Sender: ${message.senderName}`,
    `Created: ${message.createdAt}`,
    `Type: ${message.messageType}`,
    `Message: ${message.body}`,
  ].join("\n");
}

function formatSnippet(snippet: RetrievedSnippet, index: number) {
  return [
    `Source ${index + 1}`,
    `Sender: ${snippet.senderName}`,
    `Created: ${snippet.createdAt}`,
    `Similarity: ${snippet.similarity.toFixed(4)}`,
    `Message: ${snippet.body}`,
  ].join("\n");
}

function formatCodeSnippet(snippet: RetrievedCodeSnippet, index: number) {
  return [
    `Code source ${index + 1}`,
    `Repository: ${snippet.repoName}`,
    `Branch: ${snippet.branch}`,
    `Path: ${snippet.path}`,
    `Lines: ${snippet.startLine}-${snippet.endLine}`,
    `Commit: ${snippet.commitSha ?? "unknown"}`,
    `Similarity: ${snippet.similarity.toFixed(4)}`,
    `Code:\n${snippet.content}`,
  ].join("\n");
}

function formatToolResult(result: ToolResultForContext, index: number) {
  return [
    `Tool result ${index + 1}`,
    `Tool: ${result.name}`,
    `Status: ${result.status}`,
    `Input: ${stringifyJson(result.input)}`,
    result.error ? `Error: ${result.error}` : `Output: ${stringifyJson(result.output)}`,
  ].join("\n");
}

export function buildAnswerContext({
  question,
  recentMessages,
  repositorySnippets = [],
  retrievedSnippets,
  toolResults = [],
}: {
  question: string;
  recentMessages: ContextMessage[];
  repositorySnippets?: RetrievedCodeSnippet[];
  retrievedSnippets: RetrievedSnippet[];
  toolResults?: ToolResultForContext[];
}): AnswerContext {
  const { contextTokenBudget } = getAppConfig();
  const systemPrompt = buildAnswerInstructions();
  const recentIds = new Set(recentMessages.map((message) => message.id));
  const dedupedSnippets = retrievedSnippets.filter((snippet) => !recentIds.has(snippet.id));
  const acceptedRecent: ContextMessage[] = [];
  const acceptedSnippets: RetrievedSnippet[] = [];
  const acceptedCodeSnippets: RetrievedCodeSnippet[] = [];
  const acceptedTools: ToolResultForContext[] = [];
  let spent = estimateTokens(systemPrompt) + estimateTokens(question);

  for (const message of recentMessages) {
    const nextCost = estimateTokens(formatRecentMessage(message, acceptedRecent.length));

    if (spent + nextCost > contextTokenBudget) {
      break;
    }

    spent += nextCost;
    acceptedRecent.push(message);
  }

  for (const snippet of dedupedSnippets) {
    const nextCost = estimateTokens(formatSnippet(snippet, acceptedSnippets.length));

    if (spent + nextCost > contextTokenBudget) {
      break;
    }

    spent += nextCost;
    acceptedSnippets.push(snippet);
  }

  for (const snippet of repositorySnippets) {
    const nextCost = estimateTokens(
      formatCodeSnippet(snippet, acceptedCodeSnippets.length),
    );

    if (spent + nextCost > contextTokenBudget) {
      break;
    }

    spent += nextCost;
    acceptedCodeSnippets.push(snippet);
  }

  for (const toolResult of toolResults) {
    const nextCost = estimateTokens(formatToolResult(toolResult, acceptedTools.length));

    if (spent + nextCost > contextTokenBudget) {
      break;
    }

    spent += nextCost;
    acceptedTools.push(toolResult);
  }

  const recentContext =
    acceptedRecent.length > 0
      ? acceptedRecent.map(formatRecentMessage).join("\n\n")
      : "No recent messages were included.";
  const retrievedContext =
    acceptedSnippets.length > 0
      ? acceptedSnippets.map(formatSnippet).join("\n\n")
      : "No retrieved chat snippets were found.";
  const codeContext =
    acceptedCodeSnippets.length > 0
      ? acceptedCodeSnippets.map(formatCodeSnippet).join("\n\n")
      : "No indexed code snippets were found.";
  const toolContext =
    acceptedTools.length > 0
      ? acceptedTools.map(formatToolResult).join("\n\n")
      : "No tool results were used.";

  const modelInput = [
    `Question:\n${question}`,
    `Recent chat context:\n${recentContext}`,
    `Retrieved chat memory:\n${retrievedContext}`,
    `Retrieved indexed code:\n${codeContext}`,
    `Tool results:\n${toolContext}`,
  ].join("\n\n");

  return {
    modelInput,
    ragSnippets: acceptedSnippets,
    repositorySnippets: acceptedCodeSnippets,
    recentMessages: acceptedRecent,
    systemPrompt,
  };
}
