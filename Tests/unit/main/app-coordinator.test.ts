import { beforeEach, describe, expect, it, vi } from "vitest";
import { ipcChannels } from "@shared/contracts/ipc";
import type { AppSettings } from "@shared/domain/types";

const mocks = vi.hoisted(() => {
  const settingsSnapshot: AppSettings = {
    schemaVersion: 1,
    codexModel: "gpt-5.3-codex",
    codexReasoningEffort: "medium",
    openPanelShortcut: "Command+K",
    replaceShortcut: "Command+Enter",
    insertShortcut: "Command+Shift+Enter",
    slashCommands: [],
  };

  return {
    settingsSnapshot,
    historySnapshot: {
      entries: [],
      commands: [],
      retentionPolicy: "forever" as const,
      tokenSummary: {
        totalTokens: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        inputTokenRunCount: 0,
        outputTokenRunCount: 0,
        tokenizedRunCount: 0,
      },
    },
    slashCommands: [
      { id: "321e4567-e89b-42d3-a456-426614174000", command: "reply", prompt: "Draft {{input}}" },
    ],
    settingsListeners: [] as Array<(settings: AppSettings) => void>,
    historyListeners: [] as Array<(snapshot: unknown) => void>,
    windows: [] as Array<{
      isDestroyed: () => boolean;
      webContents: { send: ReturnType<typeof vi.fn> };
    }>,
    settingsUpdate: vi.fn(),
    settingsReset: vi.fn(),
    historyDeleteEntry: vi.fn(),
    historyClear: vi.fn(),
    historySetRetention: vi.fn((policy: string) => policy),
    historyRecordExecution: vi.fn(),
    usageGetMonthlySummary: vi.fn(async () => ({
      source: "ccusage" as const,
      months: [],
      fetchedAt: new Date().toISOString(),
      error: null,
    })),
    runtimePrewarm: vi.fn(async () => undefined),
    runtimeRun: vi.fn(async () => undefined),
    runtimeCancel: vi.fn(async () => undefined),
    runtimeDispose: vi.fn(async () => undefined),
    runtimeIsRunning: vi.fn(() => false),
    overlayToggleNearCursor: vi.fn(async () => undefined),
    overlayHide: vi.fn(),
    overlayResize: vi.fn(),
    overlayClose: vi.fn(),
    dashboardOpen: vi.fn(async () => undefined),
    dashboardClose: vi.fn(),
    hotkeyBind: vi.fn(),
    hotkeyRegister: vi.fn(),
    hotkeyDispose: vi.fn(),
    ensureShortcutLifecycle: vi.fn(),
    axCaptureSnapshot: vi.fn(async () => ({
      selectedText: "hello",
      hasEditableSelection: true,
      accessibilityTrusted: true,
    })),
    applyOutput: vi.fn(async () => true),
    resolveSlashCommandPrompt: vi.fn((command: string) => `resolved:${command}`),
    summarizeCLIErrorMessage: vi.fn((raw: string) => `summary:${raw}`),
    getAllWindows: vi.fn(() => []),
  };
});

vi.mock("electron", () => {
  class BrowserWindow {}
  return {
    BrowserWindow: Object.assign(BrowserWindow, {
      getAllWindows: mocks.getAllWindows,
    }),
  };
});

vi.mock("@shared/domain/slash", () => ({
  resolveSlashCommandPrompt: mocks.resolveSlashCommandPrompt,
}));

vi.mock("@shared/domain/error-summary", () => ({
  summarizeCLIErrorMessage: mocks.summarizeCLIErrorMessage,
}));

vi.mock("@main/services/settings/settings-service", () => ({
  SettingsService: class {
    get snapshot() {
      return mocks.settingsSnapshot;
    }
    update = mocks.settingsUpdate;
    reset = mocks.settingsReset;
    availableSlashCommands() {
      return mocks.slashCommands;
    }
    onChanged(listener: (settings: AppSettings) => void) {
      mocks.settingsListeners.push(listener);
      return () => {
        const index = mocks.settingsListeners.indexOf(listener);
        if (index >= 0) mocks.settingsListeners.splice(index, 1);
      };
    }
  },
}));

vi.mock("@main/services/history/history-service", () => ({
  HistoryService: class {
    get snapshot() {
      return mocks.historySnapshot;
    }
    deleteEntry = mocks.historyDeleteEntry;
    clear = mocks.historyClear;
    setRetentionPolicy = mocks.historySetRetention;
    recordExecution = mocks.historyRecordExecution;
    onChanged(listener: (snapshot: unknown) => void) {
      mocks.historyListeners.push(listener);
      return () => {
        const index = mocks.historyListeners.indexOf(listener);
        if (index >= 0) mocks.historyListeners.splice(index, 1);
      };
    }
  },
}));

vi.mock("@main/services/usage/usage-service", () => ({
  UsageService: class {
    getMonthlySummary = mocks.usageGetMonthlySummary;
  },
}));

vi.mock("@main/services/runtime/codex-runtime-service", () => ({
  CodexRuntimeService: class {
    prewarm = mocks.runtimePrewarm;
    run = mocks.runtimeRun;
    cancel = mocks.runtimeCancel;
    dispose = mocks.runtimeDispose;
    isRunning = mocks.runtimeIsRunning;
  },
}));

vi.mock("@main/services/window/window-state-service", () => ({
  WindowStateService: class {},
}));

vi.mock("@main/services/window/overlay-window-service", () => ({
  OverlayWindowService: class {
    toggleNearCursor = mocks.overlayToggleNearCursor;
    hide = mocks.overlayHide;
    resizeToContent = mocks.overlayResize;
    close = mocks.overlayClose;
  },
}));

vi.mock("@main/services/window/dashboard-window-service", () => ({
  DashboardWindowService: class {
    open = mocks.dashboardOpen;
    close = mocks.dashboardClose;
  },
}));

vi.mock("@main/services/hotkey/global-hotkey-service", () => ({
  GlobalHotkeyService: class {
    bind = mocks.hotkeyBind;
    register = mocks.hotkeyRegister;
    dispose = mocks.hotkeyDispose;
  },
  ensureShortcutLifecycle: mocks.ensureShortcutLifecycle,
}));

vi.mock("@main/platform/macos/ax-context-bridge", () => ({
  MacOSAXContextBridge: class {
    captureSnapshot = mocks.axCaptureSnapshot;
  },
}));

vi.mock("@main/platform/macos/apply-output-bridge", () => ({
  MacOSApplyOutputBridge: class {
    applyOutput = mocks.applyOutput;
  },
}));

import { AppCoordinator } from "@main/app/app-coordinator";

describe("AppCoordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settingsListeners.length = 0;
    mocks.historyListeners.length = 0;
    mocks.windows.length = 0;
    mocks.getAllWindows.mockImplementation(() => mocks.windows);
    mocks.hotkeyRegister.mockImplementation(() => undefined);
    mocks.settingsSnapshot.openPanelShortcut = "Command+K";
  });

  it("rejects runtime start when command is empty after trim", async () => {
    const coordinator = new AppCoordinator("/tmp/preload.js");
    const targetWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } };

    await expect(
      coordinator.startRuntimeRun(
        {
          command: "   ",
          action: "edit",
          selectedText: null,
        },
        targetWindow as never,
      ),
    ).rejects.toThrow("Command cannot be empty.");

    expect(mocks.runtimeRun).not.toHaveBeenCalled();
  });

  it("records succeeded history entry for completed runtime result with exit code 0", async () => {
    const coordinator = new AppCoordinator("/tmp/preload.js");
    const send = vi.fn();
    const targetWindow = { isDestroyed: () => false, webContents: { send } };

    mocks.runtimeRun.mockImplementationOnce(async (_request, _settings, onEvent) => {
      onEvent({ type: "delta", delta: "stream chunk" });
      onEvent({
        type: "completed",
        result: {
          stdout: "hello",
          stderr: "",
          exitCode: 0,
          tokenUsage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
        },
      });
    });

    await coordinator.startRuntimeRun(
      {
        command: " /reply hi ",
        action: "edit",
        selectedText: " selected text ",
      },
      targetWindow as never,
    );

    expect(mocks.resolveSlashCommandPrompt).toHaveBeenCalledWith("/reply hi", mocks.slashCommands);
    expect(mocks.runtimeRun).toHaveBeenCalledWith(
      {
        command: "resolved:/reply hi",
        action: "edit",
        selectedText: " selected text ",
      },
      mocks.settingsSnapshot,
      expect.any(Function),
    );
    expect(mocks.historyRecordExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "/reply hi",
        status: "succeeded",
        detail: "Generated 5 chars.",
        usedSelectionContext: true,
        responseText: "hello",
      }),
    );
    expect(send).toHaveBeenCalledWith(ipcChannels.runtimeEvent, {
      type: "delta",
      delta: "stream chunk",
    });
  });

  it("records failed history entry for completed runtime result with non-zero exit code", async () => {
    const coordinator = new AppCoordinator("/tmp/preload.js");
    const targetWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } };

    mocks.runtimeRun.mockImplementationOnce(async (_request, _settings, onEvent) => {
      onEvent({
        type: "completed",
        result: {
          stdout: "",
          stderr: "raw cli error",
          exitCode: 1,
          tokenUsage: null,
        },
      });
    });

    await coordinator.startRuntimeRun(
      {
        command: "translate this",
        action: "askQuestion",
        selectedText: null,
      },
      targetWindow as never,
    );

    expect(mocks.summarizeCLIErrorMessage).toHaveBeenCalledWith("raw cli error");
    expect(mocks.historyRecordExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "translate this",
        status: "failed",
        detail: "summary:raw cli error",
        usedSelectionContext: false,
        responseText: null,
      }),
    );
  });

  it("records failed/cancelled history for runtime failed and cancelled events", async () => {
    const coordinator = new AppCoordinator("/tmp/preload.js");
    const targetWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } };

    mocks.runtimeRun.mockImplementationOnce(async (_request, _settings, onEvent) => {
      onEvent({ type: "failed", message: "network down" });
      onEvent({ type: "cancelled" });
    });

    await coordinator.startRuntimeRun(
      {
        command: "follow up",
        action: "askQuestion",
        selectedText: "context",
      },
      targetWindow as never,
    );

    expect(mocks.summarizeCLIErrorMessage).toHaveBeenCalledWith("network down");
    expect(mocks.historyRecordExecution).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        status: "failed",
        detail: "summary:network down",
        responseText: null,
      }),
    );
    expect(mocks.historyRecordExecution).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: "cancelled",
        detail: "Execution stopped.",
        responseText: null,
      }),
    );
  });

  it("registers hotkey lifecycle and broadcasts settings/history updates on start", async () => {
    const coordinator = new AppCoordinator("/tmp/preload.js");
    const aliveWindowSend = vi.fn();
    const deadWindowSend = vi.fn();
    mocks.windows.push(
      { isDestroyed: () => false, webContents: { send: aliveWindowSend } },
      { isDestroyed: () => true, webContents: { send: deadWindowSend } },
    );

    await coordinator.start();

    expect(mocks.hotkeyBind).toHaveBeenCalled();
    expect(mocks.ensureShortcutLifecycle).toHaveBeenCalled();
    expect(mocks.hotkeyRegister).toHaveBeenCalledWith("Command+K");
    expect(mocks.runtimePrewarm).toHaveBeenCalledWith(mocks.settingsSnapshot);

    const nextSettings = {
      ...mocks.settingsSnapshot,
      openPanelShortcut: "Command+Shift+K",
    };
    mocks.settingsListeners[0]?.(nextSettings);
    expect(mocks.hotkeyRegister).toHaveBeenLastCalledWith("Command+Shift+K");
    expect(aliveWindowSend).toHaveBeenCalledWith(ipcChannels.settingsChanged, nextSettings);
    expect(deadWindowSend).not.toHaveBeenCalled();

    const nextHistory = { ...mocks.historySnapshot };
    mocks.historyListeners[0]?.(nextHistory);
    expect(aliveWindowSend).toHaveBeenCalledWith(ipcChannels.historyChanged, nextHistory);
  });
});
