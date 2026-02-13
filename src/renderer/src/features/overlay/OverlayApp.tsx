import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, CopilotAction } from "@shared/domain/types";
import { availableSlashCommands } from "@shared/domain/settings";
import { slashAutocompleteContext } from "@shared/domain/slash";
import { getEchoApi, preloadUnavailableMessage } from "@renderer/shared/echo-api";
import { OverlayOutputSection } from "./components/OverlayOutputSection";
import { OverlayPromptSection } from "./components/OverlayPromptSection";
import type { HistorySnapshot, OverlayContext, SlashSuggestion } from "./overlay-shared";

const PROMPT_MIN_HEIGHT = 40;
const PROMPT_MAX_HEIGHT = 132;

export function OverlayApp() {
  const echo = getEchoApi();
  const isPreloadAvailable = echo !== null;
  const shellRef = useRef<HTMLElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [history, setHistory] = useState<HistorySnapshot | null>(null);
  const [context, setContext] = useState<OverlayContext>({
    selectedText: null,
    hasEditableSelection: false,
    accessibilityTrusted: true,
    selectionBounds: null,
  });

  const [commandText, setCommandText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedAction, setSelectedAction] = useState<CopilotAction>("edit");
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [isComposingInput, setIsComposingInput] = useState(false);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0);
  const [presentationRevision, setPresentationRevision] = useState(0);

  const slashSuggestions = useMemo(() => {
    const autocomplete = slashAutocompleteContext(commandText);
    if (!autocomplete || !settings) {
      return [];
    }

    const query = autocomplete.query.toLowerCase();
    return availableSlashCommands(settings.slashCommands)
      .filter((item) => !query || item.command.startsWith(query))
      .sort((left, right) => left.command.localeCompare(right.command))
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        command: item.command,
        prompt: item.prompt,
      }));
  }, [commandText, settings]);

  useEffect(() => {
    if (highlightedSuggestionIndex < slashSuggestions.length) {
      return;
    }
    setHighlightedSuggestionIndex(Math.max(0, slashSuggestions.length - 1));
  }, [highlightedSuggestionIndex, slashSuggestions.length]);

  useEffect(() => {
    if (!echo) {
      setErrorText(preloadUnavailableMessage);
      return;
    }

    const offRuntime = echo.runtime.onEvent((event) => {
      if (event.type === "started") {
        setIsRunning(true);
        setErrorText(null);
        return;
      }

      if (event.type === "delta") {
        setOutputText((current) => `${current}${event.delta}`);
        return;
      }

      if (event.type === "completed") {
        setIsRunning(false);
        if (event.result.exitCode === 0) {
          setErrorText(null);
          if (event.result.stdout) {
            setOutputText(event.result.stdout);
          }
        } else {
          setErrorText(
            event.result.stderr || `Execution exited with code ${event.result.exitCode}.`,
          );
        }
        return;
      }

      if (event.type === "failed") {
        setIsRunning(false);
        setErrorText(event.message);
        return;
      }

      setIsRunning(false);
      setErrorText("Stopped.");
    });

    const offContextReady = echo.overlay.onContextReady((nextContext) => {
      prepareForPresentation(nextContext);
    });

    const offSettingsChanged = echo.settings.onChanged((nextSettings) => {
      setSettings(nextSettings);
    });

    const offHistoryChanged = echo.history.onChanged((nextHistory) => {
      setHistory(nextHistory as HistorySnapshot);
    });

    void echo.settings.get().then(setSettings);
    void echo.history.get().then((nextHistory) => {
      setHistory(nextHistory as HistorySnapshot);
    });
    void echo.overlay.captureContext().then((nextContext) => {
      prepareForPresentation(nextContext);
    });

    return () => {
      offRuntime();
      offContextReady();
      offSettingsChanged();
      offHistoryChanged();
    };
  }, [echo]);

  async function executePrompt() {
    if (!echo) {
      setErrorText(preloadUnavailableMessage);
      return;
    }

    const trimmed = commandText.trim();
    if (!trimmed || isRunning) {
      return;
    }

    setOutputText("");
    setErrorText(null);
    setHistoryIndex(null);

    try {
      await echo.runtime.start({
        command: trimmed,
        action: selectedAction,
        selectedText: context.selectedText,
      });
    } catch (error) {
      setIsRunning(false);
      setErrorText(error instanceof Error ? error.message : "Failed to start execution.");
    }
  }

  function prepareForPresentation(nextContext: OverlayContext) {
    setContext(nextContext);
    setSelectedAction("edit");
    setOutputText("");
    setErrorText(null);
    setCopyFeedback(null);
    setHistoryIndex(null);
    setIsComposingInput(false);
    // Force a window height re-measure every time overlay context is refreshed.
    setPresentationRevision((current) => current + 1);
  }

  function historyUp() {
    if (!history || history.commands.length === 0) {
      return;
    }

    if (historyIndex === null) {
      const index = history.commands.length - 1;
      setHistoryIndex(index);
      setCommandText(history.commands[index] ?? "");
      return;
    }

    const nextIndex = Math.max(0, historyIndex - 1);
    setHistoryIndex(nextIndex);
    setCommandText(history.commands[nextIndex] ?? "");
  }

  function historyDown() {
    if (!history || history.commands.length === 0 || historyIndex === null) {
      return;
    }

    const nextIndex = historyIndex + 1;
    if (nextIndex >= history.commands.length) {
      setHistoryIndex(null);
      setCommandText("");
      return;
    }

    setHistoryIndex(nextIndex);
    setCommandText(history.commands[nextIndex] ?? "");
  }

  function applySuggestionAt(index: number): boolean {
    const suggestion = slashSuggestions[index];
    const autocomplete = slashAutocompleteContext(commandText);

    if (!suggestion || !autocomplete) {
      return false;
    }

    setCommandText(`${autocomplete.leadingWhitespace}/${suggestion.command} `);
    return true;
  }

  function applyHighlightedSuggestion(): boolean {
    return applySuggestionAt(highlightedSuggestionIndex);
  }

  async function onCopyOutput() {
    if (!outputText.trim()) {
      return;
    }

    const copied = await writeTextToClipboard(outputText);
    if (copied) {
      setCopyFeedback("Copied!");
      setTimeout(() => setCopyFeedback(null), 1100);
      return;
    }

    setCopyFeedback("Copy failed");
    setTimeout(() => setCopyFeedback(null), 1100);
  }

  async function onApplyOutput(mode: "replace" | "insert") {
    if (!echo) {
      setErrorText(preloadUnavailableMessage);
      return;
    }

    if (!context.hasEditableSelection || !outputText.trim()) {
      return;
    }

    await echo.overlay.applyOutput({ text: outputText, mode });
    await echo.overlay.close();
  }

  async function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
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
      if (!echo) {
        setErrorText(preloadUnavailableMessage);
        return;
      }

      event.preventDefault();
      if (isRunning) {
        await echo.runtime.cancel();
      } else {
        await echo.overlay.close();
      }
      return;
    }

    if (event.key === "ArrowUp") {
      if (slashSuggestions.length > 0) {
        event.preventDefault();
        setHighlightedSuggestionIndex(
          (current) => (current - 1 + slashSuggestions.length) % slashSuggestions.length,
        );
        return;
      }

      event.preventDefault();
      historyUp();
      return;
    }

    if (event.key === "ArrowDown") {
      if (slashSuggestions.length > 0) {
        event.preventDefault();
        setHighlightedSuggestionIndex((current) => (current + 1) % slashSuggestions.length);
        return;
      }

      event.preventDefault();
      historyDown();
      return;
    }

    if (
      event.key === "Tab" &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      if (applyHighlightedSuggestion()) {
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
      if (applyHighlightedSuggestion()) {
        return;
      }
      await executePrompt();
    }
  }

  const actionLabel =
    selectedAction === "edit"
      ? context.selectedText
        ? "Edit Selection"
        : "Edit Text"
      : "Ask Question";

  const modeSelectLabel = selectedAction === "edit" ? "Edit Selection" : "Ask Question";

  useLayoutEffect(() => {
    const promptInput = promptInputRef.current;
    if (!promptInput) {
      return;
    }

    promptInput.style.height = "0px";
    const contentHeight = promptInput.scrollHeight;
    const nextHeight = Math.max(PROMPT_MIN_HEIGHT, Math.min(contentHeight, PROMPT_MAX_HEIGHT));
    promptInput.style.height = `${nextHeight}px`;
    promptInput.style.overflowY = contentHeight > PROMPT_MAX_HEIGHT ? "auto" : "hidden";
  }, [commandText, presentationRevision]);

  useEffect(() => {
    if (!echo || !shellRef.current) {
      return;
    }

    const animationFrameID = window.requestAnimationFrame(() => {
      const measuredHeight = Math.ceil(shellRef.current?.getBoundingClientRect().height ?? 0);
      if (measuredHeight > 0) {
        void echo.overlay.resize(measuredHeight + 2);
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrameID);
    };
  }, [
    echo,
    commandText,
    outputText,
    copyFeedback,
    errorText,
    slashSuggestions.length,
    context.accessibilityTrusted,
    presentationRevision,
  ]);

  return (
    <main
      ref={shellRef}
      className="grid h-auto w-full content-start gap-2.5 bg-[radial-gradient(90%_140%_at_100%_0%,rgba(72,89,110,0.22)_0%,rgba(0,0,0,0)_62%),linear-gradient(180deg,#121416_0%,#15181b_100%)] p-1 [-webkit-app-region:drag] sm:p-2"
    >
      <OverlayPromptSection
        context={context}
        commandText={commandText}
        actionLabel={actionLabel}
        modeSelectLabel={modeSelectLabel}
        selectedAction={selectedAction}
        slashSuggestions={slashSuggestions}
        highlightedSuggestionIndex={highlightedSuggestionIndex}
        isPreloadAvailable={isPreloadAvailable}
        isRunning={isRunning}
        errorText={errorText}
        promptInputRef={promptInputRef}
        onClearSelection={() => {
          setContext((current) => ({
            ...current,
            selectedText: null,
            hasEditableSelection: false,
            selectionBounds: null,
          }));
        }}
        onOpenDashboard={() => {
          if (!echo) {
            setErrorText(preloadUnavailableMessage);
            return;
          }
          void echo.overlay.openDashboard();
        }}
        onCommandChange={setCommandText}
        onKeyDown={(event) => void onKeyDown(event)}
        onCompositionStart={() => setIsComposingInput(true)}
        onCompositionEnd={() => setIsComposingInput(false)}
        onCloseOverlay={() => {
          if (!echo) {
            setErrorText(preloadUnavailableMessage);
            return;
          }
          void echo.overlay.close();
        }}
        onSuggestionHover={setHighlightedSuggestionIndex}
        onSuggestionApply={(index) => {
          setHighlightedSuggestionIndex(index);
          applySuggestionAt(index);
        }}
        onActionChange={setSelectedAction}
        onCancelRun={() => {
          if (!echo) {
            setErrorText(preloadUnavailableMessage);
            return;
          }
          void echo.runtime.cancel();
        }}
        onExecutePrompt={() => void executePrompt()}
      />

      {outputText || copyFeedback ? (
        <OverlayOutputSection
          outputText={outputText}
          copyButtonLabel={copyFeedback === "Copied!" ? "Copied" : "Copy"}
          isRunning={isRunning}
          hasEditableSelection={context.hasEditableSelection}
          onCopyOutput={() => void onCopyOutput()}
          onApplyOutput={(mode) => void onApplyOutput(mode)}
        />
      ) : null}
    </main>
  );
}

async function writeTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to document-based copy for renderer contexts where Clipboard API is blocked.
    }
  }

  return copyTextWithDocumentCommand(text);
}

function copyTextWithDocumentCommand(text: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.left = "-9999px";

  document.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
