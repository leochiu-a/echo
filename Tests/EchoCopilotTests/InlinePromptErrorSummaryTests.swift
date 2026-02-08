import Testing
@testable import EchoCopilot

@Test
func summarizeCLIErrorMessagePrefersAPIDetail() {
    let raw = """
    OpenAI Codex v0.98.0 (research preview)
    --------
    model: gpt-5.3-codex
    ERROR: {"detail":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account."}
    """

    let summary = summarizeCLIErrorMessage(raw)
    #expect(summary == "The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.")
}

@Test
func summarizeCLIErrorMessageSkipsNoiseLines() {
    let raw = """
    OpenAI Codex v0.98.0 (research preview)
    --------
    workdir: /tmp
    model: gpt-5.3-codex
    mcp: notion ready
    ERROR: CLI execution timed out.
    """

    let summary = summarizeCLIErrorMessage(raw)
    #expect(summary == "CLI execution timed out.")
}
