import { normalizedSlashCommandName } from "./settings";
import type { SlashCommandSetting } from "./types";

export interface SlashAutocompleteContext {
  leadingWhitespace: string;
  query: string;
}

export function slashAutocompleteContext(text: string): SlashAutocompleteContext | null {
  const leadingWhitespaceMatch = text.match(/^\s*/);
  const leadingWhitespace = leadingWhitespaceMatch?.[0] ?? "";

  if (leadingWhitespace.length >= text.length) {
    return null;
  }

  if (text[leadingWhitespace.length] !== "/") {
    return null;
  }

  const tail = text.slice(leadingWhitespace.length + 1);
  if (/\s/.test(tail)) {
    return null;
  }

  return {
    leadingWhitespace,
    query: tail,
  };
}

export function resolveSlashCommandPrompt(input: string, commands: SlashCommandSetting[]): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return trimmedInput;
  }

  if (!trimmedInput.startsWith("/")) {
    return trimmedInput;
  }

  const separatorIndex = trimmedInput.search(/\s/);
  if (separatorIndex < 0) {
    const token = trimmedInput.slice(1);
    return expandedPromptIfCommandMatches(token, "", commands, trimmedInput);
  }

  const token = trimmedInput.slice(1, separatorIndex);
  const remainder = trimmedInput.slice(separatorIndex).trim();
  return expandedPromptIfCommandMatches(token, remainder, commands, trimmedInput);
}

function expandedPromptIfCommandMatches(
  token: string,
  remainder: string,
  commands: SlashCommandSetting[],
  fallback: string,
): string {
  const normalizedToken = normalizedSlashCommandName(token);
  if (!normalizedToken) {
    return fallback;
  }

  const matched = commands.find((command) => command.command === normalizedToken);
  if (!matched) {
    return fallback;
  }

  const prompt = matched.prompt.trim();
  if (!prompt) {
    return fallback;
  }

  if (prompt.includes("{{input}}")) {
    return prompt.replaceAll("{{input}}", remainder);
  }

  if (!remainder) {
    return prompt;
  }

  return `${prompt}\n\n${remainder}`;
}
