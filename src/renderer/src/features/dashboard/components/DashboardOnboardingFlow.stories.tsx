import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { DashboardOnboardingFlow } from "./DashboardOnboardingFlow";

const meta = {
  title: "Dashboard/DashboardOnboardingFlow",
  component: DashboardOnboardingFlow,
  parameters: {
    layout: "fullscreen",
    echoView: "dashboard",
  },
  args: {
    currentStep: 0,
    openPanelShortcut: "Command+K",
    onOpenAccessibilitySettings: fn(),
    onRequestMicrophonePermission: fn(async () => "granted"),
    onNextStep: fn(),
    onPreviousStep: fn(),
    onComplete: fn(),
  },
} satisfies Meta<typeof DashboardOnboardingFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StepOne: Story = {};

export const StepTwo: Story = {
  args: {
    currentStep: 1,
  },
};

export const StepThree: Story = {
  args: {
    currentStep: 2,
  },
};
