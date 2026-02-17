import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, CopilotAction } from "@shared/domain/types";
import { availableSlashCommands } from "@shared/domain/settings";
import { slashAutocompleteContext } from "@shared/domain/slash";
import { getEchoApi, preloadUnavailableMessage } from "@renderer/shared/echo-api";
import { OverlayOutputSection } from "./components/OverlayOutputSection";
import { OverlayPromptSection } from "./components/OverlayPromptSection";
import { useOverlayBootstrap } from "./hooks/useOverlayBootstrap";
import { useOverlayKeyboard } from "./hooks/useOverlayKeyboard";
import type { HistorySnapshot, OverlayContext } from "./overlay-shared";

const PROMPT_MIN_HEIGHT = 40;
const PROMPT_MAX_HEIGHT = 132;
const RECORDING_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

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
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceTranscribing, setIsVoiceTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const commandTextRef = useRef(commandText);
  const directVoiceInsertRef = useRef(false);

  useEffect(() => {
    commandTextRef.current = commandText;
  }, [commandText]);

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

  async function executePrompt() {
    if (!echo) {
      setErrorText(preloadUnavailableMessage);
      return;
    }

    const trimmed = commandText.trim();
    if (!trimmed || isRunning || isVoiceRecording || isVoiceTranscribing) {
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

  useOverlayBootstrap({
    echo,
    setErrorText,
    setIsRunning,
    setOutputText,
    setSettings,
    setHistory,
    prepareForPresentation,
  });

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

  const insertTranscriptIntoCommand = useCallback((transcript: string) => {
    const promptInput = promptInputRef.current;
    if (!promptInput) {
      setCommandText((current) => `${current}${transcript}`);
      return;
    }

    const currentCommand = commandTextRef.current;
    const selectionStart = promptInput.selectionStart ?? currentCommand.length;
    const selectionEnd = promptInput.selectionEnd ?? currentCommand.length;
    const nextCommand =
      currentCommand.slice(0, selectionStart) + transcript + currentCommand.slice(selectionEnd);
    const nextCursor = selectionStart + transcript.length;

    setCommandText(nextCommand);
    window.requestAnimationFrame(() => {
      const input = promptInputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
    });
  }, []);

  const transcribeAudio = useCallback(
    async (audioBlob: Blob, directInsert: boolean) => {
      if (!echo) {
        setErrorText(preloadUnavailableMessage);
        return;
      }

      if (audioBlob.size === 0) {
        setErrorText("No audio detected.");
        return;
      }

      setIsVoiceTranscribing(true);
      setErrorText(null);

      try {
        const audioBase64 = await blobToBase64(audioBlob);
        const result = await echo.voice.transcribe({
          audioBase64,
          mimeType: audioBlob.type || "audio/webm",
        });
        const transcript = result.text.trim();
        if (!transcript) {
          setErrorText("Whisper returned empty text.");
          return;
        }

        if (directInsert) {
          await echo.overlay.applyOutput({ text: transcript, mode: "replace" });
          await echo.overlay.close();
          return;
        }

        insertTranscriptIntoCommand(transcript);
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : "Voice transcription failed.");
      } finally {
        setIsVoiceTranscribing(false);
      }
    },
    [echo, insertTranscriptIntoCommand],
  );

  const releaseVoiceCapture = useCallback(() => {
    mediaRecorderRef.current = null;
    const stream = mediaStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    audioChunksRef.current = [];
    directVoiceInsertRef.current = false;
  }, []);

  const cancelVoiceCapture = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }

    setIsVoiceRecording(false);
    releaseVoiceCapture();
  }, [releaseVoiceCapture]);

  const stopVoiceCapture = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsVoiceRecording(false);
      return;
    }

    setIsVoiceRecording(false);
    recorder.stop();
  }, []);

  const startVoiceCapture = useCallback(
    async (directInsert: boolean) => {
      if (!echo) {
        setErrorText(preloadUnavailableMessage);
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorText("Microphone capture is not available in this environment.");
        return;
      }

      if (isVoiceRecording || isVoiceTranscribing) {
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = preferredRecordingMimeType();
        const recorder =
          mimeType && MediaRecorder.isTypeSupported(mimeType)
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);

        const outputMimeType = recorder.mimeType || mimeType || "audio/webm";
        audioChunksRef.current = [];
        mediaStreamRef.current = stream;
        mediaRecorderRef.current = recorder;
        directVoiceInsertRef.current = directInsert;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        recorder.onstop = () => {
          const chunks = [...audioChunksRef.current];
          const shouldDirectInsert = directVoiceInsertRef.current;
          releaseVoiceCapture();
          if (chunks.length === 0) {
            setErrorText("No audio detected.");
            return;
          }
          void transcribeAudio(new Blob(chunks, { type: outputMimeType }), shouldDirectInsert);
        };

        recorder.start(250);
        setIsVoiceRecording(true);
      } catch (error) {
        releaseVoiceCapture();
        setIsVoiceRecording(false);
        setErrorText(error instanceof Error ? error.message : "Failed to start voice input.");
      }
    },
    [echo, isVoiceRecording, isVoiceTranscribing, releaseVoiceCapture, transcribeAudio],
  );

  const toggleVoiceCapture = useCallback(() => {
    if (isVoiceRecording) {
      stopVoiceCapture();
      return;
    }

    void startVoiceCapture(false);
  }, [isVoiceRecording, startVoiceCapture, stopVoiceCapture]);

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

  const onEscapePressed = useCallback(async () => {
    if (!echo) {
      setErrorText(preloadUnavailableMessage);
      return;
    }

    if (isVoiceRecording) {
      cancelVoiceCapture();
    }

    if (isRunning) {
      await echo.runtime.cancel();
    }

    await echo.overlay.close();
  }, [cancelVoiceCapture, echo, isRunning, isVoiceRecording]);

  const onKeyDown = useOverlayKeyboard({
    isComposingInput,
    outputText,
    slashSuggestionsLength: slashSuggestions.length,
    setHighlightedSuggestionIndex,
    onCopyOutput,
    onEscapePressed,
    onHistoryUp: historyUp,
    onHistoryDown: historyDown,
    onApplyHighlightedSuggestion: applyHighlightedSuggestion,
    onExecutePrompt: executePrompt,
  });

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
    isVoiceRecording,
    isVoiceTranscribing,
  ]);

  useEffect(() => {
    if (!echo) {
      return;
    }

    return echo.overlay.onVoiceInputRequested(() => {
      if (isVoiceRecording) {
        stopVoiceCapture();
        return;
      }
      void startVoiceCapture(true);
    });
  }, [echo, isVoiceRecording, startVoiceCapture, stopVoiceCapture]);

  useEffect(() => {
    return () => {
      cancelVoiceCapture();
    };
  }, [cancelVoiceCapture]);

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
        isVoiceRecording={isVoiceRecording}
        isVoiceTranscribing={isVoiceTranscribing}
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
        onToggleVoiceInput={toggleVoiceCapture}
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

function preferredRecordingMimeType(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return null;
  }

  for (const candidate of RECORDING_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error("Unable to read recorded audio."));
    };
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unable to parse recorded audio."));
        return;
      }

      const separatorIndex = result.indexOf(",");
      resolve(separatorIndex >= 0 ? result.slice(separatorIndex + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}
