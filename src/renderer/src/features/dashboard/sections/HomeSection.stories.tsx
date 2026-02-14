import type { Meta, StoryObj } from "@storybook/react-vite";
import { HomeSection } from "./HomeSection";
import { sampleHistorySnapshot, sampleMonthlyUsage } from "./storybook-data";

const meta = {
  title: "Dashboard/HomeSection",
  component: HomeSection,
  parameters: {
    layout: "fullscreen",
    echoView: "dashboard",
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen p-6">
        <div className="mx-auto max-w-[1200px]">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    history: sampleHistorySnapshot,
    monthlyUsage: sampleMonthlyUsage,
    gaugeAngle: 272,
  },
} satisfies Meta<typeof HomeSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LoadingMonthlyUsage: Story = {
  args: {
    monthlyUsage: null,
  },
};

export const MonthlyUsageError: Story = {
  args: {
    monthlyUsage: {
      ...sampleMonthlyUsage,
      error: "ccusage binary was not found in PATH.",
      months: [],
    },
  },
};
