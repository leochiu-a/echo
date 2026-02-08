import Combine
import Foundation

enum PromptHistoryStatus: String, Codable {
    case succeeded
    case failed
    case cancelled

    var label: String {
        switch self {
        case .succeeded:
            return "Succeeded"
        case .failed:
            return "Failed"
        case .cancelled:
            return "Cancelled"
        }
    }
}

struct PromptHistoryEntry: Codable, Equatable, Identifiable {
    let id: UUID
    let command: String
    let action: CopilotAction
    let usedSelectionContext: Bool
    let status: PromptHistoryStatus
    let detail: String
    let createdAt: Date

    init(
        id: UUID = UUID(),
        command: String,
        action: CopilotAction,
        usedSelectionContext: Bool,
        status: PromptHistoryStatus,
        detail: String,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.command = command
        self.action = action
        self.usedSelectionContext = usedSelectionContext
        self.status = status
        self.detail = detail
        self.createdAt = createdAt
    }
}

@MainActor
final class PromptHistoryStore: ObservableObject {
    static let shared = PromptHistoryStore()

    @Published private(set) var entries: [PromptHistoryEntry] = []
    @Published private(set) var commands: [String] = []

    private let defaults: UserDefaults
    private let entriesKey: String
    private let commandsKey: String
    private let maxEntries: Int
    private let maxCommands: Int
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(
        defaults: UserDefaults = .standard,
        storageNamespace: String = "echo.promptHistory",
        maxEntries: Int = 120,
        maxCommands: Int = 120
    ) {
        self.defaults = defaults
        self.entriesKey = "\(storageNamespace).entries"
        self.commandsKey = "\(storageNamespace).commands"
        self.maxEntries = max(1, maxEntries)
        self.maxCommands = max(1, maxCommands)
        loadFromStorage()
    }

    func reload() {
        loadFromStorage()
    }

    func clear() {
        entries = []
        commands = []
        defaults.removeObject(forKey: entriesKey)
        defaults.removeObject(forKey: commandsKey)
    }

    func rememberCommand(_ command: String) {
        let trimmed = command.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        commands.removeAll { $0 == trimmed }
        commands.append(trimmed)

        if commands.count > maxCommands {
            commands.removeFirst(commands.count - maxCommands)
        }
        persist(commands, key: commandsKey)
    }

    func recordExecution(
        command: String,
        action: CopilotAction,
        usedSelectionContext: Bool,
        status: PromptHistoryStatus,
        detail: String
    ) {
        let trimmedCommand = command.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedCommand.isEmpty else { return }

        rememberCommand(trimmedCommand)

        let normalizedDetail = detail.trimmingCharacters(in: .whitespacesAndNewlines)
        let entry = PromptHistoryEntry(
            command: trimmedCommand,
            action: action,
            usedSelectionContext: usedSelectionContext,
            status: status,
            detail: normalizedDetail.isEmpty ? status.label : normalizedDetail
        )

        entries.insert(entry, at: 0)
        if entries.count > maxEntries {
            entries.removeLast(entries.count - maxEntries)
        }

        persist(entries, key: entriesKey)
    }

    private func loadFromStorage() {
        entries = decode([PromptHistoryEntry].self, key: entriesKey) ?? []
        commands = decode([String].self, key: commandsKey) ?? []
    }

    private func persist<T: Encodable>(_ value: T, key: String) {
        guard let encoded = try? encoder.encode(value) else { return }
        defaults.set(encoded, forKey: key)
    }

    private func decode<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? decoder.decode(type, from: data)
    }
}
