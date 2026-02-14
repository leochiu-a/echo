import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { OverlayOutputSection } from "./OverlayOutputSection";

const meta = {
  title: "Overlay/OutputSection",
  component: OverlayOutputSection,
  parameters: {
    layout: "fullscreen",
    echoView: "overlay",
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen p-2">
        <div className="mx-auto max-w-[1180px]">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    outputText:
      "First-principles thinking means breaking a problem down to basic truths and reasoning from there instead of relying on analogy.",
    copyButtonLabel: "Copy",
    isRunning: false,
    hasEditableSelection: true,
    onCopyOutput: fn(),
    onApplyOutput: fn(),
  },
} satisfies Meta<typeof OverlayOutputSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    outputText: "",
  },
};

export const Running: Story = {
  args: {
    isRunning: true,
  },
};

export const NoEditableSelection: Story = {
  args: {
    hasEditableSelection: false,
  },
};
