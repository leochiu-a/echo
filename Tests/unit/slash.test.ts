import { describe, expect, it } from "vitest";
import { resolveSlashCommandPrompt, slashAutocompleteContext } from "@shared/domain/slash";

describe("slash rules", () => {
  it("keeps original command when slash command is unknown", () => {
    const output = resolveSlashCommandPrompt("/unknown rewrite this", [
      { id: crypto.randomUUID(), command: "reply", prompt: "Prompt body" },
    ]);

    expect(output).toBe("/unknown rewrite this");
  });

  it("replaces input placeholder", () => {
    const output = resolveSlashCommandPrompt("/reply Thanks for your message", [
      {
        id: crypto.randomUUID(),
        command: "reply",
        prompt: "Draft a concise email reply:\n\n{{input}}",
      },
    ]);

    expect(output).toBe("Draft a concise email reply:\n\nThanks for your message");
  });

  it("appends remainder when template does not contain placeholder", () => {
    const output = resolveSlashCommandPrompt("/summarize quarterly report", [
      {
        id: crypto.randomUUID(),
        command: "summarize",
        prompt: "Summarize the following text in 3 bullets.",
      },
    ]);

    expect(output).toBe("Summarize the following text in 3 bullets.\n\nquarterly report");
  });

  it("extracts autocomplete context only from immediate slash token", () => {
    expect(slashAutocompleteContext("  /re")).toEqual({ leadingWhitespace: "  ", query: "re" });
    expect(slashAutocompleteContext("/reply draft")).toBeNull();
  });
});
