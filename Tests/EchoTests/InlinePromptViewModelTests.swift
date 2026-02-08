import Testing
@testable import Echo

@Test
@MainActor
func prepareForPresentationWithSelectionSetsContextFlags() {
    let viewModel = InlinePromptViewModel()

    viewModel.prepareForPresentation(selectedText: "abc", hasEditableSelection: true)

    #expect(viewModel.hasSelectionContext)
    #expect(viewModel.hasEditableSelection)
    #expect(viewModel.selectedContextInfo == "Using selected text context (3 chars)")
    #expect(viewModel.selectedAction == .edit)
}

@Test
@MainActor
func prepareForPresentationWithoutSelectionResetsContextFlags() {
    let viewModel = InlinePromptViewModel()

    viewModel.prepareForPresentation(selectedText: nil, hasEditableSelection: false)

    #expect(!viewModel.hasSelectionContext)
    #expect(!viewModel.hasEditableSelection)
    #expect(viewModel.selectedContextInfo == nil)
}

@Test
@MainActor
func canShowApplyButtonsDependsOnEditableSelectionAndOutput() {
    let viewModel = InlinePromptViewModel()
    viewModel.prepareForPresentation(selectedText: "abc", hasEditableSelection: true)
    #expect(!viewModel.canShowApplyButtons)

    viewModel.outputText = "result"
    #expect(viewModel.canShowApplyButtons)

    viewModel.hasEditableSelection = false
    #expect(!viewModel.canShowApplyButtons)
}

@Test
@MainActor
func replaceOutputTriggersAcceptAndClose() {
    let viewModel = InlinePromptViewModel()
    viewModel.prepareForPresentation(selectedText: "abc", hasEditableSelection: true)
    viewModel.outputText = "final text"

    var acceptedText: String?
    var acceptedMode: OutputApplyMode?
    var closeCalls = 0

    viewModel.onRequestAccept = { text, mode in
        acceptedText = text
        acceptedMode = mode
    }
    viewModel.onRequestClose = { closeCalls += 1 }

    viewModel.replaceOutput()

    #expect(acceptedText == "final text")
    #expect(closeCalls == 1)
    switch acceptedMode {
    case .replace:
        break
    default:
        Issue.record("Expected replace mode")
    }
}

@Test
@MainActor
func insertOutputTriggersAcceptAndClose() {
    let viewModel = InlinePromptViewModel()
    viewModel.prepareForPresentation(selectedText: "abc", hasEditableSelection: true)
    viewModel.outputText = "insert text"

    var acceptedText: String?
    var acceptedMode: OutputApplyMode?
    var closeCalls = 0

    viewModel.onRequestAccept = { text, mode in
        acceptedText = text
        acceptedMode = mode
    }
    viewModel.onRequestClose = { closeCalls += 1 }

    viewModel.insertOutput()

    #expect(acceptedText == "insert text")
    #expect(closeCalls == 1)
    switch acceptedMode {
    case .insert:
        break
    default:
        Issue.record("Expected insert mode")
    }
}

@Test
@MainActor
func replaceAndInsertDoNothingWhenApplyButtonsAreUnavailable() {
    let viewModel = InlinePromptViewModel()
    viewModel.prepareForPresentation(selectedText: "abc", hasEditableSelection: false)
    viewModel.outputText = "text exists"

    var acceptCalls = 0
    var closeCalls = 0
    viewModel.onRequestAccept = { _, _ in acceptCalls += 1 }
    viewModel.onRequestClose = { closeCalls += 1 }

    viewModel.replaceOutput()
    viewModel.insertOutput()

    #expect(acceptCalls == 0)
    #expect(closeCalls == 0)
}

@Test
@MainActor
func cancelExecutionSetsStoppedMessageByDefault() {
    let viewModel = InlinePromptViewModel()
    viewModel.isRunning = true

    viewModel.cancelExecution()

    #expect(!viewModel.isRunning)
    #expect(viewModel.errorText == "Stopped.")
}

@Test
@MainActor
func closeCancelsWithoutStoppedMessage() {
    let viewModel = InlinePromptViewModel()
    viewModel.isRunning = true
    viewModel.errorText = "previous"

    var closeCalls = 0
    viewModel.onRequestClose = { closeCalls += 1 }

    viewModel.close()

    #expect(!viewModel.isRunning)
    #expect(viewModel.errorText == "previous")
    #expect(closeCalls == 1)
}

@Test
@MainActor
func executeWithBlankCommandDoesNotStartRunning() {
    let viewModel = InlinePromptViewModel()
    viewModel.commandText = "   "

    viewModel.execute()

    #expect(!viewModel.isRunning)
}

@Test
@MainActor
func copyableOutputTextReturnsNilWhenOutputIsEmpty() {
    let viewModel = InlinePromptViewModel()
    viewModel.outputText = ""

    #expect(viewModel.copyableOutputText == nil)
}

@Test
@MainActor
func copyableOutputTextReturnsOutputWhenPresent() {
    let viewModel = InlinePromptViewModel()
    viewModel.commandText = "input prompt"
    viewModel.outputText = "generated output"

    #expect(viewModel.copyableOutputText == "generated output")
}

@Test
@MainActor
func showCopiedFeedbackShowsThenClearsMessage() async {
    let viewModel = InlinePromptViewModel()

    viewModel.showCopiedFeedback()
    #expect(viewModel.copyFeedbackText == "Copied!")

    try? await Task.sleep(nanoseconds: 1_300_000_000)
    #expect(viewModel.copyFeedbackText == nil)
}

@Test
func resolveSlashCommandPromptKeepsOriginalWhenCommandNotFound() {
    let output = resolveSlashCommandPrompt(
        input: "/unknown please rewrite this",
        commands: [SlashCommandSetting(command: "reply", prompt: "Prompt body")]
    )

    #expect(output == "/unknown please rewrite this")
}

@Test
func resolveSlashCommandPromptReplacesInputPlaceholder() {
    let output = resolveSlashCommandPrompt(
        input: "/reply Thanks for your message",
        commands: [
            SlashCommandSetting(
                command: "reply",
                prompt: "Draft a concise email reply:\n\n{{input}}"
            )
        ]
    )

    #expect(output == "Draft a concise email reply:\n\nThanks for your message")
}

@Test
func resolveSlashCommandPromptAppendsRemainderWhenNoPlaceholder() {
    let output = resolveSlashCommandPrompt(
        input: "/summarize The quarterly report focuses on margin gains.",
        commands: [
            SlashCommandSetting(
                command: "summarize",
                prompt: "Summarize the following text in 3 bullets."
            )
        ]
    )

    #expect(output == "Summarize the following text in 3 bullets.\n\nThe quarterly report focuses on margin gains.")
}
