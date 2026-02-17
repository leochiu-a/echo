import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { cn, dashboardInputClass } from "../dashboard-shared";
import { KeyboardShortcutInput } from "./KeyboardShortcutInput";

const meta = {
  title: "Dashboard/KeyboardShortcutInput",
  component: KeyboardShortcutInput,
  parameters: {
    layout: "fullscreen",
    echoView: "dashboard",
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen p-6">
        <div className="mx-auto max-w-[560px]">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    value: "",
    ariaLabel: "Keyboard shortcut input",
    className: cn(dashboardInputClass, "h-14 px-3.5"),
    onChange: fn(),
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);

    return (
      <KeyboardShortcutInput
        {...args}
        value={value}
        onChange={(nextValue) => {
          setValue(nextValue);
          args.onChange(nextValue);
        }}
      />
    );
  },
} satisfies Meta<typeof KeyboardShortcutInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const CommandK: Story = {
  args: {
    value: "Command+K",
  },
};

export const CommandShiftEnter: Story = {
  args: {
    value: "Command+Shift+Enter",
  },
};
