function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!anonKey) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return {
    url,
    anonKey,
  };
}

export function getServiceRoleKey() {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getAppConfig() {
  const rawTopK = process.env.DEFAULT_ASK_TOP_K ?? "8";
  const topK = Number.parseInt(rawTopK, 10);
  const rawRecentCount = process.env.ASK_RECENT_MESSAGE_COUNT ?? "6";
  const recentMessageCount = Number.parseInt(rawRecentCount, 10);
  const rawContextBudget = process.env.ASK_CONTEXT_TOKEN_BUDGET ?? "6000";
  const contextTokenBudget = Number.parseInt(rawContextBudget, 10);

  if (Number.isNaN(topK) || topK < 1) {
    throw new Error("DEFAULT_ASK_TOP_K must be a positive integer.");
  }

  if (Number.isNaN(recentMessageCount) || recentMessageCount < 0) {
    throw new Error("ASK_RECENT_MESSAGE_COUNT must be zero or a positive integer.");
  }

  if (Number.isNaN(contextTokenBudget) || contextTokenBudget < 1000) {
    throw new Error("ASK_CONTEXT_TOKEN_BUDGET must be at least 1000.");
  }

  return {
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
    contextTokenBudget,
    defaultAskTopK: topK,
    recentMessageCount,
  };
}

export function getCohereConfig() {
  return {
    apiKey: requireEnv("COHERE_API_KEY"),
    embedModel: process.env.COHERE_EMBED_MODEL ?? "embed-v4.0",
    chatModel: "command-a-03-2025",
  };
}

export function getOpenAIConfig() {
  return {
    apiKey: requireEnv("OPENAI_API_KEY"),
    chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-5-mini",
  };
}

export function hasOpenAIConfig() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function isDebugEnabled() {
  return process.env.ORG_CONTEXT_DEBUG !== "false";
}

export function isContextDebugPageEnabled() {
  return process.env.ORG_CONTEXT_DEBUG_PAGE === "true";
}
