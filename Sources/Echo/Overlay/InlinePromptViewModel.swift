import Combine
import Foundation

enum OutputApplyMode {
    case replace
    case insert
}

struct SlashCommandAutocompleteSuggestion: Identifiable, Equatable {
    let id: UUID
    let command: String
    let prompt: String

    var promptPreview: String {
        let singleLine = prompt.replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if singleLine.count <= 96 {
            return singleLine
        }
        return "\(singleLine.prefix(93))..."
    }
}

@MainActor
final class InlinePromptViewModel: ObservableObject {
    @Published var commandText = "" {
        didSet { handleCommandTextChanged() }
    }
    @Published var outputText = ""
    @Published var isRunning = false
    @Published var errorText: String?
    @Published var selectedContextInfo: String?
    @Published var hasSelectionContext = false
    @Published var hasEditableSelection = false
    @Published var selectedAction: CopilotAction = .edit
    @Published var focusRequestID = UUID()
    @Published var isComposingInput = false
    @Published private(set) var copyFeedbackText: String?
    @Published private(set) var slashSuggestions: [SlashCommandAutocompleteSuggestion] = []
    @Published private(set) var highlightedSlashSuggestionIndex = 0

    var onRequestClose: (() -> Void)?
    var onRequestAccept: ((String, OutputApplyMode) -> Void)?

    private let appServerRunner: any AppServerRunning
    private let historyStore: PromptHistoryStore
    private let settingsStore: AppSettingsStore
    private var historyIndex: Int?
    private var runningTask: Task<Void, Never>?
    private var copyFeedbackHideTask: Task<Void, Never>?
    private var selectedContextText: String?
    private var cancellables = Set<AnyCancellable>()
    private var suppressHistoryReset = false

    init(
        appServerRunner: any AppServerRunning = AppServerRunner(),
        historyStore: PromptHistoryStore? = nil,
        settingsStore: AppSettingsStore? = nil
    ) {
        self.appServerRunner = appServerRunner
        self.historyStore = historyStore ?? .shared
        self.settingsStore = settingsStore ?? .shared

        self.settingsStore.$slashCommands
            .sink { [weak self] _ in
                self?.refreshSlashAutocomplete()
            }
            .store(in: &cancellables)
    }

    var actionLabel: String {
        selectedAction.title(hasSelection: hasSelectionContext)
    }

    var canShowApplyButtons: Bool {
        hasEditableSelection && !outputText.isEmpty
    }

    var isShowingSlashAutocomplete: Bool {
        !slashSuggestions.isEmpty
    }

    var copyableOutputText: String? {
        guard !outputText.isEmpty else { return nil }
        return outputText
    }

    deinit {
        runningTask?.cancel()
        copyFeedbackHideTask?.cancel()
    }

    func prepareForPresentation(selectedText: String?, hasEditableSelection: Bool) {
        outputText = ""
        errorText = nil
        copyFeedbackText = nil
        copyFeedbackHideTask?.cancel()
        copyFeedbackHideTask = nil
        focusRequestID = UUID()
        isComposingInput = false
        selectedAction = .edit
        historyIndex = nil
        selectedContextText = selectedText
        hasSelectionContext = selectedText != nil
        self.hasEditableSelection = hasEditableSelection
        if let selectedText {
            selectedContextInfo = "Using selected text context (\(selectedText.count) chars)"
        } else {
            selectedContextInfo = nil
        }
        refreshSlashAutocomplete()
    }

    func execute() {
        let trimmed = commandText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard !isRunning else { return }
        let action = selectedAction
        let usesSelectionContext = hasSelectionContext

        isRunning = true
        errorText = nil
        outputText = ""
        historyIndex = nil
        historyStore.rememberCommand(trimmed)

        runningTask?.cancel()
        runningTask = Task { [weak self] in
            guard let self else { return }
            do {
                let resolvedCommand = resolveSlashCommandPrompt(
                    input: trimmed,
                    commands: settingsStore.availableSlashCommands()
                )
                let result = try await appServerRunner.run(
                    command: resolvedCommand,
                    selectedText: selectedContextText,
                    action: action,
                    onTextDelta: { [weak self] delta in
                    await MainActor.run {
                        guard let self, self.isRunning else { return }
                        self.outputText.append(delta)
                    }
                })
                guard !Task.isCancelled else { return }

                if result.exitCode == 0 {
                    let finalOutput: String
                    if result.stdout.isEmpty {
                        finalOutput = outputText
                    } else {
                        finalOutput = result.stdout
                    }
                    outputText = finalOutput
                    historyStore.recordExecution(
                        command: trimmed,
                        action: action,
                        usedSelectionContext: usesSelectionContext,
                        status: .succeeded,
                        detail: successDetail(for: finalOutput),
                        responseText: finalOutput,
                        inputTokens: result.tokenUsage?.inputTokens,
                        outputTokens: result.tokenUsage?.outputTokens,
                        totalTokens: result.tokenUsage?.totalTokens
                    )
                } else {
                    let failure = result.stderr.isEmpty
                        ? "Execution exited with code \(result.exitCode)."
                        : result.stderr
                    errorText = failure
                    historyStore.recordExecution(
                        command: trimmed,
                        action: action,
                        usedSelectionContext: usesSelectionContext,
                        status: .failed,
                        detail: summarizedFailureDetail(from: failure),
                        responseText: nil,
                        inputTokens: result.tokenUsage?.inputTokens,
                        outputTokens: result.tokenUsage?.outputTokens,
                        totalTokens: result.tokenUsage?.totalTokens
                    )
                }
            } catch is CancellationError {
                historyStore.recordExecution(
                    command: trimmed,
                    action: action,
                    usedSelectionContext: usesSelectionContext,
                    status: .cancelled,
                    detail: "Execution stopped.",
                    responseText: nil
                )
            } catch {
                guard !Task.isCancelled else { return }
                errorText = error.localizedDescription
                historyStore.recordExecution(
                    command: trimmed,
                    action: action,
                    usedSelectionContext: usesSelectionContext,
                    status: .failed,
                    detail: summarizedFailureDetail(from: error.localizedDescription),
                    responseText: nil
                )
            }
            isRunning = false
            runningTask = nil
        }
    }

    func cancelExecution(showCancelledMessage: Bool = true) {
        guard isRunning else { return }
        runningTask?.cancel()
        runningTask = nil
        isRunning = false
        if showCancelledMessage {
            errorText = "Stopped."
        }
    }

    func close() {
        cancelExecution(showCancelledMessage: false)
        onRequestClose?()
    }

    func replaceOutput() {
        guard canShowApplyButtons else { return }
        let value = outputText.isEmpty ? commandText : outputText
        onRequestAccept?(value, .replace)
        onRequestClose?()
    }

    func insertOutput() {
        guard canShowApplyButtons else { return }
        let value = outputText.isEmpty ? commandText : outputText
        onRequestAccept?(value, .insert)
        onRequestClose?()
    }

    func showCopiedFeedback() {
        copyFeedbackHideTask?.cancel()
        copyFeedbackText = "Copied!"

        copyFeedbackHideTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 1_100_000_000)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard let self else { return }
                copyFeedbackText = nil
                copyFeedbackHideTask = nil
            }
        }
    }

    func historyUp() {
        let history = historyStore.commands
        guard !history.isEmpty else { return }
        if let historyIndex {
            self.historyIndex = max(historyIndex - 1, 0)
        } else {
            self.historyIndex = history.count - 1
        }
        if let historyIndex {
            setCommandTextWithoutResettingHistory(history[historyIndex])
        }
    }

    func historyDown() {
        let history = historyStore.commands
        guard !history.isEmpty, let historyIndex else { return }
        let next = historyIndex + 1
        if next >= history.count {
            self.historyIndex = nil
            setCommandTextWithoutResettingHistory("")
            return
        }
        self.historyIndex = next
        setCommandTextWithoutResettingHistory(history[next])
    }

    func moveSlashSelectionUp() -> Bool {
        guard !slashSuggestions.isEmpty else { return false }
        let count = slashSuggestions.count
        highlightedSlashSuggestionIndex = (highlightedSlashSuggestionIndex - 1 + count) % count
        return true
    }

    func moveSlashSelectionDown() -> Bool {
        guard !slashSuggestions.isEmpty else { return false }
        let count = slashSuggestions.count
        highlightedSlashSuggestionIndex = (highlightedSlashSuggestionIndex + 1) % count
        return true
    }

    func selectSlashSuggestion(at index: Int) {
        guard slashSuggestions.indices.contains(index) else { return }
        highlightedSlashSuggestionIndex = index
        _ = applyHighlightedSlashSuggestion()
    }

    func highlightSlashSuggestion(at index: Int) {
        guard slashSuggestions.indices.contains(index) else { return }
        highlightedSlashSuggestionIndex = index
    }

    func applyHighlightedSlashSuggestion() -> Bool {
        guard slashSuggestions.indices.contains(highlightedSlashSuggestionIndex) else { return false }
        guard let context = slashAutocompleteContext(in: commandText) else { return false }
        let suggestion = slashSuggestions[highlightedSlashSuggestionIndex]
        commandText = "\(context.leadingWhitespace)/\(suggestion.command) "
        return true
    }

    private func successDetail(for output: String) -> String {
        let length = output.trimmingCharacters(in: .whitespacesAndNewlines).count
        if length == 0 {
            return "Completed with empty output."
        }
        return "Generated \(length) chars."
    }

    private func summarizedFailureDetail(from rawMessage: String) -> String {
        summarizeCLIErrorMessage(rawMessage)
    }

    private func handleCommandTextChanged() {
        if !suppressHistoryReset {
            historyIndex = nil
        }
        refreshSlashAutocomplete()
    }

    private func setCommandTextWithoutResettingHistory(_ value: String) {
        suppressHistoryReset = true
        commandText = value
        suppressHistoryReset = false
    }

    private func refreshSlashAutocomplete() {
        guard let context = slashAutocompleteContext(in: commandText) else {
            slashSuggestions = []
            highlightedSlashSuggestionIndex = 0
            return
        }

        let query = context.query.lowercased()
        let commands = settingsStore.availableSlashCommands()
            .filter { query.isEmpty || $0.command.hasPrefix(query) }
            .sorted { $0.command.localizedCaseInsensitiveCompare($1.command) == .orderedAscending }
            .prefix(8)

        let mapped = commands.map {
            SlashCommandAutocompleteSuggestion(id: $0.id, command: $0.command, prompt: $0.prompt)
        }
        slashSuggestions = Array(mapped)

        if slashSuggestions.isEmpty {
            highlightedSlashSuggestionIndex = 0
            return
        }

        if highlightedSlashSuggestionIndex >= slashSuggestions.count {
            highlightedSlashSuggestionIndex = slashSuggestions.count - 1
        }
    }
}

private struct SlashAutocompleteContext {
    let leadingWhitespace: String
    let query: String
}

private func slashAutocompleteContext(in text: String) -> SlashAutocompleteContext? {
    let leadingWhitespaceSlice = text.prefix { $0.isWhitespace || $0.isNewline }
    let leadingWhitespace = String(leadingWhitespaceSlice)
    guard leadingWhitespaceSlice.endIndex < text.endIndex else { return nil }
    let firstIndex = leadingWhitespaceSlice.endIndex
    guard text[firstIndex] == "/" else { return nil }

    let afterSlashIndex = text.index(after: firstIndex)
    guard afterSlashIndex <= text.endIndex else { return nil }
    let tail = text[afterSlashIndex...]

    if tail.contains(where: { $0.isWhitespace || $0.isNewline }) {
        return nil
    }

    return SlashAutocompleteContext(
        leadingWhitespace: leadingWhitespace,
        query: String(tail)
    )
}

func resolveSlashCommandPrompt(input: String, commands: [SlashCommandSetting]) -> String {
    let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedInput.isEmpty else { return trimmedInput }

    guard trimmedInput.first == "/" else { return trimmedInput }
    guard let separatorIndex = trimmedInput.firstIndex(where: { $0.isWhitespace || $0.isNewline }) else {
        let token = String(trimmedInput.dropFirst())
        return expandedPromptIfCommandMatches(
            token: token,
            remainder: "",
            commands: commands,
            fallback: trimmedInput
        )
    }

    let tokenRange = trimmedInput.index(after: trimmedInput.startIndex)..<separatorIndex
    let token = String(trimmedInput[tokenRange])
    let remainder = String(trimmedInput[separatorIndex...]).trimmingCharacters(in: .whitespacesAndNewlines)
    return expandedPromptIfCommandMatches(
        token: token,
        remainder: remainder,
        commands: commands,
        fallback: trimmedInput
    )
}

private func expandedPromptIfCommandMatches(
    token: String,
    remainder: String,
    commands: [SlashCommandSetting],
    fallback: String
) -> String {
    guard let normalizedToken = AppSettingsStore.normalizedSlashCommandName(for: token) else {
        return fallback
    }
    guard let matched = commands.first(where: { $0.command == normalizedToken }) else {
        return fallback
    }

    let prompt = matched.prompt.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !prompt.isEmpty else { return fallback }

    if prompt.contains("{{input}}") {
        return prompt.replacingOccurrences(of: "{{input}}", with: remainder)
    }

    guard !remainder.isEmpty else { return prompt }
    return "\(prompt)\n\n\(remainder)"
}

func summarizeCLIErrorMessage(_ rawMessage: String) -> String {
    if let apiDetail = extractAPIDetail(from: rawMessage) {
        return clippedErrorMessage(apiDetail)
    }

    let lines = rawMessage
        .split(whereSeparator: \.isNewline)
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }

    let message =
        lines.first(where: isLikelyErrorLine)
        ?? lines.first(where: { !isLikelyNoiseLine($0) })
        ?? "Execution failed."

    return clippedErrorMessage(message.replacingOccurrences(of: "ERROR:", with: "").trimmingCharacters(in: .whitespacesAndNewlines))
}

private func extractAPIDetail(from rawMessage: String) -> String? {
    guard let startRange = rawMessage.range(of: "\"detail\":\"") else {
        return nil
    }
    let suffix = rawMessage[startRange.upperBound...]
    guard let endIndex = suffix.firstIndex(of: "\"") else {
        return nil
    }
    let detail = String(suffix[..<endIndex]).trimmingCharacters(in: .whitespacesAndNewlines)
    return detail.isEmpty ? nil : detail
}

private func isLikelyErrorLine(_ line: String) -> Bool {
    let lowered = line.lowercased()
    return lowered.contains("error")
        || lowered.contains("failed")
        || lowered.contains("not supported")
        || lowered.contains("timed out")
        || lowered.contains("unauthorized")
        || lowered.contains("forbidden")
}

private func isLikelyNoiseLine(_ line: String) -> Bool {
    let lowered = line.lowercased()
    if lowered.hasPrefix("openai codex v") { return true }
    if lowered == "--------" { return true }
    if lowered.hasPrefix("workdir:") { return true }
    if lowered.hasPrefix("model:") { return true }
    if lowered.hasPrefix("provider:") { return true }
    if lowered.hasPrefix("approval:") { return true }
    if lowered.hasPrefix("sandbox:") { return true }
    if lowered.hasPrefix("reasoning effort:") { return true }
    if lowered.hasPrefix("reasoning summaries:") { return true }
    if lowered.hasPrefix("session id:") { return true }
    if lowered.hasPrefix("mcp:") { return true }
    if lowered.hasPrefix("mcp startup:") { return true }
    if lowered.hasPrefix("tokens used") { return true }
    if lowered == "user" || lowered == "codex" || lowered == "thinking" { return true }
    return lowered.hasPrefix("20") && lowered.contains(" warn ")
}

private func clippedErrorMessage(_ message: String) -> String {
    let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
    let normalized = trimmed.isEmpty ? "Execution failed." : trimmed
    if normalized.count <= 160 {
        return normalized
    }
    let limited = String(normalized.prefix(157))
    return "\(limited)..."
}
