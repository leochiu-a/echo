import { useCallback, useEffect, useState } from "react";

const DASHBOARD_ONBOARDING_DISMISSED_KEY = "echo:dashboard-onboarding-dismissed:v1";
const ONBOARDING_TOTAL_STEPS = 2;

function readOnboardingDismissed(): boolean {
  try {
    return window.localStorage.getItem(DASHBOARD_ONBOARDING_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function persistOnboardingDismissed(): void {
  try {
    window.localStorage.setItem(DASHBOARD_ONBOARDING_DISMISSED_KEY, "1");
  } catch {
    // Ignore write failures and keep onboarding functional.
  }
}

export function useDashboardOnboarding() {
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!readOnboardingDismissed()) {
      setCurrentStep(0);
      setIsOnboardingActive(true);
    }
  }, []);

  const goToNextStep = useCallback(() => {
    setCurrentStep((step) => Math.min(step + 1, ONBOARDING_TOTAL_STEPS - 1));
  }, []);

  const goToPreviousStep = useCallback(() => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }, []);

  const completeOnboarding = useCallback(() => {
    setIsOnboardingActive(false);
    persistOnboardingDismissed();
  }, []);

  return {
    isOnboardingActive,
    currentStep,
    goToNextStep,
    goToPreviousStep,
    completeOnboarding,
  };
}
