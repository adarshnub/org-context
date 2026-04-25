export type AnswerProvider = "cohere" | "openai";
export type WorkspaceRole = "owner" | "member";
export type MessageType = "user" | "command" | "assistant" | "system";
export type EmbeddingStatus = "pending" | "completed" | "failed";

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
  id: string;
  members: WorkspaceMember[];
  messages: ChatMessage[];
  name: string;
  role: WorkspaceRole;
  slug: string;
};
