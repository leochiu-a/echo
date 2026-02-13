import type { CopilotAction } from "./types";

export function composePrompt(
  command: string,
  selectedText: string | null,
  action: CopilotAction,
): string {
  const trimmedCommand = command.trim();
  const normalizedSelection = selectedText?.trim();

  if (!normalizedSelection) {
    return trimmedCommand;
  }

  if (action === "edit") {
    return [
      "User instruction:",
      trimmedCommand,
      "",
      "Selected text:",
      "<<<",
      normalizedSelection,
      ">>>",
      "",
      "Apply the instruction to the selected text above.",
      "Preserve paragraph and line-break structure when it is present.",
      "If line breaks are ambiguous, format into readable sentence/paragraph breaks.",
      "Return only the final result text.",
    ].join("\n");
  }

  return [
    "Question:",
    trimmedCommand,
    "",
    "Context:",
    "<<<",
    normalizedSelection,
    ">>>",
    "",
    "Use the context above to answer the question.",
    "Keep the response readable with clear paragraph/line breaks.",
    "If context is insufficient, say so briefly.",
  ].join("\n");
}

export function normalizeOutput(value: string): string {
  if (!value) {
    return "";
  }

  const ansiPattern = /\u001B\[[0-9;?]*[ -/]*[@-~]/g;
  return value.replace(ansiPattern, "").trim();
}
