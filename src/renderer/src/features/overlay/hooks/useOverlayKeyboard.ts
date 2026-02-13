import { useCallback, useEffect } from "react";
import type React from "react";
import type { Dispatch, SetStateAction } from "react";

interface UseOverlayKeyboardParams {
  isComposingInput: boolean;
  outputText: string;
  slashSuggestionsLength: number;
  setHighlightedSuggestionIndex: Dispatch<SetStateAction<number>>;
  onCopyOutput: () => Promise<void>;
  onEscapePressed: () => Promise<void>;
  onHistoryUp: () => void;
  onHistoryDown: () => void;
  onApplyHighlightedSuggestion: () => boolean;
  onExecutePrompt: () => Promise<void>;
}

export function useOverlayKeyboard({
  isComposingInput,
  outputText,
  slashSuggestionsLength,
  setHighlightedSuggestionIndex,
  onCopyOutput,
  onEscapePressed,
  onHistoryUp,
  onHistoryDown,
  onApplyHighlightedSuggestion,
  onExecutePrompt,
}: UseOverlayKeyboardParams) {
  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void onEscapePressed();
    };

    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown, true);
    };
  }, [onEscapePressed]);

  return useCallback(
    async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isComposingInput) {
        return;
      }

      if (
        event.key.toLowerCase() === "c" &&
        event.metaKey &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const hasPromptSelection =
          event.currentTarget.selectionStart !== event.currentTarget.selectionEnd;
        if (hasPromptSelection) {
          // Preserve native copy behavior when user selects text in prompt input.
          return;
        }

        if (!outputText.trim()) {
          return;
        }

        event.preventDefault();
        await onCopyOutput();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        await onEscapePressed();
        return;
      }

      if (event.key === "ArrowUp") {
        if (slashSuggestionsLength > 0) {
          event.preventDefault();
          setHighlightedSuggestionIndex(
            (current) => (current - 1 + slashSuggestionsLength) % slashSuggestionsLength,
          );
          return;
        }

        event.preventDefault();
        onHistoryUp();
        return;
      }

      if (event.key === "ArrowDown") {
        if (slashSuggestionsLength > 0) {
          event.preventDefault();
          setHighlightedSuggestionIndex((current) => (current + 1) % slashSuggestionsLength);
          return;
        }

        event.preventDefault();
        onHistoryDown();
        return;
      }

      if (
        event.key === "Tab" &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        if (onApplyHighlightedSuggestion()) {
          event.preventDefault();
        }
        return;
      }

      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        if (onApplyHighlightedSuggestion()) {
          return;
        }
        await onExecutePrompt();
      }
    },
    [
      isComposingInput,
      onApplyHighlightedSuggestion,
      onCopyOutput,
      onEscapePressed,
      onExecutePrompt,
      onHistoryDown,
      onHistoryUp,
      outputText,
      setHighlightedSuggestionIndex,
      slashSuggestionsLength,
    ],
  );
}
