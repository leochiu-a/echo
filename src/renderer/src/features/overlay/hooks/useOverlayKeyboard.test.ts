import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOverlayKeyboard } from "./useOverlayKeyboard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mountUseOverlayKeyboard(params: Parameters<typeof useOverlayKeyboard>[0]) {
  let handler: ((event: React.KeyboardEvent<HTMLTextAreaElement>) => Promise<void>) | null = null;

  function TestComponent() {
    handler = useOverlayKeyboard(params);
    return null;
  }

  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    getHandler() {
      if (!handler) {
        throw new Error("Hook handler not ready.");
      }
      return handler;
    },
    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

function keyboardEvent(params: {
  key: string;
  metaKey?: boolean;
  selectionStart?: number;
  selectionEnd?: number;
}) {
  const preventDefault = vi.fn();
  const event = {
    key: params.key,
    metaKey: Boolean(params.metaKey),
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    currentTarget: {
      selectionStart: params.selectionStart ?? 0,
      selectionEnd: params.selectionEnd ?? 0,
    },
    preventDefault,
  } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

  return { event, preventDefault };
}

describe("useOverlayKeyboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles cmd+c by copying output when prompt input has no selection", async () => {
    const onCopyOutput = vi.fn(async () => undefined);
    const onEscapePressed = vi.fn(async () => undefined);
    const onExecutePrompt = vi.fn(async () => undefined);
    let highlightedIndex = 0;
    const setHighlightedSuggestionIndex = (next: number | ((current: number) => number)) => {
      highlightedIndex = typeof next === "function" ? next(highlightedIndex) : next;
    };

    const mounted = mountUseOverlayKeyboard({
      isComposingInput: false,
      outputText: "copiable output",
      slashSuggestionsLength: 0,
      setHighlightedSuggestionIndex,
      onCopyOutput,
      onEscapePressed,
      onHistoryUp: vi.fn(),
      onHistoryDown: vi.fn(),
      onApplyHighlightedSuggestion: vi.fn(() => false),
      onExecutePrompt,
    });

    const { event, preventDefault } = keyboardEvent({
      key: "c",
      metaKey: true,
      selectionStart: 0,
      selectionEnd: 0,
    });

    await mounted.getHandler()(event);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onCopyOutput).toHaveBeenCalledTimes(1);
    expect(onEscapePressed).not.toHaveBeenCalled();
    expect(onExecutePrompt).not.toHaveBeenCalled();
    mounted.unmount();
  });

  it("keeps native cmd+c behavior when prompt input has selected text", async () => {
    const onCopyOutput = vi.fn(async () => undefined);
    const mounted = mountUseOverlayKeyboard({
      isComposingInput: false,
      outputText: "copiable output",
      slashSuggestionsLength: 0,
      setHighlightedSuggestionIndex: vi.fn(),
      onCopyOutput,
      onEscapePressed: vi.fn(async () => undefined),
      onHistoryUp: vi.fn(),
      onHistoryDown: vi.fn(),
      onApplyHighlightedSuggestion: vi.fn(() => false),
      onExecutePrompt: vi.fn(async () => undefined),
    });

    const { event, preventDefault } = keyboardEvent({
      key: "c",
      metaKey: true,
      selectionStart: 1,
      selectionEnd: 3,
    });

    await mounted.getHandler()(event);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(onCopyOutput).not.toHaveBeenCalled();
    mounted.unmount();
  });

  it("listens for window escape and routes to escape handler", () => {
    const onEscapePressed = vi.fn(async () => undefined);
    const mounted = mountUseOverlayKeyboard({
      isComposingInput: false,
      outputText: "",
      slashSuggestionsLength: 0,
      setHighlightedSuggestionIndex: vi.fn(),
      onCopyOutput: vi.fn(async () => undefined),
      onEscapePressed,
      onHistoryUp: vi.fn(),
      onHistoryDown: vi.fn(),
      onApplyHighlightedSuggestion: vi.fn(() => false),
      onExecutePrompt: vi.fn(async () => undefined),
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onEscapePressed).toHaveBeenCalledTimes(1);
    mounted.unmount();
  });
});
