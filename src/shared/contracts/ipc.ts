import { z } from "zod";

export const appSettingsSchema = z.object({
  schemaVersion: z.number().int().positive(),
  codexModel: z.string().min(1),
  codexReasoningEffort: z.string().min(1),
  openPanelShortcut: z.string().min(1),
  replaceShortcut: z.string().min(1),
  insertShortcut: z.string().min(1),
  slashCommands: z.array(
    z.object({
      id: z.string().uuid(),
      command: z.string().min(1),
      prompt: z.string().min(1),
    }),
  ),
});

export const promptHistoryRetentionPolicySchema = z.enum([
  "forever",
  "sevenDays",
  "thirtyDays",
  "ninetyDays",
]);

export const promptHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  command: z.string().min(1),
  action: z.enum(["edit", "askQuestion"]),
  usedSelectionContext: z.boolean(),
  status: z.enum(["succeeded", "failed", "cancelled"]),
  detail: z.string().min(1),
  responseText: z.string().nullable(),
  inputTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
  totalTokens: z.number().int().nullable(),
  createdAt: z.string().datetime(),
});

export const tokenUsageSchema = z.object({
  inputTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
  totalTokens: z.number().int().nullable(),
});

export const promptHistoryTokenSummarySchema = z.object({
  totalTokens: z.number().int().nonnegative(),
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  inputTokenRunCount: z.number().int().nonnegative(),
  outputTokenRunCount: z.number().int().nonnegative(),
  tokenizedRunCount: z.number().int().nonnegative(),
});

export const codexMonthlyUsageEntrySchema = z.object({
  month: z.string().min(1),
  inputTokens: z.number().nonnegative(),
  cachedInputTokens: z.number().nonnegative(),
  outputTokens: z.number().nonnegative(),
  reasoningOutputTokens: z.number().nonnegative(),
  totalTokens: z.number().nonnegative(),
  costUSD: z.number().nonnegative(),
});

export const codexMonthlyUsageSnapshotSchema = z.object({
  source: z.literal("ccusage"),
  months: z.array(codexMonthlyUsageEntrySchema),
  fetchedAt: z.string().datetime(),
  error: z.string().nullable(),
});

const overlaySelectionBoundsSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite(),
  height: z.number().finite(),
});

export const overlayContextSchema = z.object({
  selectedText: z.string().nullable(),
  hasEditableSelection: z.boolean(),
  accessibilityTrusted: z.boolean(),
  selectionBounds: overlaySelectionBoundsSchema.nullable(),
});

export const runPromptRequestSchema = z.object({
  command: z.string().min(1),
  action: z.enum(["edit", "askQuestion"]),
  selectedText: z.string().nullable(),
});

export const runPromptResultSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int(),
  tokenUsage: tokenUsageSchema.nullable(),
});

export const runtimeStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("started") }),
  z.object({ type: z.literal("delta"), delta: z.string() }),
  z.object({ type: z.literal("completed"), result: runPromptResultSchema }),
  z.object({ type: z.literal("failed"), message: z.string() }),
  z.object({ type: z.literal("cancelled") }),
]);

export type RuntimeStreamEvent = z.infer<typeof runtimeStreamEventSchema>;

export const ipcChannels = {
  settingsGet: "settings:get",
  settingsUpdate: "settings:update",
  settingsReset: "settings:reset",
  historyGet: "history:get",
  historyDeleteEntry: "history:delete-entry",
  historyClear: "history:clear",
  historySetRetention: "history:set-retention",
  usageGetMonthly: "usage:get-monthly",
  overlayCaptureContext: "overlay:capture-context",
  overlayContextReady: "overlay:context-ready",
  overlayResize: "overlay:resize",
  overlayClose: "overlay:close",
  overlayApplyOutput: "overlay:apply-output",
  dashboardOpen: "dashboard:open",
  systemOpenAccessibilitySettings: "system:open-accessibility-settings",
  runtimeStart: "runtime:start",
  runtimeCancel: "runtime:cancel",
  runtimeEvent: "runtime:event",
  runtimeState: "runtime:state",
  settingsChanged: "event:settings-changed",
  historyChanged: "event:history-changed",
} as const;

export interface EchoRendererApi {
  settings: {
    get: () => Promise<z.infer<typeof appSettingsSchema>>;
    update: (
      partial: Partial<z.infer<typeof appSettingsSchema>>,
    ) => Promise<z.infer<typeof appSettingsSchema>>;
    reset: () => Promise<z.infer<typeof appSettingsSchema>>;
    onChanged: (listener: (value: z.infer<typeof appSettingsSchema>) => void) => () => void;
  };
  history: {
    get: () => Promise<{
      entries: z.infer<typeof promptHistoryEntrySchema>[];
      commands: string[];
      retentionPolicy: z.infer<typeof promptHistoryRetentionPolicySchema>;
      tokenSummary: z.infer<typeof promptHistoryTokenSummarySchema>;
    }>;
    deleteEntry: (id: string) => Promise<void>;
    clear: () => Promise<void>;
    setRetentionPolicy: (
      retentionPolicy: z.infer<typeof promptHistoryRetentionPolicySchema>,
    ) => Promise<z.infer<typeof promptHistoryRetentionPolicySchema>>;
    onChanged: (
      listener: (value: {
        entries: z.infer<typeof promptHistoryEntrySchema>[];
        commands: string[];
        retentionPolicy: z.infer<typeof promptHistoryRetentionPolicySchema>;
        tokenSummary: z.infer<typeof promptHistoryTokenSummarySchema>;
      }) => void,
    ) => () => void;
  };
  usage: {
    getMonthly: () => Promise<z.infer<typeof codexMonthlyUsageSnapshotSchema>>;
  };
  overlay: {
    captureContext: () => Promise<z.infer<typeof overlayContextSchema>>;
    resize: (height: number) => Promise<void>;
    applyOutput: (payload: { text: string; mode: "replace" | "insert" }) => Promise<boolean>;
    close: () => Promise<void>;
    openDashboard: () => Promise<void>;
    onContextReady: (
      listener: (context: z.infer<typeof overlayContextSchema>) => void,
    ) => () => void;
  };
  runtime: {
    start: (payload: z.infer<typeof runPromptRequestSchema>) => Promise<void>;
    cancel: () => Promise<void>;
    isRunning: () => Promise<boolean>;
    onEvent: (listener: (event: RuntimeStreamEvent) => void) => () => void;
  };
  system: {
    openAccessibilitySettings: () => Promise<boolean>;
  };
}

declare global {
  interface Window {
    echo: EchoRendererApi;
  }
}
