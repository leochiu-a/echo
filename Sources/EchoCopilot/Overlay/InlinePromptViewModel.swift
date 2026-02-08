import Combine
import Foundation

enum OutputApplyMode {
    case replace
    case insert
}

@MainActor
final class InlinePromptViewModel: ObservableObject {
    @Published var commandText = ""
    @Published var outputText = ""
    @Published var isRunning = false
    @Published var errorText: String?
    @Published var selectedContextInfo: String?
    @Published var hasSelectionContext = false
    @Published var hasEditableSelection = false
    @Published var selectedAction: CopilotAction = .edit
    @Published var focusRequestID = UUID()
    @Published var isComposingInput = false

    var onRequestClose: (() -> Void)?
    var onRequestAccept: ((String, OutputApplyMode) -> Void)?

    private let cliRunner: CLIRunner
    private let historyStore: PromptHistoryStore
    private var historyIndex: Int?
    private var runningTask: Task<Void, Never>?
    private var selectedContextText: String?

    init(
        cliRunner: CLIRunner = CLIRunner(),
        historyStore: PromptHistoryStore? = nil
    ) {
        self.cliRunner = cliRunner
        self.historyStore = historyStore ?? .shared
    }

    var actionLabel: String {
        selectedAction.title(hasSelection: hasSelectionContext)
    }

    var canShowApplyButtons: Bool {
        hasEditableSelection && !outputText.isEmpty
    }

    deinit {
        runningTask?.cancel()
    }

    func prepareForPresentation(selectedText: String?, hasEditableSelection: Bool) {
        outputText = ""
        errorText = nil
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
                let result = try await cliRunner.run(
                    command: trimmed,
                    selectedText: selectedContextText,
                    action: action
                )
                guard !Task.isCancelled else { return }

                if result.exitCode == 0 {
                    outputText = result.stdout
                    historyStore.recordExecution(
                        command: trimmed,
                        action: action,
                        usedSelectionContext: usesSelectionContext,
                        status: .succeeded,
                        detail: successDetail(for: result.stdout),
                        responseText: result.stdout
                    )
                } else {
                    let failure = result.stderr.isEmpty
                        ? "CLI exited with code \(result.exitCode)."
                        : result.stderr
                    errorText = failure
                    historyStore.recordExecution(
                        command: trimmed,
                        action: action,
                        usedSelectionContext: usesSelectionContext,
                        status: .failed,
                        detail: summarizedFailureDetail(from: failure),
                        responseText: nil
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

    func historyUp() {
        let history = historyStore.commands
        guard !history.isEmpty else { return }
        if let historyIndex {
            self.historyIndex = max(historyIndex - 1, 0)
        } else {
            self.historyIndex = history.count - 1
        }
        if let historyIndex {
            commandText = history[historyIndex]
        }
    }

    func historyDown() {
        let history = historyStore.commands
        guard !history.isEmpty, let historyIndex else { return }
        let next = historyIndex + 1
        if next >= history.count {
            self.historyIndex = nil
            commandText = ""
            return
        }
        self.historyIndex = next
        commandText = history[next]
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
