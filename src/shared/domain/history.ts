import type {
  PromptHistoryEntry,
  PromptHistoryRetentionPolicy,
  PromptHistoryState,
  PromptHistoryTokenSummary,
  TokenUsage,
} from "./types";

export const defaultHistoryState: PromptHistoryState = {
  schemaVersion: 1,
  retentionPolicy: "forever",
  entries: [],
  commands: [],
};

export const retentionMaxAgeByPolicy: Record<
  Exclude<PromptHistoryRetentionPolicy, "forever">,
  number
> = {
  sevenDays: 7 * 24 * 60 * 60,
  thirtyDays: 30 * 24 * 60 * 60,
  ninetyDays: 90 * 24 * 60 * 60,
};

export function normalizeResponseText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= 8_000) {
    return trimmed;
  }

  return `${trimmed.slice(0, 7_997)}...`;
}

export function normalizeTokenCount(value: number | null | undefined): number | null {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

export function tokenSummary(entries: PromptHistoryEntry[]): PromptHistoryTokenSummary {
  let totalTokens = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let inputTokenRunCount = 0;
  let outputTokenRunCount = 0;
  let tokenizedRunCount = 0;

  for (const entry of entries) {
    const input = Math.max(0, entry.inputTokens ?? 0);
    const output = Math.max(0, entry.outputTokens ?? 0);
    const recordedTotal = Math.max(0, entry.totalTokens ?? 0);
    const fallbackTotal = input + output;
    const effectiveTotal = recordedTotal > 0 ? recordedTotal : fallbackTotal;

    if (input > 0) {
      totalInputTokens += input;
      inputTokenRunCount += 1;
    }

    if (output > 0) {
      totalOutputTokens += output;
      outputTokenRunCount += 1;
    }

    if (effectiveTotal > 0) {
      totalTokens += effectiveTotal;
      tokenizedRunCount += 1;
    }
  }

  return {
    totalTokens,
    totalInputTokens,
    totalOutputTokens,
    inputTokenRunCount,
    outputTokenRunCount,
    tokenizedRunCount,
  };
}

export function applyRetention(
  entries: PromptHistoryEntry[],
  policy: PromptHistoryRetentionPolicy,
): PromptHistoryEntry[] {
  if (policy === "forever") {
    return entries;
  }

  const ageLimit = retentionMaxAgeByPolicy[policy];
  const cutoff = Date.now() - ageLimit * 1000;

  return entries.filter((entry) => new Date(entry.createdAt).getTime() >= cutoff);
}

export function createHistoryEntry(params: {
  command: string;
  action: PromptHistoryEntry["action"];
  usedSelectionContext: boolean;
  status: PromptHistoryEntry["status"];
  detail: string;
  responseText: string | null;
  tokenUsage: TokenUsage | null;
  createdAt?: string;
}): PromptHistoryEntry {
  const normalizedInput = normalizeTokenCount(params.tokenUsage?.inputTokens);
  const normalizedOutput = normalizeTokenCount(params.tokenUsage?.outputTokens);

  return {
    id: crypto.randomUUID(),
    command: params.command.trim(),
    action: params.action,
    usedSelectionContext: params.usedSelectionContext,
    status: params.status,
    detail: params.detail.trim() || defaultDetailForStatus(params.status),
    responseText: normalizeResponseText(params.responseText),
    inputTokens: normalizedInput,
    outputTokens: normalizedOutput,
    totalTokens:
      normalizeTokenCount(params.tokenUsage?.totalTokens) ??
      normalizeTokenCount((normalizedInput ?? 0) + (normalizedOutput ?? 0)),
    createdAt: params.createdAt ?? new Date().toISOString(),
  };
}

function defaultDetailForStatus(status: PromptHistoryEntry["status"]): string {
  if (status === "succeeded") return "Succeeded";
  if (status === "cancelled") return "Cancelled";
  return "Failed";
}
