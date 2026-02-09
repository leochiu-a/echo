import Foundation
import Testing
@testable import Echo

@Test
func composePromptEditWithoutSelectionReturnsTrimmedCommand() {
    let prompt = composePrompt(command: "  improve text  ", selectedText: nil, action: .edit)
    #expect(prompt == "improve text")
}

@Test
func composePromptEditWithSelectionIncludesInstructionAndContext() {
    let prompt = composePrompt(
        command: "shorten",
        selectedText: "Line one.\nLine two.",
        action: .edit
    )

    #expect(prompt.contains("User instruction:"))
    #expect(prompt.contains("shorten"))
    #expect(prompt.contains("Selected text:"))
    #expect(prompt.contains("Line one.\nLine two."))
    #expect(prompt.contains("Return only the final result text."))
}

@Test
func composePromptAskQuestionWithSelectionIncludesQuestionAndContext() {
    let prompt = composePrompt(
        command: "What is this about?",
        selectedText: "A short paragraph",
        action: .askQuestion
    )

    #expect(prompt.contains("Question:"))
    #expect(prompt.contains("What is this about?"))
    #expect(prompt.contains("Context:"))
    #expect(prompt.contains("A short paragraph"))
    #expect(prompt.contains("If context is insufficient, say so briefly."))
}

@Test
func normalizeOutputRemovesANSIAndTrims() {
    let raw = "  \u{001B}[31mError\u{001B}[0m  \n"
    #expect(normalizeOutput(raw) == "Error")
}

@Test
func enrichedEnvironmentContainsRequiredPathEntries() {
    let env = enrichedEnvironment()
    let path = env["PATH"] ?? ""
    let components = path.split(separator: ":").map(String.init)

    #expect(components.contains("/opt/homebrew/bin"))
    #expect(components.contains("/usr/local/bin"))
    #expect(components.contains("/usr/bin"))
    #expect(components.contains("/bin"))
    #expect(components.contains("/usr/sbin"))
    #expect(components.contains("/sbin"))
    #expect(Set(components).count == components.count)
}

@Test
func cleanupTempFilesRemovesFiles() throws {
    let tmp = FileManager.default.temporaryDirectory
    let fileA = tmp.appendingPathComponent("echo-copilot-test-a-\(UUID().uuidString).tmp")
    let fileB = tmp.appendingPathComponent("echo-copilot-test-b-\(UUID().uuidString).tmp")

    #expect(FileManager.default.createFile(atPath: fileA.path, contents: Data("a".utf8)))
    #expect(FileManager.default.createFile(atPath: fileB.path, contents: Data("b".utf8)))

    cleanupTempFiles([fileA, fileB])

    #expect(!FileManager.default.fileExists(atPath: fileA.path))
    #expect(!FileManager.default.fileExists(atPath: fileB.path))
}
