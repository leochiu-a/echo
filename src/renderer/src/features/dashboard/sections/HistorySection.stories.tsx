import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { HistorySection } from "./HistorySection";
import { sampleHistorySnapshot } from "./storybook-data";

const meta = {
  title: "Dashboard/HistorySection",
  component: HistorySection,
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
    onRetentionPolicyChange: fn(),
    onClearAll: fn(),
    onDeleteEntry: fn(),
  },
} satisfies Meta<typeof HistorySection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithEntries: Story = {};

export const Empty: Story = {
  args: {
    history: {
      ...sampleHistorySnapshot,
      entries: [],
    },
  },
};
