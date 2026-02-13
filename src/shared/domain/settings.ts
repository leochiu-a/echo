import type { AppSettings, SlashCommandSetting } from "./types";

export const supportedCodexModels = ["gpt-5.2", "gpt-5.3-codex", "gpt-5.2-codex"] as const;
export const supportedReasoningEfforts = ["low", "medium", "high", "xhigh"] as const;

export const defaultSettings: AppSettings = {
  schemaVersion: 1,
  codexModel: "gpt-5.3-codex",
  codexReasoningEffort: "medium",
  openPanelShortcut: "Command+K",
  replaceShortcut: "Command+Enter",
  insertShortcut: "Command+Shift+Enter",
  slashCommands: [],
};

export function canonicalModel(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return supportedCodexModels.find((item) => item.toLowerCase() === normalized) ?? null;
}

export function canonicalReasoningEffort(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return supportedReasoningEfforts.find((item) => item.toLowerCase() === normalized) ?? null;
}

export function normalizedSlashCommandName(value: string): string | null {
  let normalized = value.trim().toLowerCase();
  while (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  if (!normalized) {
    return null;
  }
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function availableSlashCommands(commands: SlashCommandSetting[]): SlashCommandSetting[] {
  const seen = new Set<string>();
  const resolved: SlashCommandSetting[] = [];

  for (const item of commands) {
    const normalizedCommand = normalizedSlashCommandName(item.command);
    const trimmedPrompt = item.prompt.trim();
    if (!normalizedCommand || !trimmedPrompt || seen.has(normalizedCommand)) {
      continue;
    }

    seen.add(normalizedCommand);
    resolved.push({
      id: item.id,
      command: normalizedCommand,
      prompt: trimmedPrompt,
    });
  }

  return resolved;
}

export function normalizeSettings(input: Partial<AppSettings>): AppSettings {
  const model = canonicalModel(input.codexModel ?? "") ?? defaultSettings.codexModel;
  const effort =
    canonicalReasoningEffort(input.codexReasoningEffort ?? "") ??
    defaultSettings.codexReasoningEffort;

  return {
    schemaVersion: defaultSettings.schemaVersion,
    codexModel: model,
    codexReasoningEffort: effort,
    openPanelShortcut: input.openPanelShortcut?.trim() || defaultSettings.openPanelShortcut,
    replaceShortcut: input.replaceShortcut?.trim() || defaultSettings.replaceShortcut,
    insertShortcut: input.insertShortcut?.trim() || defaultSettings.insertShortcut,
    slashCommands: availableSlashCommands(input.slashCommands ?? []),
  };
}
