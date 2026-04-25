import { compactWhitespace } from "@/lib/utils";

export function isAskCommand(text: string) {
  return compactWhitespace(text).toLowerCase().startsWith("/ask ");
}

export function extractAskQuery(text: string) {
  return compactWhitespace(text).slice(5).trim();
}

export function buildAnswerInstructions() {
  return [
    "You answer questions using only the supplied workspace chat context.",
    "Keep the answer concise, practical, and grounded in the retrieved chat snippets.",
    "If the context is insufficient, say that clearly instead of guessing.",
  ].join(" ");
}

export function buildAnswerInput(question: string, snippets: Array<{ body: string; createdAt: string; senderName: string; similarity: number }>) {
  const context = snippets
    .map((snippet, index) => {
      return [
        `Source ${index + 1}`,
        `Sender: ${snippet.senderName}`,
        `Created: ${snippet.createdAt}`,
        `Similarity: ${snippet.similarity.toFixed(4)}`,
        `Message: ${snippet.body}`,
      ].join("\n");
    })
    .join("\n\n");

  return [`Question:\n${question}`, `Retrieved context:\n${context}`].join("\n\n");
}
