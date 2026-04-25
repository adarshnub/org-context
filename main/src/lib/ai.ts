import { getAppConfig, getCohereConfig, getOpenAIConfig, hasOpenAIConfig } from "@/lib/env";
import type { AnswerProvider, Citation } from "@/lib/types";

type RetrievedSnippet = {
  body: string;
  createdAt: string;
  id: string;
  senderName: string;
  similarity: number;
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
};

type OpenAIResponsesResponse = {
  output_text?: string;
};

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

export async function generateAnswer({
  provider,
  question,
  snippets,
}: {
  provider: AnswerProvider;
  question: string;
  snippets: RetrievedSnippet[];
}) {
  if (provider === "openai") {
    if (!hasOpenAIConfig()) {
      throw new Error("OpenAI provider selected but OPENAI_API_KEY is missing.");
    }

    return generateOpenAIAnswer(question, snippets);
  }

  return generateCohereAnswer(question, snippets);
}

export function buildCitations(snippets: RetrievedSnippet[]): Citation[] {
  return snippets.slice(0, 3).map((snippet) => ({
    excerpt: snippet.body.slice(0, 180),
    messageId: snippet.id,
    similarity: snippet.similarity,
  }));
}

export function getAskTopK() {
  return getAppConfig().defaultAskTopK;
}

async function generateCohereAnswer(question: string, snippets: RetrievedSnippet[]) {
  const { apiKey, chatModel } = getCohereConfig();
  const { buildAnswerInput, buildAnswerInstructions } = await import("@/lib/chat");

  const response = await fetch("https://api.cohere.com/v2/chat", {
    body: JSON.stringify({
      messages: [
        {
          content: buildAnswerInstructions(),
          role: "system",
        },
        {
          content: buildAnswerInput(question, snippets),
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

  return text;
}

async function generateOpenAIAnswer(question: string, snippets: RetrievedSnippet[]) {
  const { chatModel, apiKey } = getOpenAIConfig();
  const { buildAnswerInput, buildAnswerInstructions } = await import("@/lib/chat");

  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: buildAnswerInput(question, snippets),
      instructions: buildAnswerInstructions(),
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

  return payload.output_text.trim();
}
