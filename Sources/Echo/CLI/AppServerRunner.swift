import Foundation

protocol AppServerRunning {
    func run(
        command: String,
        selectedText: String?,
        action: CopilotAction,
        onTextDelta: (@Sendable (String) async -> Void)?
    ) async throws -> CLIRunnerResult
}

protocol AppServerPrewarming: AnyObject {
    func prewarm() async
}

enum AppServerRunnerError: LocalizedError {
    case launchFailed(String)
    case protocolError(String)

    var errorDescription: String? {
        switch self {
        case .launchFailed(let message):
            return "Failed to launch app server: \(message)"
        case .protocolError(let message):
            return "App server protocol error: \(message)"
        }
    }
}

private struct AppServerTurnOutcome {
    let output: String
    let tokenUsage: CLITokenUsage?
    let status: String
    let errorMessage: String?
}

private let codexAppServerLaunchCommand = "codex app-server"

private actor AppServerSession {
    static let shared = AppServerSession()

    private struct TurnState {
        let threadID: String
        var turnID: String?
        var output: String = ""
        var tokenUsage: CLITokenUsage?
        var errorMessage: String?
        let onTextDelta: (@Sendable (String) async -> Void)?
        let continuation: CheckedContinuation<AppServerTurnOutcome, Error>
    }

    private var process: Process?
    private var stdinHandle: FileHandle?
    private var readerTask: Task<Void, Never>?
    private var stderrURL: URL?
    private var stderrWriter: FileHandle?
    private var threadID: String?
    private var pendingRequests: [Int: CheckedContinuation<[String: Any], Error>] = [:]
    private var nextRequestID = 100
    private var currentTurn: TurnState?

    func executeTurn(
        prompt: String,
        model: String,
        reasoningEffort: String,
        onTextDelta: (@Sendable (String) async -> Void)?
    ) async throws -> AppServerTurnOutcome {
        try await ensureSession(model: model)

        guard let threadID else {
            throw AppServerRunnerError.protocolError("Missing app-server thread id.")
        }
        guard currentTurn == nil else {
            throw AppServerRunnerError.protocolError("Another app-server turn is in progress.")
        }

        return try await withCheckedThrowingContinuation { continuation in
            currentTurn = TurnState(
                threadID: threadID,
                turnID: nil,
                onTextDelta: onTextDelta,
                continuation: continuation
            )

            Task {
                do {
                    let response = try await self.sendRequest(
                        method: "turn/start",
                        params: turnStartParams(
                            threadID: threadID,
                            prompt: prompt,
                            model: model,
                            reasoningEffort: reasoningEffort
                        )
                    )
                    let responseTurnID = extractTurnID(fromTurnStartResponse: response)
                    await self.setCurrentTurnID(responseTurnID)
                } catch {
                    await self.finishCurrentTurn(with: .failure(error))
                }
            }
        }
    }

    func prewarm(model: String) async throws {
        try await ensureSession(model: model)
    }

    func resetSession() async {
        await teardownSession(error: AppServerRunnerError.protocolError("App-server session reset."))
    }

    func stderrSnapshot() -> String {
        guard let stderrURL else { return "" }
        return (try? String(contentsOf: stderrURL, encoding: .utf8)) ?? ""
    }

    private func ensureSession(model: String) async throws {
        if process?.isRunning == true,
           threadID != nil
        {
            return
        }

        await teardownSession(error: AppServerRunnerError.protocolError("App-server session restarted."))

        let process = Process()
        let stdinPipe = Pipe()
        let stdoutPipe = Pipe()
        let stderrURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("echo-copilot-app-server-stderr-\(UUID().uuidString).log")
        FileManager.default.createFile(atPath: stderrURL.path, contents: nil)
        let stderrWriter = try FileHandle(forWritingTo: stderrURL)

        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lc", codexAppServerLaunchCommand]
        process.environment = enrichedEnvironment()
        process.standardInput = stdinPipe
        process.standardOutput = stdoutPipe
        process.standardError = stderrWriter

        do {
            try process.run()
        } catch {
            try? stderrWriter.close()
            cleanupTempFiles([stderrURL])
            throw AppServerRunnerError.launchFailed(error.localizedDescription)
        }

        self.process = process
        self.stdinHandle = stdinPipe.fileHandleForWriting
        self.stderrURL = stderrURL
        self.stderrWriter = stderrWriter
        self.threadID = nil
        self.nextRequestID = 100
        self.pendingRequests = [:]
        self.currentTurn = nil

        let actor = self
        readerTask = Task {
            do {
                for try await rawLine in stdoutPipe.fileHandleForReading.bytes.lines {
                    await actor.handleIncomingLine(rawLine)
                }
                await actor.handleReaderEnded()
            } catch {
                await actor.handleReaderFailed(error)
            }
        }

        do {
            let initializeResponse = try await sendRequest(method: "initialize", params: initializeParams())
            try throwIfJSONRPCError(in: initializeResponse)
            try sendNotification(method: "initialized", params: nil)

            let threadResponse = try await sendRequest(
                method: "thread/start",
                params: threadStartParams(model: model)
            )
            try throwIfJSONRPCError(in: threadResponse)

            guard let resolvedThreadID = extractThreadID(fromThreadStartResponse: threadResponse) else {
                throw AppServerRunnerError.protocolError("Missing thread id from thread/start response.")
            }
            self.threadID = resolvedThreadID
        } catch {
            await teardownSession(error: error)
            throw error
        }
    }

    private func sendRequest(method: String, params: Any?) async throws -> [String: Any] {
        guard process?.isRunning == true else {
            throw AppServerRunnerError.protocolError("App-server process is not running.")
        }
        guard let stdinHandle else {
            throw AppServerRunnerError.protocolError("App-server stdin is unavailable.")
        }

        let requestID = nextRequestID
        nextRequestID += 1

        var message: [String: Any] = [
            "jsonrpc": "2.0",
            "id": requestID,
            "method": method
        ]
        if let params {
            message["params"] = params
        }

        return try await withCheckedThrowingContinuation { continuation in
            pendingRequests[requestID] = continuation
            do {
                try sendJSONLine(message, to: stdinHandle)
            } catch {
                pendingRequests.removeValue(forKey: requestID)
                continuation.resume(throwing: error)
            }
        }
    }

    private func sendNotification(method: String, params: Any?) throws {
        guard process?.isRunning == true else {
            throw AppServerRunnerError.protocolError("App-server process is not running.")
        }
        guard let stdinHandle else {
            throw AppServerRunnerError.protocolError("App-server stdin is unavailable.")
        }

        var message: [String: Any] = [
            "jsonrpc": "2.0",
            "method": method
        ]
        if let params {
            message["params"] = params
        }
        try sendJSONLine(message, to: stdinHandle)
    }

    private func handleIncomingLine(_ rawLine: String) async {
        let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !line.isEmpty else { return }
        guard let message = parseJSONMessage(line) else { return }

        if let requestID = extractRequestID(from: message),
           let continuation = pendingRequests.removeValue(forKey: requestID)
        {
            continuation.resume(returning: message)
            return
        }

        guard let method = message["method"] as? String else { return }
        guard let params = message["params"] as? [String: Any] else { return }

        switch method {
        case "turn/started":
            if let turnID = extractTurnID(fromTurnStartedNotification: params) {
                currentTurn?.turnID = turnID
            }

        case "item/agentMessage/delta":
            guard matchesCurrentTurn(params: params) else { return }
            guard let delta = params["delta"] as? String, !delta.isEmpty else { return }
            currentTurn?.output.append(delta)
            if let onTextDelta = currentTurn?.onTextDelta {
                await onTextDelta(delta)
            }

        case "item/completed":
            guard matchesCurrentTurn(params: params) else { return }
            guard
                let item = params["item"] as? [String: Any],
                let type = item["type"] as? String,
                type == "agentMessage",
                let text = item["text"] as? String,
                !text.isEmpty
            else {
                return
            }
            if currentTurn?.output.isEmpty == true {
                currentTurn?.output = text
                if let onTextDelta = currentTurn?.onTextDelta {
                    await onTextDelta(text)
                }
            }

        case "thread/tokenUsage/updated":
            guard matchesCurrentTurn(params: params) else { return }
            currentTurn?.tokenUsage = extractTokenUsage(fromTokenUsageUpdate: params) ?? currentTurn?.tokenUsage

        case "turn/completed":
            guard matchesCurrentThread(params: params) else { return }
            let status = extractTurnStatus(fromTurnCompletedNotification: params) ?? "failed"
            let errorMessage = extractTurnErrorMessage(fromTurnCompletedNotification: params)
            let outcome = AppServerTurnOutcome(
                output: currentTurn?.output ?? "",
                tokenUsage: currentTurn?.tokenUsage,
                status: status,
                errorMessage: errorMessage ?? currentTurn?.errorMessage
            )
            finishCurrentTurn(with: .success(outcome))

        case "error":
            if let message = params["message"] as? String, !message.isEmpty {
                currentTurn?.errorMessage = message
            }

        default:
            break
        }
    }

    private func handleReaderEnded() async {
        await teardownSession(error: AppServerRunnerError.protocolError("App-server stream ended unexpectedly."))
    }

    private func handleReaderFailed(_ error: Error) async {
        await teardownSession(error: error)
    }

    private func setCurrentTurnID(_ turnID: String?) {
        guard var state = currentTurn else { return }
        state.turnID = turnID
        currentTurn = state
    }

    private func finishCurrentTurn(with result: Result<AppServerTurnOutcome, Error>) {
        guard let state = currentTurn else { return }
        currentTurn = nil
        switch result {
        case .success(let value):
            state.continuation.resume(returning: value)
        case .failure(let error):
            state.continuation.resume(throwing: error)
        }
    }

    private func teardownSession(error: Error) async {
        if let task = readerTask {
            task.cancel()
            readerTask = nil
        }

        if process?.isRunning == true {
            process?.terminate()
        }
        process = nil

        if let handle = stdinHandle {
            try? handle.close()
        }
        stdinHandle = nil

        if let stderrWriter {
            try? stderrWriter.close()
        }
        stderrWriter = nil

        let filesToCleanup = stderrURL.map { [$0] } ?? []
        cleanupTempFiles(filesToCleanup)
        stderrURL = nil

        let continuations = pendingRequests.values
        pendingRequests.removeAll()
        for continuation in continuations {
            continuation.resume(throwing: error)
        }

        finishCurrentTurn(with: .failure(error))

        threadID = nil
    }

    private func matchesCurrentThread(params: [String: Any]) -> Bool {
        guard let expectedThreadID = currentTurn?.threadID ?? threadID else { return true }
        guard let receivedThreadID = params["threadId"] as? String else { return true }
        return receivedThreadID == expectedThreadID
    }

    private func matchesCurrentTurn(params: [String: Any]) -> Bool {
        guard matchesCurrentThread(params: params) else { return false }
        guard let expectedTurnID = currentTurn?.turnID else { return true }
        guard let receivedTurnID = params["turnId"] as? String else { return true }
        return receivedTurnID == expectedTurnID
    }
}

final class AppServerRunner {
    private let session = AppServerSession.shared

    func prewarm() async {
        let model = await MainActor.run {
            AppSettingsStore.shared.codexModel
        }

        do {
            try await session.prewarm(model: model)
        } catch {
            // Prewarm is best-effort. Runtime execution path still reports detailed failures.
        }
    }

    func run(
        command: String,
        selectedText: String? = nil,
        action: CopilotAction = .edit,
        timeout: TimeInterval = 60,
        onTextDelta: (@Sendable (String) async -> Void)? = nil
    ) async throws -> CLIRunnerResult {
        let (configuredModel, configuredReasoningEffort) = await MainActor.run {
            (
                AppSettingsStore.shared.codexModel,
                AppSettingsStore.shared.codexReasoningEffort
            )
        }

        return try await withTaskCancellationHandler {
            do {
                let prompt = composePrompt(command: command, selectedText: selectedText, action: action)
                let outcome = try await withThrowingTaskGroup(of: AppServerTurnOutcome.self) { group in
                    group.addTask {
                        try await self.session.executeTurn(
                            prompt: prompt,
                            model: configuredModel,
                            reasoningEffort: configuredReasoningEffort,
                            onTextDelta: onTextDelta
                        )
                    }
                    group.addTask {
                        let cappedTimeout = max(1, timeout)
                        try await Task.sleep(nanoseconds: UInt64(cappedTimeout * 1_000_000_000))
                        throw CLIRunnerError.timedOut
                    }

                    guard let firstResult = try await group.next() else {
                        throw AppServerRunnerError.protocolError("No result from app-server turn.")
                    }
                    group.cancelAll()
                    return firstResult
                }

                let normalizedOutput = normalizeOutput(outcome.output)
                let exitCode: Int32 = outcome.status == "completed" ? 0 : 1
                if exitCode != 0 {
                    let stderr = outcome.errorMessage?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    let fallback = stderr.isEmpty ? "App server turn \(outcome.status)." : stderr
                    return CLIRunnerResult(
                        stdout: normalizedOutput,
                        stderr: fallback,
                        exitCode: exitCode,
                        tokenUsage: outcome.tokenUsage
                    )
                }

                return CLIRunnerResult(
                    stdout: normalizedOutput,
                    stderr: "",
                    exitCode: exitCode,
                    tokenUsage: outcome.tokenUsage
                )
            } catch is CancellationError {
                await session.resetSession()
                throw CancellationError()
            } catch CLIRunnerError.timedOut {
                await session.resetSession()
                throw CLIRunnerError.timedOut
            } catch {
                let stderr = normalizeOutput(await session.stderrSnapshot())
                await session.resetSession()
                if !stderr.isEmpty {
                    throw AppServerRunnerError.protocolError(stderr)
                }
                throw error
            }
        } onCancel: {
            Task { await self.session.resetSession() }
        }
    }
}

extension AppServerRunner: AppServerRunning {
    func run(
        command: String,
        selectedText: String?,
        action: CopilotAction,
        onTextDelta: (@Sendable (String) async -> Void)?
    ) async throws -> CLIRunnerResult {
        try await run(
            command: command,
            selectedText: selectedText,
            action: action,
            timeout: 60,
            onTextDelta: onTextDelta
        )
    }
}

extension AppServerRunner: AppServerPrewarming {}

private func initializeParams() -> [String: Any] {
    [
        "clientInfo": [
            "name": "echo",
            "version": "0.1.0"
        ],
        "capabilities": [
            "experimentalApi": false
        ]
    ]
}

private func threadStartParams(model: String) -> [String: Any] {
    var params: [String: Any] = [
        "approvalPolicy": "never",
        "sandbox": "danger-full-access",
        "experimentalRawEvents": false
    ]

    let trimmedModel = model.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedModel.isEmpty {
        params["model"] = trimmedModel
    }
    return params
}

private func turnStartParams(
    threadID: String,
    prompt: String,
    model: String,
    reasoningEffort: String
) -> [String: Any] {
    var params: [String: Any] = [
        "threadId": threadID,
        "input": [
            [
                "type": "text",
                "text": prompt,
                "text_elements": []
            ]
        ],
        "approvalPolicy": "never",
        "sandboxPolicy": [
            "type": "dangerFullAccess"
        ],
        "summary": "none"
    ]

    let trimmedModel = model.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedModel.isEmpty {
        params["model"] = trimmedModel
    }

    let trimmedEffort = reasoningEffort.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedEffort.isEmpty {
        params["effort"] = trimmedEffort
    }

    return params
}

private func parseJSONMessage(_ line: String) -> [String: Any]? {
    guard let data = line.data(using: .utf8) else { return nil }
    guard let object = try? JSONSerialization.jsonObject(with: data) else { return nil }
    return object as? [String: Any]
}

private func sendJSONLine(_ object: [String: Any], to handle: FileHandle) throws {
    let data = try JSONSerialization.data(withJSONObject: object, options: [])
    handle.write(data)
    handle.write(Data([0x0A]))
}

private func throwIfJSONRPCError(in message: [String: Any]) throws {
    if let text = jsonRPCErrorMessage(from: message) {
        throw AppServerRunnerError.protocolError(text)
    }
}

private func extractRequestID(from message: [String: Any]) -> Int? {
    if let value = message["id"] as? Int {
        return value
    }
    if let value = message["id"] as? NSNumber {
        return value.intValue
    }
    if let value = message["id"] as? String {
        return Int(value)
    }
    return nil
}

private func jsonRPCErrorMessage(from message: [String: Any]) -> String? {
    guard let error = message["error"] as? [String: Any] else { return nil }
    if let message = error["message"] as? String {
        return message
    }
    return "Unknown JSON-RPC error."
}

private func extractThreadID(fromThreadStartResponse message: [String: Any]) -> String? {
    guard let result = message["result"] as? [String: Any] else { return nil }
    guard let thread = result["thread"] as? [String: Any] else { return nil }
    return thread["id"] as? String
}

private func extractTurnID(fromTurnStartResponse message: [String: Any]) -> String? {
    guard let result = message["result"] as? [String: Any] else { return nil }
    guard let turn = result["turn"] as? [String: Any] else { return nil }
    return turn["id"] as? String
}

private func extractTurnID(fromTurnStartedNotification params: [String: Any]) -> String? {
    guard let turn = params["turn"] as? [String: Any] else { return nil }
    return turn["id"] as? String
}

private func extractTurnStatus(fromTurnCompletedNotification params: [String: Any]) -> String? {
    guard let turn = params["turn"] as? [String: Any] else { return nil }
    return turn["status"] as? String
}

private func extractTurnErrorMessage(fromTurnCompletedNotification params: [String: Any]) -> String? {
    guard let turn = params["turn"] as? [String: Any] else { return nil }
    guard let error = turn["error"] as? [String: Any] else { return nil }
    return error["message"] as? String
}

private func extractTokenUsage(fromTokenUsageUpdate params: [String: Any]) -> CLITokenUsage? {
    guard let tokenUsage = params["tokenUsage"] as? [String: Any] else { return nil }
    guard let last = tokenUsage["last"] as? [String: Any] else { return nil }

    return CLITokenUsage(
        inputTokens: numberFromAny(last["inputTokens"]),
        outputTokens: numberFromAny(last["outputTokens"]),
        totalTokens: numberFromAny(last["totalTokens"])
    )
}

private func numberFromAny(_ value: Any?) -> Int? {
    if let intValue = value as? Int {
        return intValue
    }
    if let number = value as? NSNumber {
        return number.intValue
    }
    if let stringValue = value as? String {
        return Int(stringValue)
    }
    return nil
}
