import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EchoRendererApi, RuntimeStreamEvent } from "@shared/contracts/ipc";
import { preloadUnavailableMessage } from "@renderer/shared/echo-api";
import type { OverlayContext } from "../overlay-shared";
import { useOverlayBootstrap } from "./useOverlayBootstrap";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mountUseOverlayBootstrap(params: Parameters<typeof useOverlayBootstrap>[0]) {
  function TestComponent() {
    useOverlayBootstrap(params);
    return null;
  }

  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

describe("useOverlayBootstrap", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets preload unavailable error when echo api is missing", () => {
    const setErrorText = vi.fn();

    const mounted = mountUseOverlayBootstrap({
      echo: null,
      setErrorText,
      setIsRunning: vi.fn(),
      setOutputText: vi.fn(),
      setSettings: vi.fn(),
      setHistory: vi.fn(),
      prepareForPresentation: vi.fn(),
    });

    expect(setErrorText).toHaveBeenCalledWith(preloadUnavailableMessage);
    mounted.unmount();
  });

  it("loads initial payloads, reacts to runtime event, and cleans subscriptions", async () => {
    let runtimeListener: ((event: RuntimeStreamEvent) => void) | null = null;
    const offRuntime = vi.fn();
    const offContextReady = vi.fn();
    const offSettingsChanged = vi.fn();
    const offHistoryChanged = vi.fn();

    const settingsPayload = {
      schemaVersion: 1,
      codexModel: "gpt-5.3-codex",
      codexReasoningEffort: "medium",
      openaiApiKey: "",
      openPanelShortcut: "Command+K",
      replaceShortcut: "Command+Enter",
      insertShortcut: "Command+Shift+Enter",
      slashCommands: [],
    };
    const historyPayload = {
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
    };
    const contextPayload: OverlayContext = {
      selectedText: "hello",
      hasEditableSelection: true,
      accessibilityTrusted: true,
      selectionBounds: { x: 1, y: 2, width: 3, height: 4 },
    };

    const setErrorText = vi.fn();
    const setIsRunning = vi.fn();
    const setOutputText = vi.fn();
    const setSettings = vi.fn();
    const setHistory = vi.fn();
    const prepareForPresentation = vi.fn();

    const echo = {
      runtime: {
        onEvent: vi.fn((listener: (event: RuntimeStreamEvent) => void) => {
          runtimeListener = listener;
          return offRuntime;
        }),
      },
      overlay: {
        onContextReady: vi.fn(() => offContextReady),
        captureContext: vi.fn(async () => contextPayload),
      },
      settings: {
        onChanged: vi.fn(() => offSettingsChanged),
        get: vi.fn(async () => settingsPayload),
      },
      history: {
        onChanged: vi.fn(() => offHistoryChanged),
        get: vi.fn(async () => historyPayload),
      },
    } as unknown as EchoRendererApi;

    const mounted = mountUseOverlayBootstrap({
      echo,
      setErrorText,
      setIsRunning,
      setOutputText,
      setSettings,
      setHistory,
      prepareForPresentation,
    });

    await flushMicrotasks();
    expect(setSettings).toHaveBeenCalledWith(settingsPayload);
    expect(setHistory).toHaveBeenCalledWith(historyPayload);
    expect(prepareForPresentation).toHaveBeenCalledWith(contextPayload);

    if (!runtimeListener) {
      throw new Error("runtime listener not registered");
    }

    act(() => {
      runtimeListener?.({ type: "delta", delta: "abc" });
    });
    const updater = setOutputText.mock.calls.find((call) => typeof call[0] === "function")?.[0] as
      | ((value: string) => string)
      | undefined;
    expect(updater?.("base-")).toBe("base-abc");

    mounted.unmount();
    expect(offRuntime).toHaveBeenCalledTimes(1);
    expect(offContextReady).toHaveBeenCalledTimes(1);
    expect(offSettingsChanged).toHaveBeenCalledTimes(1);
    expect(offHistoryChanged).toHaveBeenCalledTimes(1);
  });
});
