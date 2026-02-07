import Foundation

struct CLIRunnerResult {
    let stdout: String
    let stderr: String
    let exitCode: Int32
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
    func run(command: String, timeout: TimeInterval = 60) async throws -> CLIRunnerResult {
        try await Task.detached(priority: .userInitiated) {
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
                try? stdoutWriter.close()
                try? stderrWriter.close()
                cleanupTempFiles([outputFileURL, stdoutFileURL, stderrFileURL])
            }

            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.arguments = [
                "codex",
                "exec",
                "--skip-git-repo-check",
                "--color",
                "never",
                "--output-last-message",
                outputFileURL.path,
                "-"
            ]
            process.environment = enrichedEnvironment()
            process.standardOutput = stdoutWriter
            process.standardError = stderrWriter
            process.standardInput = stdinPipe

            do {
                try process.run()
                if let input = "\(command)\n".data(using: .utf8) {
                    stdinPipe.fileHandleForWriting.write(input)
                }
                try stdinPipe.fileHandleForWriting.close()
            } catch {
                throw CLIRunnerError.launchFailed(error.localizedDescription)
            }

            let deadline = Date().addingTimeInterval(timeout)
            while process.isRunning {
                if Date() >= deadline {
                    process.terminate()
                    throw CLIRunnerError.timedOut
                }
                try await Task.sleep(nanoseconds: 50_000_000)
            }

            let outputFromFile = normalizeOutput(
                (try? String(contentsOf: outputFileURL, encoding: .utf8)) ?? ""
            )
            let outputFromStdout = normalizeOutput(
                (try? String(contentsOf: stdoutFileURL, encoding: .utf8)) ?? ""
            )
            let stderr = normalizeOutput(
                (try? String(contentsOf: stderrFileURL, encoding: .utf8)) ?? ""
            )
            let stdout = outputFromFile.isEmpty ? outputFromStdout : outputFromFile
            let exitCode = process.terminationStatus

            if exitCode != 0, stderr.isEmpty {
                let pathInfo = process.environment?["PATH"] ?? "(missing)"
                return CLIRunnerResult(
                    stdout: stdout,
                    stderr: "codex exec failed (exit \(exitCode)). PATH=\(pathInfo)",
                    exitCode: exitCode
                )
            }

            return CLIRunnerResult(
                stdout: stdout,
                stderr: stderr,
                exitCode: exitCode
            )
        }.value
    }
}

private func enrichedEnvironment() -> [String: String] {
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

private func normalizeOutput(_ value: String) -> String {
    if value.isEmpty { return "" }

    let ansiPattern = #"\u{001B}\[[0-9;?]*[ -/]*[@-~]"#
    return value
        .replacingOccurrences(of: ansiPattern, with: "", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

private func cleanupTempFiles(_ urls: [URL]) {
    for url in urls {
        try? FileManager.default.removeItem(at: url)
    }
}
