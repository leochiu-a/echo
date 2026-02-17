import { afterEach, describe, expect, it, vi } from "vitest";
import { CodexRuntimeService } from "@main/services/runtime/codex-runtime-service";
import type { AppSettings } from "@shared/domain/types";

function makeSettings(partial: Partial<AppSettings> = {}): AppSettings {
  return {
    schemaVersion: 1,
    codexModel: "gpt-5.3-codex",
    codexReasoningEffort: "medium",
    openaiApiKey: "",
    openPanelShortcut: "Command+K",
    replaceShortcut: "Command+Enter",
    insertShortcut: "Command+Shift+Enter",
    slashCommands: [],
    ...partial,
  };
}

describe("CodexRuntimeService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits started/completed with normalized stdout for successful runs", async () => {
    const service = new CodexRuntimeService();
    vi.spyOn(service as never, "executeTurnWithTimeout").mockResolvedValue({
      output: "  \u001B[31mDone\u001B[0m  ",
      tokenUsage: { inputTokens: 10, outputTokens: 6, totalTokens: 16 },
      status: "completed",
      errorMessage: null,
    });

    const events: Array<Record<string, unknown>> = [];
    await service.run(
      { command: "rewrite", action: "edit", selectedText: null },
      makeSettings(),
      (event) => events.push(event as unknown as Record<string, unknown>),
    );

    expect(events[0]).toEqual({ type: "started" });
    expect(events[1]).toEqual({
      type: "completed",
      result: {
        stdout: "Done",
        stderr: "",
        exitCode: 0,
        tokenUsage: { inputTokens: 10, outputTokens: 6, totalTokens: 16 },
      },
    });
    expect(service.isRunning()).toBe(false);
  });

  it("returns non-zero completed result when turn status is not completed", async () => {
    const service = new CodexRuntimeService();
    vi.spyOn(service as never, "executeTurnWithTimeout").mockResolvedValue({
      output: "partial output",
      tokenUsage: null,
      status: "failed",
      errorMessage: "runtime exploded",
    });

    const events: Array<Record<string, unknown>> = [];
    await service.run(
      { command: "rewrite", action: "edit", selectedText: null },
      makeSettings(),
      (event) => events.push(event as unknown as Record<string, unknown>),
    );

    expect(events[1]).toEqual({
      type: "completed",
      result: {
        stdout: "partial output",
        stderr: "runtime exploded",
        exitCode: 1,
        tokenUsage: null,
      },
    });
  });

  it("emits cancelled when execute turn throws AbortError", async () => {
    const service = new CodexRuntimeService();
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    vi.spyOn(service as never, "executeTurnWithTimeout").mockRejectedValue(abortError);

    const events: Array<Record<string, unknown>> = [];
    await service.run(
      { command: "rewrite", action: "edit", selectedText: null },
      makeSettings(),
      (event) => events.push(event as unknown as Record<string, unknown>),
    );

    expect(events).toEqual([{ type: "started" }, { type: "cancelled" }]);
  });

  it("emits failed summary from stderr snapshot for unexpected errors", async () => {
    const service = new CodexRuntimeService();
    vi.spyOn(service as never, "executeTurnWithTimeout").mockRejectedValue(
      new Error("raw failure"),
    );
    vi.spyOn(service as never, "stderrSnapshot").mockReturnValue("ERROR: CLI execution timed out.");

    const events: Array<Record<string, unknown>> = [];
    await service.run(
      { command: "rewrite", action: "edit", selectedText: null },
      makeSettings(),
      (event) => events.push(event as unknown as Record<string, unknown>),
    );

    expect(events).toEqual([
      { type: "started" },
      { type: "failed", message: "CLI execution timed out." },
    ]);
    expect(service.isRunning()).toBe(false);
  });

  it("rejects if another run is already in progress", async () => {
    const service = new CodexRuntimeService();
    (service as { running: boolean }).running = true;

    await expect(
      service.run(
        { command: "rewrite", action: "edit", selectedText: null },
        makeSettings(),
        () => undefined,
      ),
    ).rejects.toThrow("Another prompt execution is still running.");
  });

  it("swallows prewarm errors and forwards cancel/dispose to resetSession", async () => {
    const service = new CodexRuntimeService();
    vi.spyOn(service as never, "ensureSession").mockRejectedValue(new Error("codex unavailable"));
    const resetSpy = vi.spyOn(service as never, "resetSession").mockResolvedValue(undefined);

    await expect(service.prewarm(makeSettings())).resolves.toBeUndefined();
    await service.cancel();
    await service.dispose();

    expect(resetSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ message: "Cancelled by user." }),
    );
    expect(resetSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ message: "Runtime disposed." }),
    );
  });
});
