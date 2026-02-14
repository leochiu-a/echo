import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { SettingsDraft } from "../dashboard-shared";
import { SettingsSection } from "./SettingsSection";
import { sampleSettingsDraft } from "./storybook-data";

const meta = {
  title: "Dashboard/SettingsSection",
  component: SettingsSection,
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
    settingsDraft: sampleSettingsDraft,
    hasPendingSettings: true,
    settingsFeedback: null,
    onPatchDraft: fn(),
    onSaveSettings: fn(),
    onResetSettings: fn(),
  },
  render: (args) => {
    const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(args.settingsDraft);

    return (
      <SettingsSection
        {...args}
        settingsDraft={settingsDraft}
        onPatchDraft={(patch) => {
          setSettingsDraft((current) => ({
            ...current,
            ...patch,
          }));
          args.onPatchDraft(patch);
        }}
      />
    );
  },
} satisfies Meta<typeof SettingsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PendingChanges: Story = {};

export const SavedState: Story = {
  args: {
    hasPendingSettings: false,
    settingsFeedback: "Settings saved.",
  },
};
