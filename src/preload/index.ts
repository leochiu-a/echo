import { contextBridge, ipcRenderer } from "electron";
import { z } from "zod";
import {
  appSettingsSchema,
  codexMonthlyUsageSnapshotSchema,
  ipcChannels,
  overlayContextSchema,
  promptHistoryEntrySchema,
  promptHistoryRetentionPolicySchema,
  promptHistoryTokenSummarySchema,
  runPromptRequestSchema,
  runtimeStreamEventSchema,
  type EchoRendererApi,
} from "@shared/contracts/ipc";

const echoApi: EchoRendererApi = {
  settings: {
    async get() {
      const data = await ipcRenderer.invoke(ipcChannels.settingsGet);
      return appSettingsSchema.parse(data);
    },
    async update(partial) {
      const data = await ipcRenderer.invoke(ipcChannels.settingsUpdate, partial);
      return appSettingsSchema.parse(data);
    },
    async reset() {
      const data = await ipcRenderer.invoke(ipcChannels.settingsReset);
      return appSettingsSchema.parse(data);
    },
    onChanged(listener) {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        listener(appSettingsSchema.parse(payload));
      };
      ipcRenderer.on(ipcChannels.settingsChanged, wrapped);
      return () => {
        ipcRenderer.off(ipcChannels.settingsChanged, wrapped);
      };
    },
  },
  history: {
    async get() {
      const payload = await ipcRenderer.invoke(ipcChannels.historyGet);
      return parseHistorySnapshot(payload);
    },
    async deleteEntry(id) {
      await ipcRenderer.invoke(ipcChannels.historyDeleteEntry, { id });
    },
    async clear() {
      await ipcRenderer.invoke(ipcChannels.historyClear);
    },
    async setRetentionPolicy(retentionPolicy) {
      const payload = await ipcRenderer.invoke(ipcChannels.historySetRetention, retentionPolicy);
      return promptHistoryRetentionPolicySchema.parse(payload);
    },
    onChanged(listener) {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        listener(parseHistorySnapshot(payload));
      };
      ipcRenderer.on(ipcChannels.historyChanged, wrapped);
      return () => {
        ipcRenderer.off(ipcChannels.historyChanged, wrapped);
      };
    },
  },
  usage: {
    async getMonthly() {
      const payload = await ipcRenderer.invoke(ipcChannels.usageGetMonthly);
      return codexMonthlyUsageSnapshotSchema.parse(payload);
    },
  },
  overlay: {
    async captureContext() {
      const payload = await ipcRenderer.invoke(ipcChannels.overlayCaptureContext);
      return overlayContextSchema.parse(payload);
    },
    async resize(height) {
      await ipcRenderer.invoke(ipcChannels.overlayResize, height);
    },
    async applyOutput(payload) {
      return Boolean(await ipcRenderer.invoke(ipcChannels.overlayApplyOutput, payload));
    },
    async close() {
      await ipcRenderer.invoke(ipcChannels.overlayClose);
    },
    async openDashboard() {
      await ipcRenderer.invoke(ipcChannels.dashboardOpen);
    },
    onContextReady(listener) {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        listener(overlayContextSchema.parse(payload));
      };
      ipcRenderer.on(ipcChannels.overlayContextReady, wrapped);
      return () => {
        ipcRenderer.off(ipcChannels.overlayContextReady, wrapped);
      };
    },
  },
  runtime: {
    async start(payload) {
      const parsed = runPromptRequestSchema.parse(payload);
      await ipcRenderer.invoke(ipcChannels.runtimeStart, parsed);
    },
    async cancel() {
      await ipcRenderer.invoke(ipcChannels.runtimeCancel);
    },
    async isRunning() {
      return Boolean(await ipcRenderer.invoke(ipcChannels.runtimeState));
    },
    onEvent(listener) {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        listener(runtimeStreamEventSchema.parse(payload));
      };
      ipcRenderer.on(ipcChannels.runtimeEvent, wrapped);
      return () => {
        ipcRenderer.off(ipcChannels.runtimeEvent, wrapped);
      };
    },
  },
  system: {
    async openAccessibilitySettings() {
      return Boolean(await ipcRenderer.invoke(ipcChannels.systemOpenAccessibilitySettings));
    },
  },
};

contextBridge.exposeInMainWorld("echo", echoApi);

function parseHistorySnapshot(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid history snapshot payload.");
  }

  const source = payload as {
    entries: unknown;
    commands: unknown;
    retentionPolicy: unknown;
    tokenSummary: unknown;
  };

  return {
    entries: promptHistoryEntrySchema.array().parse(source.entries),
    commands: arrayOfStringSchema.parse(source.commands),
    retentionPolicy: promptHistoryRetentionPolicySchema.parse(source.retentionPolicy),
    tokenSummary: promptHistoryTokenSummarySchema.parse(source.tokenSummary),
  };
}

const arrayOfStringSchema = z.array(z.string());
