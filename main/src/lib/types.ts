export type AnswerProvider = "cohere" | "openai";
export type WorkspaceRole = "owner" | "member";
export type MessageType = "user" | "command" | "assistant" | "system";
export type EmbeddingStatus = "pending" | "completed" | "failed";
export type ToolName = "math.calculate" | "web.fetchPage";

export type Citation = {
  excerpt: string;
  messageId: string;
  similarity: number;
};

export type ChatMessage = {
  body: string;
  channelId: string;
  citations: Citation[];
  commandName: string | null;
  createdAt: string;
  embeddingStatus: EmbeddingStatus;
  id: string;
  messageType: MessageType;
  senderId: string | null;
  senderName: string;
  workspaceId: string;
};

export type WorkspaceSummary = {
  answerProvider: AnswerProvider;
  enabledTools: ToolName[];
  id: string;
  name: string;
  ownerId: string;
  role: WorkspaceRole;
  slug: string;
};

export type PendingInvite = {
  id: string;
  invitedEmail: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
};

export type WorkspaceMember = {
  email: string;
  fullName: string;
  role: WorkspaceRole;
  userId: string;
};

export type WorkspaceDetail = {
  answerProvider: AnswerProvider;
  channelId: string;
  channelName: string;
  enabledTools: ToolName[];
  id: string;
  members: WorkspaceMember[];
  messages: ChatMessage[];
  name: string;
  role: WorkspaceRole;
  slug: string;
};

export type ContextRunStatus = "running" | "completed" | "failed";

export type ChatContextRun = {
  answer: string | null;
  answerProvider: AnswerProvider;
  assistantMessageId: string | null;
  channelId: string;
  commandMessageId: string | null;
  createdAt: string;
  enabledTools: string[];
  error: string | null;
  id: string;
  inputTokens: number | null;
  model: string | null;
  modelInput: string | null;
  outputTokens: number | null;
  question: string;
  ragSnippets: unknown[];
  recentMessages: unknown[];
  status: ContextRunStatus;
  systemPrompt: string | null;
  tokenBreakdown: unknown[];
  tokenSource: string;
  toolCalls: unknown[];
  workspaceId: string;
};

export type TokenUsageModelSummary = {
  inputTokens: number;
  model: string;
  outputTokens: number;
  phases: string[];
  provider: AnswerProvider;
  runCount: number;
  source: string;
  totalTokens: number;
};

export type TokenUsageWorkspaceSummary = {
  inputTokens: number;
  outputTokens: number;
  runCount: number;
  slug: string;
  totalTokens: number;
  workspaceId: string;
  workspaceName: string;
};

export type TokenUsageRecentRun = {
  answerProvider: AnswerProvider;
  createdAt: string;
  inputTokens: number | null;
  model: string | null;
  outputTokens: number | null;
  question: string;
  source: string;
  status: ContextRunStatus;
  totalTokens: number | null;
  workspaceId: string;
  workspaceName: string;
};

export type TokenUsageData = {
  models: TokenUsageModelSummary[];
  recentRuns: TokenUsageRecentRun[];
  totals: {
    estimatedRuns: number;
    inputTokens: number;
    outputTokens: number;
    providerReportedRuns: number;
    runCount: number;
    totalTokens: number;
  };
  workspaces: TokenUsageWorkspaceSummary[];
};
