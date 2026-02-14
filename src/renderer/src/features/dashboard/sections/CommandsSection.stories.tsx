import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { AppSettings } from "@shared/domain/types";
import { CommandsSection } from "./CommandsSection";
import { sampleSlashCommands } from "./storybook-data";

const meta = {
  title: "Dashboard/CommandsSection",
  component: CommandsSection,
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
    commandDrafts: sampleSlashCommands,
    commandFeedback: null,
    onAddCommand: fn(),
    onSaveCommands: fn(),
    onRemoveCommand: fn(),
    onUpdateCommand: fn(),
    onUpdatePrompt: fn(),
  },
  render: (args) => {
    const [commandDrafts, setCommandDrafts] = useState<AppSettings["slashCommands"]>(
      args.commandDrafts,
    );

    return (
      <CommandsSection
        {...args}
        commandDrafts={commandDrafts}
        onAddCommand={() => {
          const nextIndex = commandDrafts.length + 1;
          setCommandDrafts((current) => [
            ...current,
            {
              id: `story-cmd-${nextIndex}`,
              command: `new${nextIndex}`,
              prompt: "Describe what this command should do.",
            },
          ]);
          args.onAddCommand();
        }}
        onRemoveCommand={(id) => {
          setCommandDrafts((current) => current.filter((item) => item.id !== id));
          args.onRemoveCommand(id);
        }}
        onUpdateCommand={(id, command) => {
          setCommandDrafts((current) =>
            current.map((item) => (item.id === id ? { ...item, command } : item)),
          );
          args.onUpdateCommand(id, command);
        }}
        onUpdatePrompt={(id, prompt) => {
          setCommandDrafts((current) =>
            current.map((item) => (item.id === id ? { ...item, prompt } : item)),
          );
          args.onUpdatePrompt(id, prompt);
        }}
      />
    );
  },
} satisfies Meta<typeof CommandsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithCommands: Story = {};

export const Empty: Story = {
  args: {
    commandDrafts: [],
  },
};

export const SavedFeedback: Story = {
  args: {
    commandFeedback: "Command templates saved.",
  },
};
