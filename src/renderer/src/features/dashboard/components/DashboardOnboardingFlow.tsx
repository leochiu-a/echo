import { useState } from "react";
import {
  dashboardPrimaryButtonClass,
  dashboardSecondaryButtonClass,
  tokenizeShortcut,
} from "../dashboard-shared";

const ONBOARDING_TOTAL_STEPS = 3;
type MicrophonePermissionResult = "granted" | "denied" | "unsupported";
type MicrophonePermissionStatus = "idle" | "pending" | MicrophonePermissionResult;

interface DashboardOnboardingFlowProps {
  currentStep: number;
  openPanelShortcut: string;
  onOpenAccessibilitySettings: () => void;
  onRequestMicrophonePermission: () => Promise<MicrophonePermissionResult>;
  onNextStep: () => void;
  onPreviousStep: () => void;
  onComplete: () => void;
}

export function DashboardOnboardingFlow({
  currentStep,
  openPanelShortcut,
  onOpenAccessibilitySettings,
  onRequestMicrophonePermission,
  onNextStep,
  onPreviousStep,
  onComplete,
}: DashboardOnboardingFlowProps) {
  const resolvedStep = Math.max(0, Math.min(currentStep, ONBOARDING_TOTAL_STEPS - 1));
  const isFirstStep = resolvedStep === 0;
  const isAccessibilityStep = resolvedStep === 1;
  const isLastStep = resolvedStep === ONBOARDING_TOTAL_STEPS - 1;
  const [microphoneStatus, setMicrophoneStatus] = useState<MicrophonePermissionStatus>("idle");

  async function requestMicrophonePermission() {
    if (microphoneStatus === "pending") {
      return;
    }

    setMicrophoneStatus("pending");
    const status = await onRequestMicrophonePermission();
    setMicrophoneStatus(status);
  }

  return (
    <main className="relative h-full w-full overflow-hidden p-2.5 md:p-[11px]">
      <div
        className="pointer-events-none absolute -left-[260px] -top-[140px] z-0 h-[420px] w-[420px] rounded-full bg-[#a2d6e0]/45"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-[130px] top-[16%] z-0 h-[340px] w-[340px] rounded-full bg-[#e8dbcb]/60"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-[-90px] left-[16%] z-0 h-[300px] w-[300px] rounded-full bg-[#d5e6df]/60"
        aria-hidden="true"
      />

      <section className="relative z-[1] mx-auto grid h-full w-full max-w-[1060px] grid-rows-[1fr_auto] gap-4 rounded-2xl border border-white/50 bg-white/65 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_28px_rgba(30,67,83,0.06)] backdrop-blur-[14px] backdrop-saturate-[1.35] md:p-7">
        <article className="grid content-start gap-5">
          <header className="grid gap-2.5 border-b border-[#bccfd6]/60 pb-4">
            <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-[#4a6a76]">
              Onboarding · Step {resolvedStep + 1} / {ONBOARDING_TOTAL_STEPS}
            </p>
            <h1 className="m-0 text-[30px] font-black leading-[1.05] tracking-[-0.02em] text-[#1f3642] md:text-[38px]">
              {isFirstStep
                ? "Learn your open shortcut"
                : isAccessibilityStep
                  ? "Enable Accessibility permission"
                  : "Enable Microphone permission"}
            </h1>
            <p className="m-0 max-w-[760px] text-sm font-medium leading-[1.5] text-[#48606d] md:text-[15px]">
              {isFirstStep
                ? "Use this shortcut anywhere to call Echo's floating input panel."
                : isAccessibilityStep
                  ? "Echo needs Accessibility permission to read selected text and apply output back into other apps."
                  : "Echo can request microphone access now so voice input works immediately in overlay and shortcuts."}
            </p>
          </header>

          {isFirstStep ? (
            <div className="grid gap-3 rounded-2xl border border-[#c8d8de] bg-white/80 p-5">
              <strong className="text-sm font-bold text-[#1f3842]">Open panel shortcut</strong>
              <div
                className="inline-flex flex-wrap items-center gap-2"
                aria-label="Open Echo shortcut"
              >
                {tokenizeShortcut(openPanelShortcut).map((token, index) => (
                  <kbd
                    key={`${token}-${index}`}
                    className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg border border-black/10 bg-white px-3 py-1 text-xs font-semibold uppercase text-[#1f3842]"
                  >
                    {token}
                  </kbd>
                ))}
              </div>
              <p className="m-0 text-[13px] font-medium leading-[1.45] text-[#4b6270]">
                You can change this shortcut later in Dashboard Settings.
              </p>
            </div>
          ) : isAccessibilityStep ? (
            <div className="grid gap-3 rounded-2xl border border-[#c8d8de] bg-white/80 p-5">
              <strong className="text-sm font-bold text-[#1f3842]">macOS setup path</strong>
              <p className="m-0 text-[13px] font-medium leading-[1.45] text-[#4b6270]">
                Open System Settings -&gt; Privacy &amp; Security -&gt; Accessibility, then enable
                Echo.
              </p>
              <div>
                <button
                  type="button"
                  className={dashboardSecondaryButtonClass}
                  onClick={onOpenAccessibilitySettings}
                >
                  Open Accessibility Settings
                </button>
              </div>
              <p className="m-0 text-[13px] font-medium leading-[1.45] text-[#4b6270]">
                After this is enabled, Echo can read highlighted text and insert/replace generated
                output.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 rounded-2xl border border-[#c8d8de] bg-white/80 p-5">
              <strong className="text-sm font-bold text-[#1f3842]">Microphone permission</strong>
              <p className="m-0 text-[13px] font-medium leading-[1.45] text-[#4b6270]">
                Click the button below to trigger macOS microphone permission prompt for Echo.
              </p>
              <div>
                <button
                  type="button"
                  className={dashboardPrimaryButtonClass}
                  onClick={() => {
                    if (microphoneStatus === "granted") {
                      onComplete();
                      return;
                    }

                    void requestMicrophonePermission();
                  }}
                  disabled={microphoneStatus === "pending"}
                >
                  {microphoneStatus === "pending"
                    ? "Requesting..."
                    : microphoneStatus === "granted"
                      ? "Continue"
                      : "Enable Microphone Access"}
                </button>
              </div>
              {microphoneStatus === "granted" ? (
                <p className="m-0 text-[13px] font-semibold leading-[1.45] text-[#0b6e4f]">
                  v Microphone access granted.
                </p>
              ) : null}
              {microphoneStatus === "denied" ? (
                <p className="m-0 text-[13px] font-semibold leading-[1.45] text-[#9a3412]">
                  Permission denied. Open System Settings -&gt; Privacy &amp; Security -&gt;
                  Microphone, then enable Echo.
                </p>
              ) : null}
              {microphoneStatus === "unsupported" ? (
                <p className="m-0 text-[13px] font-semibold leading-[1.45] text-[#9a3412]">
                  Microphone API is unavailable in this environment.
                </p>
              ) : null}
            </div>
          )}
        </article>

        <footer className="flex items-center justify-between gap-2 border-t border-[#bccfd6]/60 pt-4">
          <button
            type="button"
            className={dashboardSecondaryButtonClass}
            onClick={onPreviousStep}
            disabled={isFirstStep}
          >
            Previous
          </button>

          {isLastStep ? (
            <button type="button" className={dashboardPrimaryButtonClass} onClick={onComplete}>
              Enter Dashboard
            </button>
          ) : (
            <button type="button" className={dashboardPrimaryButtonClass} onClick={onNextStep}>
              Next
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}
