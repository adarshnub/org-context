import { compactWhitespace } from "@/lib/utils";

export function isAskCommand(text: string) {
  return compactWhitespace(text).toLowerCase().startsWith("/ask ");
}

export function extractAskQuery(text: string) {
  return compactWhitespace(text).slice(5).trim();
}

export function buildAnswerInstructions() {
  return [
    "You answer questions using only the supplied workspace chat context, repository/project code context, and tool results.",
    "Treat repository/project code context as the strongest signal for current implementation facts.",
    "When discussing code findings, refer to the repository or project by name when the source provides it.",
    "Treat recent chat and retrieved chat memory as team claims, decisions, status updates, and discussion history.",
    "Always keep repository/project evidence and chat evidence conceptually separate: do not silently merge them into one conclusion.",
    "When answering whether a feature exists or is implemented, first give the repository-backed answer, then mention any relevant chat claim or discussion if chat context says something different or adds status context.",
    "When chat and repository/project evidence disagree, explicitly call out the discrepancy. For example: \"In <repo/project name>, I do not see this implemented, but chat history says <person> claimed it was implemented.\"",
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
