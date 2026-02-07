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
    func run(command: String, timeout: TimeInterval = 8) async throws -> CLIRunnerResult {
        try await Task.detached(priority: .userInitiated) {
            let process = Process()
            let stdoutPipe = Pipe()
            let stderrPipe = Pipe()

            process.executableURL = URL(fileURLWithPath: "/bin/echo")
            process.arguments = [command]
            process.standardOutput = stdoutPipe
            process.standardError = stderrPipe

            do {
                try process.run()
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

            let stdoutData = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
            let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
            let stdout = String(decoding: stdoutData, as: UTF8.self)
            let stderr = String(decoding: stderrData, as: UTF8.self)

            return CLIRunnerResult(
                stdout: stdout.trimmingCharacters(in: .whitespacesAndNewlines),
                stderr: stderr.trimmingCharacters(in: .whitespacesAndNewlines),
                exitCode: process.terminationStatus
            )
        }.value
    }
}
