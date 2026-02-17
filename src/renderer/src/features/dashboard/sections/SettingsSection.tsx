import { Cpu, KeyRound, Keyboard } from "lucide-react";
import { KeyboardShortcutInput } from "../components/KeyboardShortcutInput";
import { DashboardSubsectionHeader } from "../components/DashboardSubsectionHeader";
import type { SettingsDraft } from "../dashboard-shared";
import {
  EFFORTS,
  MODELS,
  cn,
  dashboardInputClass,
  dashboardPrimaryButtonClass,
  dashboardSecondaryButtonClass,
  dashboardSelectClass,
} from "../dashboard-shared";

interface SettingsSectionProps {
  settingsDraft: SettingsDraft;
  hasPendingSettings: boolean;
  settingsFeedback: string | null;
  onPatchDraft: (patch: Partial<SettingsDraft>) => void;
  onSaveSettings: () => void;
  onResetSettings: () => void;
}

export function SettingsSection({
  settingsDraft,
  hasPendingSettings,
  settingsFeedback,
  onPatchDraft,
  onSaveSettings,
  onResetSettings,
}: SettingsSectionProps) {
  return (
    <section className="grid gap-5" aria-label="Settings">
      <DashboardSubsectionHeader icon={Keyboard} title="Keyboard Shortcuts" />
      <div className="grid gap-4">
        <label className="grid gap-2 lg:grid-cols-[minmax(200px,1fr)_minmax(220px,360px)] lg:items-start lg:gap-2.5">
          <div>
            <strong className="mb-1.5 block text-base font-bold text-[#21333d]">
              Open Input Panel
            </strong>
            <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
              Toggle the floating input panel. Default: Command + K.
            </p>
          </div>
          <KeyboardShortcutInput
            className={cn(dashboardInputClass, "h-14 px-3.5")}
            value={settingsDraft.openPanelShortcut}
            ariaLabel="Open input panel shortcut"
            onChange={(value) => onPatchDraft({ openPanelShortcut: value })}
          />
        </label>

        <label className="grid gap-2 lg:grid-cols-[minmax(200px,1fr)_minmax(220px,360px)] lg:items-start lg:gap-2.5">
          <div>
            <strong className="mb-1.5 block text-base font-bold text-[#21333d]">
              Replace Action
            </strong>
            <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
              Apply output by replacing the current selection.
            </p>
          </div>
          <KeyboardShortcutInput
            className={cn(dashboardInputClass, "h-14 px-3.5")}
            value={settingsDraft.replaceShortcut}
            ariaLabel="Replace action shortcut"
            onChange={(value) => onPatchDraft({ replaceShortcut: value })}
          />
        </label>

        <label className="grid gap-2 lg:grid-cols-[minmax(200px,1fr)_minmax(220px,360px)] lg:items-start lg:gap-2.5">
          <div>
            <strong className="mb-1.5 block text-base font-bold text-[#21333d]">
              Insert Action
            </strong>
            <p className="m-0 text-[13px] font-medium leading-[1.35] text-[#4f616e]">
              Apply output by inserting next to the current selection.
            </p>
          </div>
          <KeyboardShortcutInput
            className={cn(dashboardInputClass, "h-14 px-3.5")}
            value={settingsDraft.insertShortcut}
            ariaLabel="Insert action shortcut"
            onChange={(value) => onPatchDraft({ insertShortcut: value })}
          />
        </label>
      </div>

      <DashboardSubsectionHeader icon={Cpu} title="Model" />
      <div className="grid gap-4">
        <label className="grid gap-2 text-base font-bold text-[#21333d]">
          Model
          <select
            className={cn(dashboardSelectClass, "h-14 w-full md:max-w-[390px]")}
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
            className={cn(dashboardSelectClass, "h-14 w-full md:max-w-[390px]")}
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

      <DashboardSubsectionHeader icon={KeyRound} title="API Key" />
      <div className="grid gap-3">
        <label className="grid gap-2 text-base font-bold text-[#21333d]">
          OpenAI API Key
          <input
            type="password"
            className={cn(dashboardInputClass, "h-14 w-full md:max-w-[540px] px-3.5")}
            value={settingsDraft.openaiApiKey}
            onChange={(event) => onPatchDraft({ openaiApiKey: event.target.value })}
            placeholder="sk-..."
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <p className="m-0 text-[12px] font-medium text-[#4f616e]">
          Used for Whisper speech-to-text. Stored locally in app settings.
        </p>
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
  );
}
