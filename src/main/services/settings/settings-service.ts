import type ElectronStore from 'electron-store'
import { z } from 'zod'
import {
  availableSlashCommands,
  defaultSettings,
  normalizeSettings
} from '@shared/domain/settings'
import type { AppSettings } from '@shared/domain/types'
import { ElectronStoreCompat } from '@main/services/store/electron-store-interop'

const settingsSchema = z.object({
  schemaVersion: z.number().int().positive(),
  codexModel: z.string().min(1),
  codexReasoningEffort: z.string().min(1),
  openPanelShortcut: z.string().min(1),
  replaceShortcut: z.string().min(1),
  insertShortcut: z.string().min(1),
  slashCommands: z.array(
    z.object({
      id: z.string().uuid(),
      command: z.string().min(1),
      prompt: z.string().min(1)
    })
  )
})

export class SettingsService {
  private readonly store: ElectronStore<AppSettings>
  private readonly listeners = new Set<(next: AppSettings) => void>()
  private cached: AppSettings

  constructor() {
    this.store = new ElectronStoreCompat<AppSettings>({
      name: 'settings',
      defaults: defaultSettings
    })

    this.cached = this.readAndNormalize()
    this.store.set(this.cached)
  }

  get snapshot(): AppSettings {
    return { ...this.cached, slashCommands: [...this.cached.slashCommands] }
  }

  update(partial: Partial<AppSettings>): AppSettings {
    const merged = {
      ...this.cached,
      ...partial,
      slashCommands: partial.slashCommands ?? this.cached.slashCommands
    }

    this.cached = normalizeSettings(merged)
    this.persistAndNotify()
    return this.snapshot
  }

  reset(): AppSettings {
    this.cached = defaultSettings
    this.persistAndNotify()
    return this.snapshot
  }

  availableSlashCommands() {
    return availableSlashCommands(this.cached.slashCommands)
  }

  onChanged(listener: (next: AppSettings) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private readAndNormalize(): AppSettings {
    const parsed = settingsSchema.safeParse(this.store.store)
    if (!parsed.success) {
      return defaultSettings
    }

    return normalizeSettings(parsed.data)
  }

  private persistAndNotify(): void {
    this.store.set(this.cached)
    const snapshot = this.snapshot
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}
