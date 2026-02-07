import Testing
@testable import EchoCopilot

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
