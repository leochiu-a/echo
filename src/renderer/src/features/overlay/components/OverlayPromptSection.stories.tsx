import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { CopilotAction } from "@shared/domain/types";
import type { OverlayContext, SlashSuggestion } from "../overlay-shared";
import { OverlayPromptSection } from "./OverlayPromptSection";

const baseContext: OverlayContext = {
  selectedText: "Please rewrite this sentence to be clearer.",
  hasEditableSelection: true,
  accessibilityTrusted: true,
  selectionBounds: {
    x: 240,
    y: 120,
    width: 640,
    height: 200,
  },
};

const baseSuggestions: SlashSuggestion[] = [
  {
    id: "s1",
    command: "summary",
    prompt: "Summarize the selected text in concise bullet points.",
  },
  {
    id: "s2",
    command: "tone",
    prompt: "Rewrite the selected text with a more professional tone.",
  },
];

const meta = {
  title: "Overlay/PromptSection",
  component: OverlayPromptSection,
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
    context: baseContext,
    commandText: "Refine and shorten this paragraph.",
    actionLabel: "Edit Selection",
    modeSelectLabel: "Edit Selection",
    selectedAction: "edit",
    slashSuggestions: [] as SlashSuggestion[],
    highlightedSuggestionIndex: 0,
    isPreloadAvailable: true,
    isRunning: false,
    isVoiceRecording: false,
    isVoiceTranscribing: false,
    errorText: null,
    onClearSelection: fn(),
    onCommandChange: fn(),
    onKeyDown: fn(),
    onCompositionStart: fn(),
    onCompositionEnd: fn(),
    onCloseOverlay: fn(),
    onSuggestionHover: fn(),
    onSuggestionApply: fn(),
    onActionChange: fn(),
    onCancelRun: fn(),
    onToggleVoiceInput: fn(),
    onExecutePrompt: fn(),
  },
  render: (args) => {
    const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
    const [commandText, setCommandText] = useState(args.commandText);
    const [selectedAction, setSelectedAction] = useState<CopilotAction>(args.selectedAction);

    return (
      <OverlayPromptSection
        {...args}
        promptInputRef={promptInputRef}
        commandText={commandText}
        selectedAction={selectedAction}
        onCommandChange={(value) => {
          setCommandText(value);
          args.onCommandChange(value);
        }}
        onActionChange={(action) => {
          setSelectedAction(action);
          args.onActionChange(action);
        }}
      />
    );
  },
} satisfies Meta<typeof OverlayPromptSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSlashSuggestions: Story = {
  args: {
    commandText: "/s",
    slashSuggestions: baseSuggestions,
    highlightedSuggestionIndex: 0,
  },
};

export const AccessibilityWarning: Story = {
  args: {
    context: {
      ...baseContext,
      selectedText: null,
      hasEditableSelection: false,
      accessibilityTrusted: false,
      selectionBounds: null,
    },
    commandText: "整理",
    actionLabel: "Edit Text",
    modeSelectLabel: "Edit Text",
  },
};

export const Running: Story = {
  args: {
    commandText: "Keep streaming until stopped...",
    isRunning: true,
  },
};

export const VoiceRecording: Story = {
  args: {
    commandText: "Draft a concise update",
    isVoiceRecording: true,
  },
};
