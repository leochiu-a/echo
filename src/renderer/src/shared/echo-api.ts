import type { EchoRendererApi } from "@shared/contracts/ipc";

export function getEchoApi(): EchoRendererApi | null {
  return (window as Window & { echo?: EchoRendererApi }).echo ?? null;
}

export const preloadUnavailableMessage =
  "Echo preload bridge is unavailable. Open this page from the Electron app instead of a regular browser.";
