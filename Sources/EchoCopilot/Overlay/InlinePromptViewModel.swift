import Combine
import Foundation

@MainActor
final class InlinePromptViewModel: ObservableObject {
    @Published var commandText = ""
    @Published var outputText = ""
    @Published var isRunning = false
    @Published var errorText: String?
    @Published var selectedContextInfo: String?

    var onRequestClose: (() -> Void)?
    var onRequestAccept: ((String) -> Void)?

    private let cliRunner = CLIRunner()
    private var history: [String] = []
    private var historyIndex: Int?
    private var runningTask: Task<Void, Never>?
    private var selectedContextText: String?

    deinit {
        runningTask?.cancel()
    }

    func prepareForPresentation(selectedText: String?) {
        errorText = nil
        historyIndex = nil
        selectedContextText = selectedText
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
                    selectedText: selectedContextText
                )
                guard !Task.isCancelled else { return }

                if result.exitCode == 0 {
                    outputText = result.stdout
                } else {
                    errorText = result.stderr.isEmpty
                        ? "CLI exited with code \(result.exitCode)."
                        : result.stderr
                }
            } catch {
                guard !Task.isCancelled else { return }
                errorText = error.localizedDescription
            }
            isRunning = false
        }
    }

    func close() {
        runningTask?.cancel()
        onRequestClose?()
    }

    func accept() {
        let value = outputText.isEmpty ? commandText : outputText
        onRequestAccept?(value)
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
