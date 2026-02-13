import { Cpu, Keyboard } from 'lucide-react'
import { DashboardSubsectionHeader } from '../components/DashboardSubsectionHeader'
import type { SettingsDraft } from '../dashboard-shared'
import {
  EFFORTS,
  MODELS,
  cn,
  dashboardInputClass,
  dashboardPrimaryButtonClass,
  dashboardSecondaryButtonClass,
  dashboardSelectClass,
  tokenizeShortcut
} from '../dashboard-shared'

interface SettingsSectionProps {
  settingsDraft: SettingsDraft
  hasPendingSettings: boolean
  settingsFeedback: string | null
  onPatchDraft: (patch: Partial<SettingsDraft>) => void
  onSaveSettings: () => void
  onResetSettings: () => void
}

export function SettingsSection({
  settingsDraft,
  hasPendingSettings,
  settingsFeedback,
  onPatchDraft,
  onSaveSettings,
  onResetSettings
}: SettingsSectionProps) {
  return (
    <section className="grid gap-5" aria-label="Settings">
      <DashboardSubsectionHeader icon={Keyboard} title="Keyboard Shortcuts" />
      <div className="grid gap-4">
        <label className="grid gap-2 lg:grid-cols-[minmax(200px,1fr)_minmax(220px,320px)_auto] lg:items-start lg:gap-2.5">
          <div>
            <strong className="mb-1.5 block text-base font-bold text-[#21333d]">Open Input Panel</strong>
            <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
              Toggle the floating input panel. Default: Command + K.
            </p>
          </div>
          <input
            className={cn(dashboardInputClass, 'h-14 px-3.5')}
            value={settingsDraft.openPanelShortcut}
            onChange={(event) => onPatchDraft({ openPanelShortcut: event.target.value })}
          />
          <div className="inline-flex flex-wrap items-center justify-start gap-1.5 lg:justify-end" aria-hidden="true">
            {tokenizeShortcut(settingsDraft.openPanelShortcut).map((token, index) => (
              <span
                key={`${token}-${index}`}
                className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase text-[#21333d]"
              >
                {token}
              </span>
            ))}
          </div>
        </label>

        <label className="grid gap-2 lg:grid-cols-[minmax(200px,1fr)_minmax(220px,320px)_auto] lg:items-start lg:gap-2.5">
          <div>
            <strong className="mb-1.5 block text-base font-bold text-[#21333d]">Replace Action</strong>
            <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
              Apply output by replacing the current selection.
            </p>
          </div>
          <input
            className={cn(dashboardInputClass, 'h-14 px-3.5')}
            value={settingsDraft.replaceShortcut}
            onChange={(event) => onPatchDraft({ replaceShortcut: event.target.value })}
          />
          <div className="inline-flex flex-wrap items-center justify-start gap-1.5 lg:justify-end" aria-hidden="true">
            {tokenizeShortcut(settingsDraft.replaceShortcut).map((token, index) => (
              <span
                key={`${token}-${index}`}
                className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase text-[#21333d]"
              >
                {token}
              </span>
            ))}
          </div>
        </label>

        <label className="grid gap-2 lg:grid-cols-[minmax(200px,1fr)_minmax(220px,320px)_auto] lg:items-start lg:gap-2.5">
          <div>
            <strong className="mb-1.5 block text-base font-bold text-[#21333d]">Insert Action</strong>
            <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
              Apply output by inserting next to the current selection.
            </p>
          </div>
          <input
            className={cn(dashboardInputClass, 'h-14 px-3.5')}
            value={settingsDraft.insertShortcut}
            onChange={(event) => onPatchDraft({ insertShortcut: event.target.value })}
          />
          <div className="inline-flex flex-wrap items-center justify-start gap-1.5 lg:justify-end" aria-hidden="true">
            {tokenizeShortcut(settingsDraft.insertShortcut).map((token, index) => (
              <span
                key={`${token}-${index}`}
                className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase text-[#21333d]"
              >
                {token}
              </span>
            ))}
          </div>
        </label>
      </div>

      <DashboardSubsectionHeader icon={Cpu} title="Model" />
      <div className="grid gap-4">
        <label className="grid gap-2 text-base font-bold text-[#21333d]">
          Model
          <select
            className={cn(dashboardSelectClass, 'h-14 w-full md:max-w-[390px]')}
            value={settingsDraft.codexModel}
            onChange={(event) => onPatchDraft({ codexModel: event.target.value })}
          >
            {MODELS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-base font-bold text-[#21333d]">
          Reasoning Effort
          <select
            className={cn(dashboardSelectClass, 'h-14 w-full md:max-w-[390px]')}
            value={settingsDraft.codexReasoningEffort}
            onChange={(event) => onPatchDraft({ codexReasoningEffort: event.target.value })}
          >
            {EFFORTS.map((effort) => (
              <option key={effort} value={effort}>
                {effort}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className={dashboardSecondaryButtonClass}
          onClick={onSaveSettings}
          disabled={!hasPendingSettings}
        >
          Save Settings
        </button>
        <button type="button" className={dashboardPrimaryButtonClass} onClick={onResetSettings}>
          Reset to Defaults
        </button>
      </div>

      {settingsFeedback ? <p className="m-0 text-xs text-[#0b6e4f]">{settingsFeedback}</p> : null}
    </section>
  )
}
