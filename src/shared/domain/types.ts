export type CopilotAction = "edit" | "askQuestion";

export type OutputApplyMode = "replace" | "insert";

export type PromptHistoryStatus = "succeeded" | "failed" | "cancelled";

export type PromptHistoryRetentionPolicy = "forever" | "sevenDays" | "thirtyDays" | "ninetyDays";

export interface SlashCommandSetting {
  id: string;
  command: string;
  prompt: string;
}

export interface AppSettings {
  schemaVersion: number;
  codexModel: string;
  codexReasoningEffort: string;
  openPanelShortcut: string;
  replaceShortcut: string;
  insertShortcut: string;
  slashCommands: SlashCommandSetting[];
}

export interface PromptHistoryEntry {
  id: string;
  command: string;
  action: CopilotAction;
  usedSelectionContext: boolean;
  status: PromptHistoryStatus;
  detail: string;
  responseText: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  createdAt: string;
}

export interface PromptHistoryState {
  schemaVersion: number;
  retentionPolicy: PromptHistoryRetentionPolicy;
  entries: PromptHistoryEntry[];
  commands: string[];
}

export interface PromptHistoryTokenSummary {
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  inputTokenRunCount: number;
  outputTokenRunCount: number;
  tokenizedRunCount: number;
}

export interface TokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}
