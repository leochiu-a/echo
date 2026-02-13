import type {
  AppSettings,
  PromptHistoryEntry,
  PromptHistoryRetentionPolicy,
  PromptHistoryStatus,
} from "@shared/domain/types";
import type { LucideIcon } from "lucide-react";
import { Command as CommandIcon, History, House, SlidersHorizontal } from "lucide-react";
export { cn } from "@renderer/shared/cn";

export const MODELS = ["gpt-5.2", "gpt-5.3-codex", "gpt-5.2-codex"];
export const EFFORTS = ["low", "medium", "high", "xhigh"];

export interface HistorySnapshot {
  entries: PromptHistoryEntry[];
  commands: string[];
  retentionPolicy: PromptHistoryRetentionPolicy;
  tokenSummary: {
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    inputTokenRunCount: number;
    outputTokenRunCount: number;
    tokenizedRunCount: number;
  };
}

export interface CodexMonthlyUsageEntry {
  month: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  costUSD: number;
}

export interface CodexMonthlyUsageSnapshot {
  source: "ccusage";
  months: CodexMonthlyUsageEntry[];
  fetchedAt: string;
  error: string | null;
}

export type TabKey = "home" | "history" | "commands" | "settings";

export interface SettingsDraft {
  codexModel: string;
  codexReasoningEffort: string;
  openPanelShortcut: string;
  replaceShortcut: string;
  insertShortcut: string;
}

export interface TabItem {
  key: TabKey;
  label: string;
  pageTitle: string;
  icon: LucideIcon;
  description: string;
}

export const TAB_ITEMS: TabItem[] = [
  {
    key: "home",
    label: "Home",
    pageTitle: "Home",
    icon: House,
    description: "Live token usage summary from CCusage.",
  },
  {
    key: "history",
    label: "History",
    pageTitle: "History records",
    icon: History,
    description: "Recent prompt runs, with status and timestamps.",
  },
  {
    key: "commands",
    label: "Commands",
    pageTitle: "Command dashboard view",
    icon: CommandIcon,
    description: "Configure slash commands and prompt templates for inline input autocomplete.",
  },
  {
    key: "settings",
    label: "Settings",
    pageTitle: "Settings",
    icon: SlidersHorizontal,
    description:
      "Configure Codex App Server streaming model, reasoning effort, and shortcuts for input, replace, and insert actions.",
  },
];

export const RETENTION_LABEL: Record<PromptHistoryRetentionPolicy, string> = {
  forever: "Forever",
  sevenDays: "7 days",
  thirtyDays: "30 days",
  ninetyDays: "90 days",
};

export const dashboardInputClass =
  "w-full rounded-2xl border border-black/10 bg-white/75 px-3.5 py-2.5 text-sm text-[#21333d] outline-none transition focus:border-[#489eac] focus:outline focus:outline-2 focus:outline-[#3d99a84d] focus:outline-offset-1";

export const dashboardSelectClass =
  "rounded-2xl border border-black/10 bg-white/75 px-3.5 py-2.5 text-sm font-semibold text-[#21333d] outline-none transition focus:border-[#489eac] focus:outline focus:outline-2 focus:outline-[#3d99a84d] focus:outline-offset-1";

export const dashboardPrimaryButtonClass =
  "rounded-full border border-transparent bg-[#0f8d9f] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45";

export const dashboardSecondaryButtonClass =
  "rounded-full border border-[#a9c1ca] bg-white/80 px-3.5 py-2 text-[13px] font-semibold text-[#32515f] transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45";

export function formatTimestamp(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }

  return parsed.toLocaleString();
}

export function formatAction(action: PromptHistoryEntry["action"]): string {
  return action === "edit" ? "Edit Selection" : "Ask Question";
}

export function statusLabel(status: PromptHistoryStatus): string {
  if (status === "succeeded") {
    return "Succeeded";
  }
  if (status === "cancelled") {
    return "Cancelled";
  }
  return "Failed";
}

export function statusDotClass(status: PromptHistoryStatus): string {
  if (status === "succeeded") {
    return "bg-[#0a9f62]";
  }
  if (status === "cancelled") {
    return "bg-[#eb9b3e]";
  }
  return "bg-[#d45149]";
}

export function tokenizeShortcut(value: string): string[] {
  const tokens = value
    .split("+")
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return ["none"];
  }

  return tokens.map((token) => {
    const normalized = token.toLowerCase();
    if (normalized === "command") return "cmd";
    if (normalized === "control") return "ctrl";
    if (normalized === "option") return "opt";
    if (normalized === "shift") return "shift";
    if (normalized === "enter") return "enter";
    return token.length > 12 ? `${token.slice(0, 12)}...` : token;
  });
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function hasPendingSettingsValue(
  settings: AppSettings | null,
  draft: SettingsDraft,
): boolean {
  if (!settings) {
    return false;
  }

  return (
    settings.codexModel !== draft.codexModel ||
    settings.codexReasoningEffort !== draft.codexReasoningEffort ||
    settings.openPanelShortcut !== draft.openPanelShortcut ||
    settings.replaceShortcut !== draft.replaceShortcut ||
    settings.insertShortcut !== draft.insertShortcut
  );
}
