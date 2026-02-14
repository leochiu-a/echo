import type { AppSettings } from "@shared/domain/types";
import type {
  CodexMonthlyUsageSnapshot,
  HistorySnapshot,
  SettingsDraft,
} from "../dashboard-shared";

export const sampleHistorySnapshot: HistorySnapshot = {
  entries: [
    {
      id: "h1",
      command: "/summary first-principles notes",
      action: "edit",
      usedSelectionContext: true,
      status: "succeeded",
      detail: "Generated 420 chars.",
      responseText:
        "First-principles thinking breaks a problem into core truths and rebuilds a solution from fundamentals.",
      inputTokens: 580,
      outputTokens: 240,
      totalTokens: 820,
      createdAt: "2026-02-12T09:30:00.000Z",
    },
    {
      id: "h2",
      command: "turn this into meeting notes",
      action: "askQuestion",
      usedSelectionContext: false,
      status: "cancelled",
      detail: "Execution stopped.",
      responseText: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      createdAt: "2026-02-12T11:05:00.000Z",
    },
  ],
  commands: [
    "/summary first-principles notes",
    "turn this into meeting notes",
    "/reply thanks, will follow up tomorrow",
  ],
  retentionPolicy: "thirtyDays",
  tokenSummary: {
    totalTokens: 21420,
    totalInputTokens: 14300,
    totalOutputTokens: 7120,
    inputTokenRunCount: 24,
    outputTokenRunCount: 22,
    tokenizedRunCount: 24,
  },
};

export const sampleMonthlyUsage: CodexMonthlyUsageSnapshot = {
  source: "ccusage",
  fetchedAt: "2026-02-12T11:20:00.000Z",
  error: null,
  months: [
    {
      month: "2026-02",
      inputTokens: 8200,
      cachedInputTokens: 1200,
      outputTokens: 3950,
      reasoningOutputTokens: 680,
      totalTokens: 12830,
      costUSD: 9.42,
    },
    {
      month: "2026-01",
      inputTokens: 14900,
      cachedInputTokens: 2100,
      outputTokens: 6440,
      reasoningOutputTokens: 920,
      totalTokens: 24360,
      costUSD: 17.88,
    },
  ],
};

export const sampleSettingsDraft: SettingsDraft = {
  codexModel: "gpt-5.3-codex",
  codexReasoningEffort: "medium",
  openPanelShortcut: "Command+K",
  replaceShortcut: "Command+Shift+R",
  insertShortcut: "Command+Shift+I",
};

export const sampleSlashCommands: AppSettings["slashCommands"] = [
  {
    id: "cmd-summary",
    command: "summary",
    prompt: "Summarize this in 5 concise bullets with action items.",
  },
  {
    id: "cmd-reply",
    command: "reply",
    prompt: "Draft a polite reply using the following context: {{input}}",
  },
];
