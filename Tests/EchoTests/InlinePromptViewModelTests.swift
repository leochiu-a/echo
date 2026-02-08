import Foundation
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

@Test
@MainActor
func executeSuccessUsesResolvedSlashCommandAndRecordsHistory() async throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let historyStore = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 10
    )
    let settingsStore = AppSettingsStore(defaults: defaults)
    settingsStore.slashCommands = [
        SlashCommandSetting(command: "reply", prompt: "Draft a response:\n\n{{input}}")
    ]

    let appServerRunner = AppServerRunnerStub { command, selectedText, action, onTextDelta in
        #expect(command == "Draft a response:\n\nThanks for the update")
        #expect(selectedText == "source text")
        #expect(action == CopilotAction.askQuestion)
        await onTextDelta?("delta output")
        return CLIRunnerResult(
            stdout: "final output",
            stderr: "",
            exitCode: 0,
            tokenUsage: CLITokenUsage(inputTokens: 12, outputTokens: 8, totalTokens: 20)
        )
    }

    let viewModel = InlinePromptViewModel(
        appServerRunner: appServerRunner,
        historyStore: historyStore,
        settingsStore: settingsStore
    )

    viewModel.prepareForPresentation(selectedText: "source text", hasEditableSelection: true)
    viewModel.selectedAction = CopilotAction.askQuestion
    viewModel.commandText = "/reply Thanks for the update"
    viewModel.execute()

    await waitForExecutionToFinish(viewModel)

    #expect(!viewModel.isRunning)
    #expect(viewModel.errorText == nil)
    #expect(viewModel.outputText == "final output")
    #expect(historyStore.commands.last == "/reply Thanks for the update")

    let entry = try #require(historyStore.entries.first)
    #expect(entry.status == PromptHistoryStatus.succeeded)
    #expect(entry.responseText == "final output")
    #expect(entry.inputTokens == 12)
    #expect(entry.outputTokens == 8)
    #expect(entry.totalTokens == 20)
}

@Test
@MainActor
func executeFailureUsesFallbackErrorWhenStderrIsEmpty() async throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let historyStore = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 10
    )
    let settingsStore = AppSettingsStore(defaults: defaults)

    let appServerRunner = AppServerRunnerStub { _, _, _, _ in
        CLIRunnerResult(stdout: "", stderr: "", exitCode: 2, tokenUsage: nil)
    }

    let viewModel = InlinePromptViewModel(
        appServerRunner: appServerRunner,
        historyStore: historyStore,
        settingsStore: settingsStore
    )
    viewModel.commandText = "rewrite this paragraph"
    viewModel.execute()

    await waitForExecutionToFinish(viewModel)

    #expect(viewModel.errorText == "Execution exited with code 2.")
    let entry = try #require(historyStore.entries.first)
    #expect(entry.status == PromptHistoryStatus.failed)
    #expect(entry.detail == "Execution exited with code 2.")
}

@Test
@MainActor
func executeCancellationRecordsCancelledStatus() async throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let historyStore = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 10
    )
    let settingsStore = AppSettingsStore(defaults: defaults)

    let appServerRunner = AppServerRunnerStub { _, _, _, _ in
        try await Task.sleep(nanoseconds: 1_000_000_000)
        return CLIRunnerResult(stdout: "", stderr: "", exitCode: 0, tokenUsage: nil)
    }

    let viewModel = InlinePromptViewModel(
        appServerRunner: appServerRunner,
        historyStore: historyStore,
        settingsStore: settingsStore
    )

    viewModel.commandText = "long running command"
    viewModel.execute()
    await waitUntil({ viewModel.isRunning })
    viewModel.cancelExecution()
    await waitUntil({ !viewModel.isRunning })
    await waitUntil({ !historyStore.entries.isEmpty })

    #expect(viewModel.errorText == "Stopped.")
    let entry = try #require(historyStore.entries.first)
    #expect(entry.status == PromptHistoryStatus.cancelled)
    #expect(entry.detail == "Execution stopped.")
}

@Test
@MainActor
func historyNavigationMovesAcrossSavedCommands() throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let historyStore = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 10
    )
    historyStore.rememberCommand("first")
    historyStore.rememberCommand("second")
    historyStore.rememberCommand("third")

    let viewModel = InlinePromptViewModel(
        appServerRunner: AppServerRunnerStub(),
        historyStore: historyStore,
        settingsStore: AppSettingsStore(defaults: defaults)
    )

    viewModel.historyUp()
    #expect(viewModel.commandText == "third")

    viewModel.historyUp()
    #expect(viewModel.commandText == "second")

    viewModel.historyDown()
    #expect(viewModel.commandText == "third")

    viewModel.historyDown()
    #expect(viewModel.commandText.isEmpty)
}

@Test
@MainActor
func slashAutocompleteSelectionAndApplyFlow() throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let settingsStore = AppSettingsStore(defaults: defaults)
    settingsStore.slashCommands = [
        SlashCommandSetting(command: "reply", prompt: "reply prompt"),
        SlashCommandSetting(command: "rewrite", prompt: "rewrite prompt")
    ]

    let viewModel = InlinePromptViewModel(
        appServerRunner: AppServerRunnerStub(),
        historyStore: PromptHistoryStore(defaults: defaults, storageNamespace: suiteName),
        settingsStore: settingsStore
    )

    viewModel.commandText = "  /re"

    #expect(viewModel.isShowingSlashAutocomplete)
    #expect(viewModel.slashSuggestions.count == 2)
    #expect(viewModel.slashSuggestions.map { $0.command } == ["reply", "rewrite"])

    #expect(viewModel.moveSlashSelectionDown())
    #expect(viewModel.highlightedSlashSuggestionIndex == 1)

    #expect(viewModel.moveSlashSelectionUp())
    #expect(viewModel.highlightedSlashSuggestionIndex == 0)

    viewModel.highlightSlashSuggestion(at: 1)
    #expect(viewModel.applyHighlightedSlashSuggestion())
    #expect(viewModel.commandText == "  /rewrite ")
}

@Test
@MainActor
func computedLabelsAndPromptPreviewAreExposed() {
    var suggestion = SlashCommandAutocompleteSuggestion(
        id: UUID(),
        command: "reply",
        prompt: String(repeating: "a", count: 110)
    )
    #expect(suggestion.promptPreview.count == 96)

    let viewModel = InlinePromptViewModel()
    viewModel.prepareForPresentation(selectedText: "abc", hasEditableSelection: true)
    viewModel.selectedAction = .edit
    #expect(viewModel.actionLabel == "Edit Selection")

    viewModel.commandText = "/missing"
    #expect(!viewModel.isShowingSlashAutocomplete)

    suggestion = SlashCommandAutocompleteSuggestion(
        id: UUID(),
        command: "reply",
        prompt: "single line"
    )
    #expect(suggestion.promptPreview == "single line")
}

@MainActor
private func waitForExecutionToFinish(_ viewModel: InlinePromptViewModel) async {
    await waitUntil { !viewModel.isRunning }
}

@MainActor
private func waitUntil(_ condition: @escaping @MainActor () -> Bool) async {
    for _ in 0..<200 {
        if condition() {
            return
        }
        try? await Task.sleep(nanoseconds: 10_000_000)
    }
}

private final class AppServerRunnerStub: AppServerRunning {
    typealias Handler = (
        String,
        String?,
        CopilotAction,
        (@Sendable (String) async -> Void)?
    ) async throws -> CLIRunnerResult

    private let handler: Handler

    init(handler: @escaping Handler = { _, _, _, _ in
        CLIRunnerResult(stdout: "", stderr: "", exitCode: 0, tokenUsage: nil)
    }) {
        self.handler = handler
    }

    func run(
        command: String,
        selectedText: String?,
        action: CopilotAction,
        onTextDelta: (@Sendable (String) async -> Void)?
    ) async throws -> CLIRunnerResult {
        try await handler(command, selectedText, action, onTextDelta)
    }
}
