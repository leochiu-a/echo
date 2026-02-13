import { beforeEach, describe, expect, it, vi } from "vitest";
import { ipcChannels } from "@shared/contracts/ipc";

const electronMocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const handle = vi.fn((channel: string, listener: (...args: unknown[]) => unknown) => {
    handlers.set(channel, listener);
  });

  return {
    handlers,
    handle,
    fromWebContents: vi.fn(),
  };
});

vi.mock("electron", () => ({
  ipcMain: {
    handle: electronMocks.handle,
  },
  BrowserWindow: {
    fromWebContents: electronMocks.fromWebContents,
  },
}));

import { registerIpcHandlers } from "@main/ipc/register-ipc";

function makeCoordinator() {
  return {
    getSettings: vi.fn(() => ({ codexModel: "gpt-5.3-codex" })),
    updateSettings: vi.fn((payload) => payload),
    resetSettings: vi.fn(() => ({ codexModel: "gpt-5.3-codex" })),
    getHistorySnapshot: vi.fn(() => ({ entries: [], commands: [], retentionPolicy: "forever" })),
    deleteHistoryEntry: vi.fn(),
    clearHistory: vi.fn(),
    setHistoryRetentionPolicy: vi.fn((policy) => policy),
    getMonthlyUsageSnapshot: vi.fn(async () => ({
      source: "ccusage",
      months: [],
      fetchedAt: "",
      error: null,
    })),
    captureOverlayContext: vi.fn(async () => ({
      selectedText: null,
      hasEditableSelection: false,
      accessibilityTrusted: true,
    })),
    hideOverlay: vi.fn(),
    resizeOverlay: vi.fn(),
    applyOutput: vi.fn(async () => true),
    openDashboard: vi.fn(async () => undefined),
    startRuntimeRun: vi.fn(async () => undefined),
    cancelRuntimeRun: vi.fn(async () => undefined),
    isRuntimeRunning: vi.fn(() => false),
  };
}

describe("registerIpcHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMocks.handlers.clear();
  });

  it("registers expected handlers", () => {
    const coordinator = makeCoordinator();
    registerIpcHandlers(coordinator as never);

    expect(electronMocks.handlers.has(ipcChannels.settingsGet)).toBe(true);
    expect(electronMocks.handlers.has(ipcChannels.settingsUpdate)).toBe(true);
    expect(electronMocks.handlers.has(ipcChannels.overlayCaptureContext)).toBe(true);
    expect(electronMocks.handlers.has(ipcChannels.runtimeStart)).toBe(true);
    expect(electronMocks.handlers.has(ipcChannels.runtimeCancel)).toBe(true);
  });

  it("validates settings update payload before forwarding", () => {
    const coordinator = makeCoordinator();
    registerIpcHandlers(coordinator as never);

    const settingsUpdate = electronMocks.handlers.get(ipcChannels.settingsUpdate);
    if (!settingsUpdate) {
      throw new Error("settings:update handler missing");
    }

    const payload = { codexModel: "gpt-5.2" };
    settingsUpdate({}, payload);
    expect(coordinator.updateSettings).toHaveBeenCalledWith(payload);

    expect(() => settingsUpdate({}, { codexModel: "" })).toThrow();
  });

  it("enforces source window existence for runtime start", async () => {
    const coordinator = makeCoordinator();
    registerIpcHandlers(coordinator as never);

    const runtimeStart = electronMocks.handlers.get(ipcChannels.runtimeStart);
    if (!runtimeStart) {
      throw new Error("runtime:start handler missing");
    }

    const sourceWindow = { id: 1 };
    electronMocks.fromWebContents.mockReturnValue(sourceWindow);

    const payload = {
      command: "rewrite",
      action: "edit",
      selectedText: null,
    };
    await runtimeStart({ sender: { id: 99 } }, payload);
    expect(coordinator.startRuntimeRun).toHaveBeenCalledWith(payload, sourceWindow);

    electronMocks.fromWebContents.mockReturnValue(null);
    await expect(runtimeStart({ sender: { id: 99 } }, payload)).rejects.toThrow(
      "Unable to resolve source window for runtime stream.",
    );
  });

  it("validates overlay context response schema", async () => {
    const coordinator = makeCoordinator();
    registerIpcHandlers(coordinator as never);

    const captureContext = electronMocks.handlers.get(ipcChannels.overlayCaptureContext);
    if (!captureContext) {
      throw new Error("overlay:capture-context handler missing");
    }

    await expect(captureContext()).resolves.toEqual({
      selectedText: null,
      hasEditableSelection: false,
      accessibilityTrusted: true,
    });

    coordinator.captureOverlayContext.mockResolvedValueOnce({
      selectedText: 123,
      hasEditableSelection: false,
      accessibilityTrusted: true,
    });
    await expect(captureContext()).rejects.toThrow();
  });

  it("validates history delete payload id format", () => {
    const coordinator = makeCoordinator();
    registerIpcHandlers(coordinator as never);

    const deleteEntry = electronMocks.handlers.get(ipcChannels.historyDeleteEntry);
    if (!deleteEntry) {
      throw new Error("history:delete-entry handler missing");
    }

    const valid = { id: "123e4567-e89b-42d3-a456-426614174000" };
    deleteEntry({}, valid);
    expect(coordinator.deleteHistoryEntry).toHaveBeenCalledWith(valid.id);

    expect(() => deleteEntry({}, { id: "not-a-uuid" })).toThrow();
  });
});
