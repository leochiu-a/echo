import { BrowserWindow, ipcMain } from "electron";
import { z } from "zod";
import { AppCoordinator } from "@main/app/app-coordinator";
import {
  appSettingsSchema,
  ipcChannels,
  overlayContextSchema,
  promptHistoryRetentionPolicySchema,
  runPromptRequestSchema,
} from "@shared/contracts/ipc";

const updateSettingsSchema = appSettingsSchema.partial();
const applyOutputSchema = z.object({
  text: z.string().min(1),
  mode: z.enum(["replace", "insert"]),
});
const overlayResizeSchema = z.number().finite().positive();
const deleteHistorySchema = z.object({ id: z.string().uuid() });

export function registerIpcHandlers(coordinator: AppCoordinator): void {
  ipcMain.handle(ipcChannels.settingsGet, () => {
    return coordinator.getSettings();
  });

  ipcMain.handle(ipcChannels.settingsUpdate, (_event, payload: unknown) => {
    const parsed = updateSettingsSchema.parse(payload);
    return coordinator.updateSettings(parsed);
  });

  ipcMain.handle(ipcChannels.settingsReset, () => {
    return coordinator.resetSettings();
  });

  ipcMain.handle(ipcChannels.historyGet, () => {
    return coordinator.getHistorySnapshot();
  });

  ipcMain.handle(ipcChannels.historyDeleteEntry, (_event, payload: unknown) => {
    const parsed = deleteHistorySchema.parse(payload);
    coordinator.deleteHistoryEntry(parsed.id);
  });

  ipcMain.handle(ipcChannels.historyClear, () => {
    coordinator.clearHistory();
  });

  ipcMain.handle(ipcChannels.historySetRetention, (_event, payload: unknown) => {
    const retentionPolicy = promptHistoryRetentionPolicySchema.parse(payload);
    return coordinator.setHistoryRetentionPolicy(retentionPolicy);
  });

  ipcMain.handle(ipcChannels.usageGetMonthly, async () => {
    return await coordinator.getMonthlyUsageSnapshot();
  });

  ipcMain.handle(ipcChannels.overlayCaptureContext, async () => {
    const snapshot = await coordinator.captureOverlayContext();
    return overlayContextSchema.parse(snapshot);
  });

  ipcMain.handle(ipcChannels.overlayClose, () => {
    coordinator.hideOverlay();
  });

  ipcMain.handle(ipcChannels.overlayResize, (_event, payload: unknown) => {
    const height = overlayResizeSchema.parse(payload);
    coordinator.resizeOverlay(height);
  });

  ipcMain.handle(ipcChannels.overlayApplyOutput, async (_event, payload: unknown) => {
    const parsed = applyOutputSchema.parse(payload);
    return await coordinator.applyOutput(parsed);
  });

  ipcMain.handle(ipcChannels.dashboardOpen, async () => {
    await coordinator.openDashboard();
  });

  ipcMain.handle(ipcChannels.systemOpenAccessibilitySettings, async () => {
    return await coordinator.openAccessibilitySettings();
  });

  ipcMain.handle(ipcChannels.runtimeStart, async (event, payload: unknown) => {
    const request = runPromptRequestSchema.parse(payload);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      throw new Error("Unable to resolve source window for runtime stream.");
    }

    await coordinator.startRuntimeRun(request, window);
  });

  ipcMain.handle(ipcChannels.runtimeCancel, async () => {
    await coordinator.cancelRuntimeRun();
  });

  ipcMain.handle(ipcChannels.runtimeState, () => {
    return coordinator.isRuntimeRunning();
  });
}
