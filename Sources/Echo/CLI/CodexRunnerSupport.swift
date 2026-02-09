import Foundation

struct CodexRunResult {
    let stdout: String
    let stderr: String
    let exitCode: Int32
    let tokenUsage: CodexTokenUsage?
}

struct CodexTokenUsage: Equatable {
    let inputTokens: Int?
    let outputTokens: Int?
    let totalTokens: Int?
}

enum CodexRunError: LocalizedError {
    case timedOut

    var errorDescription: String? {
        switch self {
        case .timedOut:
            return "Codex execution timed out."
        }
    }
}

func enrichedEnvironment() -> [String: String] {
    var env = ProcessInfo.processInfo.environment
    let existing = env["PATH"] ?? ""
    let required = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]

    var merged: [String] = []
    for segment in existing.split(separator: ":").map(String.init) where !segment.isEmpty {
        if !merged.contains(segment) {
            merged.append(segment)
        }
    }
    for segment in required where !merged.contains(segment) {
        merged.append(segment)
    }

    env["PATH"] = merged.joined(separator: ":")
    return env
}

func normalizeOutput(_ value: String) -> String {
    if value.isEmpty { return "" }

    let ansiPattern = "\u{001B}\\[[0-9;?]*[ -/]*[@-~]"
    return value
        .replacingOccurrences(of: ansiPattern, with: "", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

func cleanupTempFiles(_ urls: [URL]) {
    for url in urls {
        try? FileManager.default.removeItem(at: url)
    }
}

func composePrompt(command: String, selectedText: String?, action: CopilotAction) -> String {
    let trimmedCommand = command.trimmingCharacters(in: .whitespacesAndNewlines)
    let normalizedSelection = selectedText?.trimmingCharacters(in: .whitespacesAndNewlines)

    switch action {
    case .edit:
        guard let normalizedSelection, !normalizedSelection.isEmpty else {
            return trimmedCommand
        }
        return """
        User instruction:
        \(trimmedCommand)

        Selected text:
        <<<
        \(normalizedSelection)
        >>>

        Apply the instruction to the selected text above.
        Preserve paragraph and line-break structure when it is present.
        If line breaks are ambiguous, format into readable sentence/paragraph breaks.
        Return only the final result text.
        """

    case .askQuestion:
        guard let normalizedSelection, !normalizedSelection.isEmpty else {
            return trimmedCommand
        }
        return """
        Question:
        \(trimmedCommand)

        Context:
        <<<
        \(normalizedSelection)
        >>>

        Use the context above to answer the question.
        Keep the response readable with clear paragraph/line breaks.
        If context is insufficient, say so briefly.
        """
    }
}
