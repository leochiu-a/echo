import type ElectronStore from 'electron-store'
import {
  applyRetention,
  createHistoryEntry,
  defaultHistoryState,
  tokenSummary
} from '@shared/domain/history'
import type {
  CopilotAction,
  PromptHistoryEntry,
  PromptHistoryRetentionPolicy,
  PromptHistoryState,
  PromptHistoryStatus,
  TokenUsage
} from '@shared/domain/types'
import { ElectronStoreCompat } from '@main/services/store/electron-store-interop'

interface HistorySnapshot {
  entries: PromptHistoryEntry[]
  commands: string[]
  retentionPolicy: PromptHistoryRetentionPolicy
  tokenSummary: ReturnType<typeof tokenSummary>
}

export class HistoryService {
  private readonly store: ElectronStore<PromptHistoryState>
  private readonly listeners = new Set<(snapshot: HistorySnapshot) => void>()
  private state: PromptHistoryState

  constructor(
    private readonly maxEntries = 120,
    private readonly maxCommands = 120
  ) {
    this.store = new ElectronStoreCompat<PromptHistoryState>({
      name: 'history',
      defaults: defaultHistoryState
    })

    this.state = this.normalizeState(this.store.store)
    this.persist()
  }

  get snapshot(): HistorySnapshot {
    const entries = applyRetention([...this.state.entries], this.state.retentionPolicy)
    return {
      entries,
      commands: [...this.state.commands],
      retentionPolicy: this.state.retentionPolicy,
      tokenSummary: tokenSummary(entries)
    }
  }

  setRetentionPolicy(retentionPolicy: PromptHistoryRetentionPolicy): PromptHistoryRetentionPolicy {
    this.state.retentionPolicy = retentionPolicy
    this.state.entries = applyRetention(this.state.entries, retentionPolicy)
    this.persistAndNotify()
    return retentionPolicy
  }

  rememberCommand(command: string): void {
    const trimmed = command.trim()
    if (!trimmed) {
      return
    }

    this.state.commands = this.state.commands.filter((item) => item !== trimmed)
    this.state.commands.push(trimmed)

    if (this.state.commands.length > this.maxCommands) {
      this.state.commands = this.state.commands.slice(this.state.commands.length - this.maxCommands)
    }

    this.persistAndNotify()
  }

  recordExecution(params: {
    command: string
    action: CopilotAction
    usedSelectionContext: boolean
    status: PromptHistoryStatus
    detail: string
    responseText: string | null
    tokenUsage: TokenUsage | null
    createdAt?: string
  }): void {
    const trimmedCommand = params.command.trim()
    if (!trimmedCommand) {
      return
    }

    this.rememberCommand(trimmedCommand)

    const entry = createHistoryEntry({
      ...params,
      command: trimmedCommand
    })

    this.state.entries.unshift(entry)
    if (this.state.entries.length > this.maxEntries) {
      this.state.entries = this.state.entries.slice(0, this.maxEntries)
    }

    this.state.entries = applyRetention(this.state.entries, this.state.retentionPolicy)
    this.persistAndNotify()
  }

  deleteEntry(id: string): void {
    const nextEntries = this.state.entries.filter((entry) => entry.id !== id)
    if (nextEntries.length === this.state.entries.length) {
      return
    }

    this.state.entries = nextEntries
    this.persistAndNotify()
  }

  clear(): void {
    this.state.entries = []
    this.state.commands = []
    this.persistAndNotify()
  }

  onChanged(listener: (snapshot: HistorySnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private normalizeState(input: Partial<PromptHistoryState>): PromptHistoryState {
    const retentionPolicy = input.retentionPolicy ?? defaultHistoryState.retentionPolicy
    const entries = Array.isArray(input.entries) ? input.entries : []
    const commands = Array.isArray(input.commands) ? input.commands : []

    return {
      schemaVersion: defaultHistoryState.schemaVersion,
      retentionPolicy,
      entries: applyRetention(entries, retentionPolicy),
      commands: commands.slice(-this.maxCommands)
    }
  }

  private persist(): void {
    this.store.set(this.state)
  }

  private persistAndNotify(): void {
    this.persist()
    const snapshot = this.snapshot
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}

export type { HistorySnapshot }
