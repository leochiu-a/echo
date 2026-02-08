import Combine
import Foundation

enum PromptHistoryRetentionPolicy: String, Codable, CaseIterable, Identifiable {
    case forever
    case sevenDays
    case thirtyDays
    case ninetyDays

    var id: String { rawValue }

    var title: String {
        switch self {
        case .forever:
            return "Forever"
        case .sevenDays:
            return "7 days"
        case .thirtyDays:
            return "30 days"
        case .ninetyDays:
            return "90 days"
        }
    }

    var maxAge: TimeInterval? {
        switch self {
        case .forever:
            return nil
        case .sevenDays:
            return 7 * 24 * 60 * 60
        case .thirtyDays:
            return 30 * 24 * 60 * 60
        case .ninetyDays:
            return 90 * 24 * 60 * 60
        }
    }
}

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
    let responseText: String?
    let createdAt: Date

    init(
        id: UUID = UUID(),
        command: String,
        action: CopilotAction,
        usedSelectionContext: Bool,
        status: PromptHistoryStatus,
        detail: String,
        responseText: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.command = command
        self.action = action
        self.usedSelectionContext = usedSelectionContext
        self.status = status
        self.detail = detail
        self.responseText = responseText
        self.createdAt = createdAt
    }
}

@MainActor
final class PromptHistoryStore: ObservableObject {
    static let shared = PromptHistoryStore()

    @Published private(set) var entries: [PromptHistoryEntry] = []
    @Published private(set) var commands: [String] = []
    @Published var retentionPolicy: PromptHistoryRetentionPolicy {
        didSet { persistRetentionPolicyIfNeeded() }
    }

    private let defaults: UserDefaults
    private let entriesKey: String
    private let commandsKey: String
    private let retentionPolicyKey: String
    private let maxEntries: Int
    private let maxCommands: Int
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var isBootstrapping = true

    init(
        defaults: UserDefaults = .standard,
        storageNamespace: String = "echo.promptHistory",
        maxEntries: Int = 120,
        maxCommands: Int = 120
    ) {
        self.retentionPolicy = .forever
        self.defaults = defaults
        self.entriesKey = "\(storageNamespace).entries"
        self.commandsKey = "\(storageNamespace).commands"
        self.retentionPolicyKey = "\(storageNamespace).retentionPolicy"
        self.maxEntries = max(1, maxEntries)
        self.maxCommands = max(1, maxCommands)
        loadFromStorage()
        isBootstrapping = false
        applyRetentionPolicy()
    }

    func reload() {
        loadFromStorage()
        applyRetentionPolicy()
    }

    func clear() {
        entries = []
        commands = []
        defaults.removeObject(forKey: entriesKey)
        defaults.removeObject(forKey: commandsKey)
    }

    func deleteEntry(id: PromptHistoryEntry.ID) {
        let previousCount = entries.count
        entries.removeAll { $0.id == id }
        guard entries.count != previousCount else { return }
        persist(entries, key: entriesKey)
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
        detail: String,
        responseText: String? = nil,
        createdAt: Date = Date()
    ) {
        let trimmedCommand = command.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedCommand.isEmpty else { return }

        rememberCommand(trimmedCommand)

        let normalizedDetail = detail.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedResponse = normalizedResponseText(responseText)
        let entry = PromptHistoryEntry(
            command: trimmedCommand,
            action: action,
            usedSelectionContext: usedSelectionContext,
            status: status,
            detail: normalizedDetail.isEmpty ? status.label : normalizedDetail,
            responseText: normalizedResponse,
            createdAt: createdAt
        )

        entries.insert(entry, at: 0)
        if entries.count > maxEntries {
            entries.removeLast(entries.count - maxEntries)
        }

        applyRetentionPolicy(persistChanges: false)
        persist(entries, key: entriesKey)
    }

    private func loadFromStorage() {
        if let raw = defaults.string(forKey: retentionPolicyKey),
           let policy = PromptHistoryRetentionPolicy(rawValue: raw)
        {
            retentionPolicy = policy
        } else {
            retentionPolicy = .forever
        }

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

    private func normalizedResponseText(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        // Cap stored response size to keep UserDefaults payload stable.
        if trimmed.count <= 8_000 {
            return trimmed
        }
        let prefix = String(trimmed.prefix(7_997))
        return "\(prefix)..."
    }

    private func persistRetentionPolicyIfNeeded() {
        guard !isBootstrapping else { return }
        defaults.set(retentionPolicy.rawValue, forKey: retentionPolicyKey)
        applyRetentionPolicy()
    }

    private func applyRetentionPolicy(persistChanges: Bool = true) {
        guard let maxAge = retentionPolicy.maxAge else { return }
        let cutoff = Date().addingTimeInterval(-maxAge)
        let filtered = entries.filter { $0.createdAt >= cutoff }
        guard filtered.count != entries.count else { return }
        entries = filtered
        if persistChanges {
            persist(entries, key: entriesKey)
        }
    }
}
