export type AnswerProvider = "cohere" | "openai";
export type WorkspaceRole = "owner" | "member";
export type MessageType = "user" | "command" | "assistant" | "system";
export type EmbeddingStatus = "pending" | "completed" | "failed";
export type ToolName = "math.calculate" | "web.fetchPage";

export type Citation = {
  branch?: string;
  codeChunkId?: string;
  commitSha?: string;
  excerpt: string;
  endLine?: number;
  messageId?: string;
  path?: string;
  repoName?: string;
  similarity: number;
  sourceType?: "chat_message" | "code_chunk";
  startLine?: number;
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
  repositories: WorkspaceRepository[];
  role: WorkspaceRole;
  slug: string;
};

export type RepositorySyncStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "partial";

export type WorkspaceRepository = {
  branch: string;
  chunkCount: number;
  fileCount: number;
  githubOwner: string;
  githubRepo: string;
  hasToken: boolean;
  id: string;
  lastIndexedCommitSha: string | null;
  lastSync: {
    completedAt: string | null;
    error: string | null;
    id: string;
    processedFileCount: number;
    skippedFileCount: number;
    status: RepositorySyncStatus;
    triggerType: string;
  } | null;
  lastSyncedAt: string | null;
  repoUrl: string;
  syncHourly: boolean;
  syncStatus: RepositorySyncStatus;
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
  repositorySnippets: unknown[];
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
