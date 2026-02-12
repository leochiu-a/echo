import { BrowserWindow } from 'electron'
import { resolveSlashCommandPrompt } from '@shared/domain/slash'
import { summarizeCLIErrorMessage } from '@shared/domain/error-summary'
import { ipcChannels, type RuntimeStreamEvent } from '@shared/contracts/ipc'
import type { RuntimeRunRequest } from '@main/services/runtime/codex-runtime-service'
import { MacOSAXContextBridge } from '@main/platform/macos/ax-context-bridge'
import { MacOSApplyOutputBridge, type ApplyMode } from '@main/platform/macos/apply-output-bridge'
import { GlobalHotkeyService, ensureShortcutLifecycle } from '@main/services/hotkey/global-hotkey-service'
import { HistoryService } from '@main/services/history/history-service'
import { CodexRuntimeService } from '@main/services/runtime/codex-runtime-service'
import { SettingsService } from '@main/services/settings/settings-service'
import { UsageService } from '@main/services/usage/usage-service'
import { DashboardWindowService } from '@main/services/window/dashboard-window-service'
import { OverlayWindowService } from '@main/services/window/overlay-window-service'
import { WindowStateService } from '@main/services/window/window-state-service'

export class AppCoordinator {
  readonly settingsService = new SettingsService()
  readonly historyService = new HistoryService()
  readonly usageService = new UsageService()
  readonly runtimeService = new CodexRuntimeService()

  private readonly windowStateService = new WindowStateService()
  private readonly overlayWindowService: OverlayWindowService
  private readonly dashboardWindowService: DashboardWindowService
  private readonly hotkeyService = new GlobalHotkeyService()
  private readonly axContextBridge = new MacOSAXContextBridge()
  private readonly applyOutputBridge = new MacOSApplyOutputBridge()

  constructor(preloadPath: string) {
    this.overlayWindowService = new OverlayWindowService(this.windowStateService, preloadPath)
    this.dashboardWindowService = new DashboardWindowService(this.windowStateService, preloadPath)
  }

  async start(): Promise<void> {
    this.hotkeyService.bind(() => {
      void this.toggleOverlayFromHotkey()
    })

    ensureShortcutLifecycle(this.hotkeyService)
    this.registerHotkey(this.settingsService.snapshot.openPanelShortcut)

    this.settingsService.onChanged((settings) => {
      this.registerHotkey(settings.openPanelShortcut)
      this.broadcastToAllWindows(ipcChannels.settingsChanged, settings)
    })

    this.historyService.onChanged((snapshot) => {
      this.broadcastToAllWindows(ipcChannels.historyChanged, snapshot)
    })

    await this.runtimeService.prewarm(this.settingsService.snapshot)
  }

  async stop(): Promise<void> {
    this.hotkeyService.dispose()
    await this.runtimeService.dispose()
    this.overlayWindowService.close()
    this.dashboardWindowService.close()
  }

  async toggleOverlayFromHotkey(): Promise<void> {
    const context = await this.axContextBridge.captureSnapshot()
    await this.overlayWindowService.toggleNearCursor(context)
  }

  async openDashboard(): Promise<void> {
    await this.dashboardWindowService.open()
  }

  async captureOverlayContext() {
    return await this.axContextBridge.captureSnapshot()
  }

  async applyOutput(payload: { text: string; mode: ApplyMode }): Promise<boolean> {
    return await this.applyOutputBridge.applyOutput(payload.text, payload.mode)
  }

  hideOverlay(): void {
    this.overlayWindowService.hide()
  }

  resizeOverlay(height: number): void {
    this.overlayWindowService.resizeToContent(height)
  }

  getSettings() {
    return this.settingsService.snapshot
  }

  updateSettings(partial: Parameters<SettingsService['update']>[0]) {
    return this.settingsService.update(partial)
  }

  resetSettings() {
    return this.settingsService.reset()
  }

  getHistorySnapshot() {
    return this.historyService.snapshot
  }

  deleteHistoryEntry(id: string): void {
    this.historyService.deleteEntry(id)
  }

  clearHistory(): void {
    this.historyService.clear()
  }

  setHistoryRetentionPolicy(policy: Parameters<HistoryService['setRetentionPolicy']>[0]) {
    return this.historyService.setRetentionPolicy(policy)
  }

  monthlyUsage() {
    return this.usageService.summarizeCurrentMonth(this.historyService.snapshot.entries)
  }

  async startRuntimeRun(request: RuntimeRunRequest, targetWindow: BrowserWindow): Promise<void> {
    const rawCommand = request.command.trim()
    if (!rawCommand) {
      throw new Error('Command cannot be empty.')
    }

    const resolvedCommand = resolveSlashCommandPrompt(rawCommand, this.settingsService.availableSlashCommands())
    const settings = this.settingsService.snapshot

    await this.runtimeService.run(
      {
        ...request,
        command: resolvedCommand
      },
      settings,
      (event) => {
        if (!targetWindow.isDestroyed()) {
          targetWindow.webContents.send(ipcChannels.runtimeEvent, event satisfies RuntimeStreamEvent)
        }

        if (event.type === 'completed') {
          if (event.result.exitCode === 0) {
            this.historyService.recordExecution({
              command: rawCommand,
              action: request.action,
              usedSelectionContext: Boolean(request.selectedText?.trim()),
              status: 'succeeded',
              detail: successDetail(event.result.stdout),
              responseText: event.result.stdout,
              tokenUsage: event.result.tokenUsage
            })
            return
          }

          this.historyService.recordExecution({
            command: rawCommand,
            action: request.action,
            usedSelectionContext: Boolean(request.selectedText?.trim()),
            status: 'failed',
            detail: summarizeCLIErrorMessage(event.result.stderr),
            responseText: null,
            tokenUsage: event.result.tokenUsage
          })
          return
        }

        if (event.type === 'failed') {
          this.historyService.recordExecution({
            command: rawCommand,
            action: request.action,
            usedSelectionContext: Boolean(request.selectedText?.trim()),
            status: 'failed',
            detail: summarizeCLIErrorMessage(event.message),
            responseText: null,
            tokenUsage: null
          })
          return
        }

        if (event.type === 'cancelled') {
          this.historyService.recordExecution({
            command: rawCommand,
            action: request.action,
            usedSelectionContext: Boolean(request.selectedText?.trim()),
            status: 'cancelled',
            detail: 'Execution stopped.',
            responseText: null,
            tokenUsage: null
          })
        }
      }
    )
  }

  async cancelRuntimeRun(): Promise<void> {
    await this.runtimeService.cancel()
  }

  isRuntimeRunning(): boolean {
    return this.runtimeService.isRunning()
  }

  private registerHotkey(shortcut: string): void {
    try {
      this.hotkeyService.register(shortcut)
    } catch (error) {
      // Keep the app alive if shortcut registration fails due to conflict.
      console.warn('[echo] failed to register shortcut', shortcut, error)
    }
  }

  private broadcastToAllWindows(channel: string, payload: unknown): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, payload)
      }
    }
  }
}

function successDetail(output: string): string {
  const length = output.trim().length
  if (length === 0) {
    return 'Completed with empty output.'
  }

  return `Generated ${length} chars.`
}
