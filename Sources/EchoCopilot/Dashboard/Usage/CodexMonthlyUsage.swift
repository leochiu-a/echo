import Foundation
import SwiftUI

@MainActor
final class CodexMonthlyUsageViewModel: ObservableObject {
    @Published private(set) var monthlyUsages: [CodexMonthlyUsage] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorText: String?
    @Published private(set) var lastUpdatedAt: Date?
    @Published private(set) var totalCostUSD: Double?

    private var runningTask: Task<Void, Never>?

    deinit {
        runningTask?.cancel()
    }

    func refresh() {
        guard !isLoading else { return }
        isLoading = true
        errorText = nil

        runningTask?.cancel()
        runningTask = Task { [weak self] in
            guard let self else { return }
            defer {
                isLoading = false
                runningTask = nil
            }

            do {
                let report = try await fetchCodexMonthlyUsageReport()
                guard !Task.isCancelled else { return }
                monthlyUsages = report.monthly
                totalCostUSD = report.totals?.costUSD
                lastUpdatedAt = Date()
            } catch is CancellationError {
                return
            } catch {
                errorText = summarizeCodexUsageError(error)
            }
        }
    }
}

struct CodexMonthlyUsage: Codable, Equatable, Identifiable {
    let month: String
    let inputTokens: Int
    let outputTokens: Int
    let totalTokens: Int
    let costUSD: Double?

    var id: String { month }
}

struct CodexMonthlyUsageTotals: Codable, Equatable {
    let costUSD: Double?
}

struct CodexMonthlyUsageReport: Codable, Equatable {
    let monthly: [CodexMonthlyUsage]
    let totals: CodexMonthlyUsageTotals?
}

func fetchCodexMonthlyUsageReport(timeout: TimeInterval = 35) async throws -> CodexMonthlyUsageReport {
    let process = Process()
    let stdoutPipe = Pipe()
    let stderrPipe = Pipe()

    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = [
        "npx",
        "--yes",
        "@ccusage/codex@latest",
        "monthly",
        "--json"
    ]
    process.environment = enrichedEnvironment()
    process.standardOutput = stdoutPipe
    process.standardError = stderrPipe

    do {
        try process.run()
    } catch {
        throw NSError(
            domain: "CodexMonthlyUsage",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Failed to run npx: \(error.localizedDescription)"]
        )
    }

    let deadline = Date().addingTimeInterval(timeout)
    while process.isRunning {
        if Task.isCancelled {
            process.terminate()
            throw CancellationError()
        }
        if Date() >= deadline {
            process.terminate()
            throw NSError(
                domain: "CodexMonthlyUsage",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Loading Codex usage timed out."]
            )
        }
        try await Task.sleep(nanoseconds: 50_000_000)
    }

    let stdout = String(data: stdoutPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
    let stderr = String(data: stderrPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
    let normalizedStdout = normalizeOutput(stdout)
    let normalizedStderr = normalizeOutput(stderr)

    guard process.terminationStatus == 0 else {
        let detail = normalizedStderr.isEmpty
            ? "npx command failed with exit code \(process.terminationStatus)."
            : normalizedStderr
        throw NSError(
            domain: "CodexMonthlyUsage",
            code: Int(process.terminationStatus),
            userInfo: [NSLocalizedDescriptionKey: detail]
        )
    }

    guard let data = normalizedStdout.data(using: .utf8), !data.isEmpty else {
        throw NSError(
            domain: "CodexMonthlyUsage",
            code: 3,
            userInfo: [NSLocalizedDescriptionKey: "No JSON output from Codex usage command."]
        )
    }

    do {
        return try JSONDecoder().decode(CodexMonthlyUsageReport.self, from: data)
    } catch {
        throw NSError(
            domain: "CodexMonthlyUsage",
            code: 4,
            userInfo: [NSLocalizedDescriptionKey: "Unable to parse Codex usage JSON."]
        )
    }
}

func summarizeCodexUsageError(_ error: Error) -> String {
    let message = error.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
    if message.isEmpty {
        return "Failed to load Codex monthly usage."
    }
    if message.count <= 180 {
        return message
    }
    return "\(message.prefix(177))..."
}
