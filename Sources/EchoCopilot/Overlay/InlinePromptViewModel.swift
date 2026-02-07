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

    private let cliRunner = CLIRunner()
    private var history: [String] = []
    private var historyIndex: Int?
    private var runningTask: Task<Void, Never>?
    private var selectedContextText: String?

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

        isRunning = true
        errorText = nil
        outputText = ""
        historyIndex = nil

        if history.last != trimmed {
            history.append(trimmed)
        }

        runningTask?.cancel()
        runningTask = Task { [weak self] in
            guard let self else { return }
            do {
                let result = try await cliRunner.run(
                    command: trimmed,
                    selectedText: selectedContextText,
                    action: selectedAction
                )
                guard !Task.isCancelled else { return }

                if result.exitCode == 0 {
                    outputText = result.stdout
                } else {
                    errorText = result.stderr.isEmpty
                        ? "CLI exited with code \(result.exitCode)."
                        : result.stderr
                }
            } catch is CancellationError {
                // Cancellation is a user action; keep panel open and show stop state.
            } catch {
                guard !Task.isCancelled else { return }
                errorText = error.localizedDescription
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
}
