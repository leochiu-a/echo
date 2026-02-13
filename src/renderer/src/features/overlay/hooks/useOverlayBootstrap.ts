import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { EchoRendererApi } from "@shared/contracts/ipc";
import type { AppSettings } from "@shared/domain/types";
import { preloadUnavailableMessage } from "@renderer/shared/echo-api";
import type { HistorySnapshot, OverlayContext } from "../overlay-shared";

interface UseOverlayBootstrapParams {
  echo: EchoRendererApi | null;
  setErrorText: Dispatch<SetStateAction<string | null>>;
  setIsRunning: Dispatch<SetStateAction<boolean>>;
  setOutputText: Dispatch<SetStateAction<string>>;
  setSettings: Dispatch<SetStateAction<AppSettings | null>>;
  setHistory: Dispatch<SetStateAction<HistorySnapshot | null>>;
  prepareForPresentation: (nextContext: OverlayContext) => void;
}

export function useOverlayBootstrap({
  echo,
  setErrorText,
  setIsRunning,
  setOutputText,
  setSettings,
  setHistory,
  prepareForPresentation,
}: UseOverlayBootstrapParams): void {
  const prepareForPresentationRef = useRef(prepareForPresentation);

  useEffect(() => {
    prepareForPresentationRef.current = prepareForPresentation;
  }, [prepareForPresentation]);

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
      prepareForPresentationRef.current(nextContext);
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
      prepareForPresentationRef.current(nextContext);
    });

    return () => {
      offRuntime();
      offContextReady();
      offSettingsChanged();
      offHistoryChanged();
    };
  }, [echo, setErrorText, setHistory, setIsRunning, setOutputText, setSettings]);
}
