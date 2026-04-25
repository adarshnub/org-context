import { estimateTokens } from "@/lib/context";
import { getAppConfig, getCohereConfig, getOpenAIConfig, hasOpenAIConfig } from "@/lib/env";
import type { ToolRequest } from "@/lib/tools/types";
import type { AnswerProvider, Citation } from "@/lib/types";

type RetrievedSnippet = {
  body: string;
  id: string;
  similarity: number;
};

type Usage = {
  inputTokens: number | null;
  outputTokens: number | null;
  source: "estimated" | "provider";
};

type ModelResult = {
  model: string;
  text: string;
  usage: Usage;
};

type CohereEmbedResponse = {
  embeddings?: {
    float?: number[][];
  };
};

type CohereChatResponse = {
  message?: {
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  };
  meta?: unknown;
  usage?: unknown;
};

type OpenAIResponsesResponse = {
  output_text?: string;
  usage?: unknown;
};

type ToolDescriptor = {
  description: string;
  inputSchema: string;
  name: string;
};

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPath(source: unknown, path: string[]) {
  let current = source;

  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return getNumber(current);
}

function estimateUsage(input: string, output: string): Usage {
  return {
    inputTokens: estimateTokens(input),
    outputTokens: estimateTokens(output),
    source: "estimated",
  };
}

function extractOpenAIUsage(payload: OpenAIResponsesResponse, fallbackInput: string, output: string): Usage {
  const inputTokens = readPath(payload.usage, ["input_tokens"]);
  const outputTokens = readPath(payload.usage, ["output_tokens"]);

  if (inputTokens !== null || outputTokens !== null) {
    return {
      inputTokens,
      outputTokens,
      source: "provider",
    };
  }

  return estimateUsage(fallbackInput, output);
}

function extractCohereUsage(payload: CohereChatResponse, fallbackInput: string, output: string): Usage {
  const candidates: Array<[number | null, number | null]> = [
    [
      readPath(payload.usage, ["tokens", "input_tokens"]),
      readPath(payload.usage, ["tokens", "output_tokens"]),
    ],
    [
      readPath(payload.usage, ["billed_units", "input_tokens"]),
      readPath(payload.usage, ["billed_units", "output_tokens"]),
    ],
    [
      readPath(payload.meta, ["tokens", "input_tokens"]),
      readPath(payload.meta, ["tokens", "output_tokens"]),
    ],
    [
      readPath(payload.meta, ["billed_units", "input_tokens"]),
      readPath(payload.meta, ["billed_units", "output_tokens"]),
    ],
  ];

  for (const [inputTokens, outputTokens] of candidates) {
    if (inputTokens !== null || outputTokens !== null) {
      return {
        inputTokens,
        outputTokens,
        source: "provider",
      };
    }
  }

  return estimateUsage(fallbackInput, output);
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Tool planning response did not contain JSON.");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

function normalizeToolRequests(text: string): ToolRequest[] {
  const parsed = extractJsonObject(text);

  if (!parsed || typeof parsed !== "object" || !("toolCalls" in parsed)) {
    return [];
  }

  const calls = (parsed as { toolCalls?: unknown }).toolCalls;

  if (!Array.isArray(calls)) {
    return [];
  }

  const requests: ToolRequest[] = [];

  for (const call of calls) {
    if (!call || typeof call !== "object") {
      continue;
    }

    const record = call as Record<string, unknown>;

    if (typeof record.tool !== "string") {
      continue;
    }

    requests.push({
      input: record.input ?? {},
      reason: typeof record.reason === "string" ? record.reason : undefined,
      tool: record.tool,
    });
  }

  return requests.slice(0, 3);
}

export async function createEmbedding(text: string, inputType: "search_document" | "search_query") {
  const { apiKey, embedModel } = getCohereConfig();

  const response = await fetch("https://api.cohere.com/v2/embed", {
    body: JSON.stringify({
      embedding_types: ["float"],
      input_type: inputType,
      inputs: [
        {
          content: [{ text, type: "text" }],
        },
      ],
      model: embedModel,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Cohere embed request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as CohereEmbedResponse;
  const embedding = payload.embeddings?.float?.[0];

  if (!embedding) {
    throw new Error("Cohere embed response did not contain a float embedding.");
  }

  return embedding;
}

export async function planToolRequests({
  input,
  provider,
  systemPrompt,
  tools,
}: {
  input: string;
  provider: AnswerProvider;
  systemPrompt: string;
  tools: ToolDescriptor[];
}) {
  if (tools.length === 0) {
    return {
      requests: [],
      result: null,
    };
  }

  const toolPrompt = [
    systemPrompt,
    "Decide whether any enabled tool is needed before answering.",
    "Return only JSON in this exact shape: {\"toolCalls\":[{\"tool\":\"tool.name\",\"input\":{},\"reason\":\"short reason\"}]}",
    "Use at most three tool calls. Return an empty toolCalls array when tools are not needed.",
    `Enabled tools:\n${JSON.stringify(tools, null, 2)}`,
  ].join("\n\n");
  const result = await callModel({
    input,
    provider,
    systemPrompt: toolPrompt,
  });

  return {
    requests: normalizeToolRequests(result.text),
    result,
  };
}

export async function generateAnswer({
  input,
  provider,
  systemPrompt,
}: {
  input: string;
  provider: AnswerProvider;
  systemPrompt: string;
}) {
  if (provider === "openai" && !hasOpenAIConfig()) {
    throw new Error("OpenAI provider selected but OPENAI_API_KEY is missing.");
  }

  return callModel({
    input,
    provider,
    systemPrompt,
  });
}

export function buildCitations(snippets: RetrievedSnippet[]): Citation[] {
  return snippets.slice(0, 3).map((snippet) => ({
    excerpt: snippet.body.slice(0, 180),
    messageId: snippet.id,
    similarity: snippet.similarity,
  }));
}

export function combineUsage(usages: Usage[]) {
  const knownInput = usages.map((usage) => usage.inputTokens).filter((value): value is number => value !== null);
  const knownOutput = usages.map((usage) => usage.outputTokens).filter((value): value is number => value !== null);

  return {
    inputTokens: knownInput.length > 0 ? knownInput.reduce((sum, value) => sum + value, 0) : null,
    outputTokens: knownOutput.length > 0 ? knownOutput.reduce((sum, value) => sum + value, 0) : null,
    source: usages.every((usage) => usage.source === "provider") ? "provider" : "estimated",
  } satisfies Usage;
}

export function getAskTopK() {
  return getAppConfig().defaultAskTopK;
}

async function callModel({
  input,
  provider,
  systemPrompt,
}: {
  input: string;
  provider: AnswerProvider;
  systemPrompt: string;
}): Promise<ModelResult> {
  if (provider === "openai") {
    return generateOpenAIText(systemPrompt, input);
  }

  return generateCohereText(systemPrompt, input);
}

async function generateCohereText(systemPrompt: string, input: string) {
  const { apiKey, chatModel } = getCohereConfig();

  const response = await fetch("https://api.cohere.com/v2/chat", {
    body: JSON.stringify({
      messages: [
        {
          content: systemPrompt,
          role: "system",
        },
        {
          content: input,
          role: "user",
        },
      ],
      model: chatModel,
      stream: false,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Cohere chat request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as CohereChatResponse;
  const text = payload.message?.content?.map((item) => item.text ?? "").join("").trim();

  if (!text) {
    throw new Error("Cohere chat response did not contain text output.");
  }

  return {
    model: chatModel,
    text,
    usage: extractCohereUsage(payload, `${systemPrompt}\n\n${input}`, text),
  } satisfies ModelResult;
}

async function generateOpenAIText(systemPrompt: string, input: string) {
  const { chatModel, apiKey } = getOpenAIConfig();

  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input,
      instructions: systemPrompt,
      model: chatModel,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`OpenAI response request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as OpenAIResponsesResponse;

  if (!payload.output_text) {
    throw new Error("OpenAI response did not contain output_text.");
  }

  const text = payload.output_text.trim();

  return {
    model: chatModel,
    text,
    usage: extractOpenAIUsage(payload, `${systemPrompt}\n\n${input}`, text),
  } satisfies ModelResult;
}
