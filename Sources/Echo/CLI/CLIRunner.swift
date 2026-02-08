import Foundation

struct CLIRunnerResult {
    let stdout: String
    let stderr: String
    let exitCode: Int32
    let tokenUsage: CLITokenUsage?
}

struct CLITokenUsage: Equatable {
    let inputTokens: Int?
    let outputTokens: Int?
    let totalTokens: Int?
}

enum CLIRunnerError: LocalizedError {
    case timedOut
    case launchFailed(String)

    var errorDescription: String? {
        switch self {
        case .timedOut:
            return "CLI execution timed out."
        case .launchFailed(let message):
            return "Failed to launch CLI: \(message)"
        }
    }
}

final class CLIRunner {
    func run(
        command: String,
        selectedText: String? = nil,
        action: CopilotAction = .edit,
        timeout: TimeInterval = 60
    ) async throws -> CLIRunnerResult {
        let process = Process()
        let stdinPipe = Pipe()
        let outputFileURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("echo-copilot-last-message-\(UUID().uuidString).txt")
        let stdoutFileURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("echo-copilot-stdout-\(UUID().uuidString).log")
        let stderrFileURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("echo-copilot-stderr-\(UUID().uuidString).log")

        FileManager.default.createFile(atPath: stdoutFileURL.path, contents: nil)
        FileManager.default.createFile(atPath: stderrFileURL.path, contents: nil)

        let stdoutWriter = try FileHandle(forWritingTo: stdoutFileURL)
        let stderrWriter = try FileHandle(forWritingTo: stderrFileURL)
        defer {
            if process.isRunning {
                process.terminate()
            }
            try? stdoutWriter.close()
            try? stderrWriter.close()
            cleanupTempFiles([outputFileURL, stdoutFileURL, stderrFileURL])
        }

        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        var arguments = [
            "codex",
            "exec",
            "--skip-git-repo-check",
            "--color",
            "never"
        ]

        let configuredModel = await MainActor.run {
            AppSettingsStore.shared.codexModel.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if !configuredModel.isEmpty {
            arguments.append(contentsOf: ["--model", configuredModel])
        }

        arguments.append(contentsOf: ["--output-last-message", outputFileURL.path, "-"])
        process.arguments = arguments
        process.environment = enrichedEnvironment()
        process.standardOutput = stdoutWriter
        process.standardError = stderrWriter
        process.standardInput = stdinPipe

        do {
            try process.run()
            let composedPrompt = composePrompt(command: command, selectedText: selectedText, action: action)
            if let input = "\(composedPrompt)\n".data(using: .utf8) {
                stdinPipe.fileHandleForWriting.write(input)
            }
            try stdinPipe.fileHandleForWriting.close()
        } catch {
            throw CLIRunnerError.launchFailed(error.localizedDescription)
        }

        let deadline = Date().addingTimeInterval(timeout)
        while process.isRunning {
            if Task.isCancelled {
                process.terminate()
                throw CancellationError()
            }
            if Date() >= deadline {
                process.terminate()
                throw CLIRunnerError.timedOut
            }
            do {
                try await Task.sleep(nanoseconds: 50_000_000)
            } catch is CancellationError {
                process.terminate()
                throw CancellationError()
            }
        }

        let outputFromFile = normalizeOutput(
            (try? String(contentsOf: outputFileURL, encoding: .utf8)) ?? ""
        )
        let rawStdout = (try? String(contentsOf: stdoutFileURL, encoding: .utf8)) ?? ""
        let rawStderr = (try? String(contentsOf: stderrFileURL, encoding: .utf8)) ?? ""
        let outputFromStdout = normalizeOutput(rawStdout)
        let stderr = normalizeOutput(rawStderr)
        let tokenUsage = parseCLITokenUsage(from: "\(rawStdout)\n\(rawStderr)")
        let stdout = outputFromFile.isEmpty ? outputFromStdout : outputFromFile
        let exitCode = process.terminationStatus

        if exitCode != 0, stderr.isEmpty {
            let pathInfo = process.environment?["PATH"] ?? "(missing)"
            return CLIRunnerResult(
                stdout: stdout,
                stderr: "codex exec failed (exit \(exitCode)). PATH=\(pathInfo)",
                exitCode: exitCode,
                tokenUsage: tokenUsage
            )
        }

        return CLIRunnerResult(
            stdout: stdout,
            stderr: stderr,
            exitCode: exitCode,
            tokenUsage: tokenUsage
        )
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

func parseCLITokenUsage(from rawLog: String) -> CLITokenUsage? {
    let text = normalizeOutput(rawLog)
    guard !text.isEmpty else { return nil }

    let inputTokens = firstCapturedTokenCount(
        in: text,
        patterns: [
            #"(?im)\binput\s*tokens?\b\s*[:=]\s*([0-9][0-9,_]*)"#,
            #"(?im)\bprompt\s*tokens?\b\s*[:=]\s*([0-9][0-9,_]*)"#,
            #"(?im)\binput\b\s*[:=]\s*([0-9][0-9,_]*)"#
        ]
    )
    let outputTokens = firstCapturedTokenCount(
        in: text,
        patterns: [
            #"(?im)\boutput\s*tokens?\b\s*[:=]\s*([0-9][0-9,_]*)"#,
            #"(?im)\bcompletion\s*tokens?\b\s*[:=]\s*([0-9][0-9,_]*)"#,
            #"(?im)\boutput\b\s*[:=]\s*([0-9][0-9,_]*)"#
        ]
    )

    var totalTokens = firstCapturedTokenCount(
        in: text,
        patterns: [
            #"(?im)\btotal\s*tokens?\b\s*[:=]\s*([0-9][0-9,_]*)"#,
            #"(?im)\btokens?\s*used\b\s*[:=]?\s*([0-9][0-9,_]*)"#
        ]
    )

    if totalTokens == nil {
        let computed = (inputTokens ?? 0) + (outputTokens ?? 0)
        totalTokens = computed > 0 ? computed : nil
    }

    guard inputTokens != nil || outputTokens != nil || totalTokens != nil else {
        return nil
    }

    return CLITokenUsage(
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        totalTokens: totalTokens
    )
}

private func firstCapturedTokenCount(in text: String, patterns: [String]) -> Int? {
    for pattern in patterns {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { continue }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let match = regex.firstMatch(in: text, options: [], range: range), match.numberOfRanges >= 2 else {
            continue
        }
        let captureRange = match.range(at: 1)
        guard let swiftRange = Range(captureRange, in: text) else { continue }
        if let value = parseTokenCountNumber(String(text[swiftRange])) {
            return value
        }
    }
    return nil
}

private func parseTokenCountNumber(_ rawValue: String) -> Int? {
    let normalized = rawValue.filter(\.isNumber)
    guard !normalized.isEmpty else { return nil }
    return Int(normalized)
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
