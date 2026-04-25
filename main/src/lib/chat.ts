import { compactWhitespace } from "@/lib/utils";

export function isAskCommand(text: string) {
  return compactWhitespace(text).toLowerCase().startsWith("/ask ");
}

export function extractAskQuery(text: string) {
  return compactWhitespace(text).slice(5).trim();
}

export function buildAnswerInstructions() {
  return [
    "You answer questions using only the supplied workspace chat context, indexed code context, and tool results.",
    "Use recent chat for conversational continuity, retrieved chat memory for team discussion, and indexed code for implementation facts.",
    "When chat and code disagree, explain the difference and treat code as the stronger signal for current implementation state.",
    "Keep the answer concise, practical, and grounded in the supplied sources.",
    "If the context is insufficient, say that clearly instead of guessing.",
    "When tool results are present, incorporate them without exposing internal planning details.",
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
