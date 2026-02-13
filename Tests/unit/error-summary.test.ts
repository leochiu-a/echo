import { describe, expect, it } from "vitest";
import { summarizeCLIErrorMessage } from "@shared/domain/error-summary";

describe("error summary", () => {
  it("prefers API detail payload", () => {
    const raw = `
OpenAI Codex v0.98.0 (research preview)
--------
model: gpt-5.3-codex
ERROR: {"detail":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account."}
`;

    const summary = summarizeCLIErrorMessage(raw);
    expect(summary).toBe(
      "The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.",
    );
  });

  it("skips known noise lines", () => {
    const raw = `
OpenAI Codex v0.98.0 (research preview)
--------
workdir: /tmp
model: gpt-5.3-codex
mcp: notion ready
ERROR: CLI execution timed out.
`;

    const summary = summarizeCLIErrorMessage(raw);
    expect(summary).toBe("CLI execution timed out.");
  });
});
