import AppKit
import Carbon
import Foundation

struct KeyboardShortcut: Codable, Equatable, Hashable {
    var keyCode: UInt16
    var modifierFlagsRaw: UInt

    init(keyCode: UInt16, modifiers: NSEvent.ModifierFlags) {
        self.keyCode = keyCode
        modifierFlagsRaw = modifiers.normalizedShortcutModifiers.rawValue
    }

    var modifierFlags: NSEvent.ModifierFlags {
        NSEvent.ModifierFlags(rawValue: modifierFlagsRaw).normalizedShortcutModifiers
    }

    var carbonModifiers: UInt32 {
        var value: UInt32 = 0
        let flags = modifierFlags
        if flags.contains(.command) { value |= UInt32(cmdKey) }
        if flags.contains(.shift) { value |= UInt32(shiftKey) }
        if flags.contains(.option) { value |= UInt32(optionKey) }
        if flags.contains(.control) { value |= UInt32(controlKey) }
        return value
    }

    var displayText: String {
        let modifierPart = modifierFlags.displaySymbols
        return "\(modifierPart)\(keyCode.displayName)"
    }

    var displayTokens: [String] {
        var tokens: [String] = []
        let flags = modifierFlags
        if flags.contains(.control) { tokens.append("⌃") }
        if flags.contains(.option) { tokens.append("⌥") }
        if flags.contains(.shift) { tokens.append("⇧") }
        if flags.contains(.command) { tokens.append("⌘") }
        tokens.append(keyCode.displayName)
        return tokens
    }

    func matches(_ event: NSEvent) -> Bool {
        event.keyCode == keyCode && event.modifierFlags.normalizedShortcutModifiers == modifierFlags
    }
}

struct SlashCommandSetting: Codable, Equatable, Hashable, Identifiable {
    var id: UUID
    var command: String
    var prompt: String

    init(id: UUID = UUID(), command: String, prompt: String) {
        self.id = id
        self.command = command
        self.prompt = prompt
    }
}

@MainActor
final class AppSettingsStore: ObservableObject {
    static let shared = AppSettingsStore()

    @Published var codexModel: String {
        didSet { persistModelIfNeeded() }
    }
    @Published var codexReasoningEffort: String {
        didSet { persistReasoningEffortIfNeeded() }
    }
    @Published var openPanelShortcut: KeyboardShortcut {
        didSet { persistShortcutIfNeeded(openPanelShortcut, key: StorageKey.openPanelShortcut) }
    }
    @Published var replaceShortcut: KeyboardShortcut {
        didSet { persistShortcutIfNeeded(replaceShortcut, key: StorageKey.replaceShortcut) }
    }
    @Published var insertShortcut: KeyboardShortcut {
        didSet { persistShortcutIfNeeded(insertShortcut, key: StorageKey.insertShortcut) }
    }
    @Published var slashCommands: [SlashCommandSetting] {
        didSet { persistSlashCommandsIfNeeded() }
    }

    static let supportedCodexModels = [
        "gpt-5.3-codex",
        "gpt-5-codex"
    ]
    static let supportedReasoningEfforts = [
        "low",
        "medium",
        "high",
        "xhigh"
    ]
    static let defaultCodexModel = "gpt-5.3-codex"
    static let defaultCodexReasoningEffort = "medium"
    static let defaultOpenPanelShortcut = KeyboardShortcut(keyCode: UInt16(kVK_ANSI_K), modifiers: [.command])
    static let defaultReplaceShortcut = KeyboardShortcut(keyCode: UInt16(kVK_Return), modifiers: [.command])
    static let defaultInsertShortcut = KeyboardShortcut(keyCode: UInt16(kVK_Return), modifiers: [.command, .shift])
    static let defaultSlashCommands: [SlashCommandSetting] = []

    enum StorageKey {
        static let codexModel = "echo.settings.codexModel"
        static let codexReasoningEffort = "echo.settings.codexReasoningEffort"
        static let openPanelShortcut = "echo.settings.openPanelShortcut"
        static let replaceShortcut = "echo.settings.replaceShortcut"
        static let insertShortcut = "echo.settings.insertShortcut"
        static let slashCommands = "echo.settings.slashCommands"
    }

    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var isBootstrapping = true

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        codexModel = Self.defaultCodexModel
        codexReasoningEffort = Self.defaultCodexReasoningEffort
        openPanelShortcut = Self.defaultOpenPanelShortcut
        replaceShortcut = Self.defaultReplaceShortcut
        insertShortcut = Self.defaultInsertShortcut
        slashCommands = Self.defaultSlashCommands

        if let storedModel = defaults.string(forKey: StorageKey.codexModel) {
            let trimmed = storedModel.trimmingCharacters(in: .whitespacesAndNewlines)
            if let canonicalModel = Self.canonicalModel(for: trimmed) {
                codexModel = canonicalModel
                if storedModel != canonicalModel {
                    defaults.set(canonicalModel, forKey: StorageKey.codexModel)
                }
            } else {
                defaults.set(Self.defaultCodexModel, forKey: StorageKey.codexModel)
            }
        }
        if let storedEffort = defaults.string(forKey: StorageKey.codexReasoningEffort) {
            let trimmed = storedEffort.trimmingCharacters(in: .whitespacesAndNewlines)
            if let canonicalEffort = Self.canonicalReasoningEffort(for: trimmed) {
                codexReasoningEffort = canonicalEffort
                if storedEffort != canonicalEffort {
                    defaults.set(canonicalEffort, forKey: StorageKey.codexReasoningEffort)
                }
            } else {
                defaults.set(Self.defaultCodexReasoningEffort, forKey: StorageKey.codexReasoningEffort)
            }
        }
        openPanelShortcut = decodeShortcut(forKey: StorageKey.openPanelShortcut) ?? Self.defaultOpenPanelShortcut
        replaceShortcut = decodeShortcut(forKey: StorageKey.replaceShortcut) ?? Self.defaultReplaceShortcut
        insertShortcut = decodeShortcut(forKey: StorageKey.insertShortcut) ?? Self.defaultInsertShortcut
        slashCommands = decodeSlashCommands(forKey: StorageKey.slashCommands) ?? Self.defaultSlashCommands

        isBootstrapping = false
    }

    func resetToDefaults() {
        codexModel = Self.defaultCodexModel
        codexReasoningEffort = Self.defaultCodexReasoningEffort
        openPanelShortcut = Self.defaultOpenPanelShortcut
        replaceShortcut = Self.defaultReplaceShortcut
        insertShortcut = Self.defaultInsertShortcut
        slashCommands = Self.defaultSlashCommands
    }

    private func persistModelIfNeeded() {
        guard !isBootstrapping else { return }
        let trimmed = codexModel.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let canonicalModel = Self.canonicalModel(for: trimmed) else {
            codexModel = Self.defaultCodexModel
            defaults.set(Self.defaultCodexModel, forKey: StorageKey.codexModel)
            NotificationCenter.default.post(name: .appSettingsDidChange, object: nil)
            return
        }

        if codexModel != canonicalModel {
            codexModel = canonicalModel
            return
        }

        defaults.set(canonicalModel, forKey: StorageKey.codexModel)
        NotificationCenter.default.post(name: .appSettingsDidChange, object: nil)
    }

    private func persistReasoningEffortIfNeeded() {
        guard !isBootstrapping else { return }
        let trimmed = codexReasoningEffort.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let canonicalEffort = Self.canonicalReasoningEffort(for: trimmed) else {
            codexReasoningEffort = Self.defaultCodexReasoningEffort
            defaults.set(Self.defaultCodexReasoningEffort, forKey: StorageKey.codexReasoningEffort)
            NotificationCenter.default.post(name: .appSettingsDidChange, object: nil)
            return
        }

        if codexReasoningEffort != canonicalEffort {
            codexReasoningEffort = canonicalEffort
            return
        }

        defaults.set(canonicalEffort, forKey: StorageKey.codexReasoningEffort)
        NotificationCenter.default.post(name: .appSettingsDidChange, object: nil)
    }

    static func canonicalModel(for value: String) -> String? {
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return nil }
        return supportedCodexModels.first { $0.caseInsensitiveCompare(normalized) == .orderedSame }
    }

    static func canonicalReasoningEffort(for value: String) -> String? {
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return nil }
        return supportedReasoningEfforts.first { $0.caseInsensitiveCompare(normalized) == .orderedSame }
    }

    nonisolated static func normalizedSlashCommandName(for value: String) -> String? {
        var normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        while normalized.hasPrefix("/") {
            normalized.removeFirst()
        }
        guard !normalized.isEmpty else { return nil }
        guard normalized.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else {
            return nil
        }
        return normalized
    }

    func availableSlashCommands() -> [SlashCommandSetting] {
        var seen = Set<String>()
        var resolved: [SlashCommandSetting] = []

        for item in slashCommands {
            guard let normalizedCommand = Self.normalizedSlashCommandName(for: item.command) else { continue }
            let trimmedPrompt = item.prompt.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedPrompt.isEmpty else { continue }
            guard !seen.contains(normalizedCommand) else { continue }
            seen.insert(normalizedCommand)
            resolved.append(
                SlashCommandSetting(
                    id: item.id,
                    command: normalizedCommand,
                    prompt: trimmedPrompt
                )
            )
        }

        return resolved
    }

    private func persistShortcutIfNeeded(_ shortcut: KeyboardShortcut, key: String) {
        guard !isBootstrapping else { return }
        encode(shortcut, forKey: key)
        NotificationCenter.default.post(name: .appSettingsDidChange, object: nil)
    }

    private func persistSlashCommandsIfNeeded() {
        guard !isBootstrapping else { return }
        guard let data = try? encoder.encode(slashCommands) else { return }
        defaults.set(data, forKey: StorageKey.slashCommands)
        NotificationCenter.default.post(name: .appSettingsDidChange, object: nil)
    }

    private func encode(_ shortcut: KeyboardShortcut, forKey key: String) {
        guard let data = try? encoder.encode(shortcut) else { return }
        defaults.set(data, forKey: key)
    }

    private func decodeShortcut(forKey key: String) -> KeyboardShortcut? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? decoder.decode(KeyboardShortcut.self, from: data)
    }

    private func decodeSlashCommands(forKey key: String) -> [SlashCommandSetting]? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? decoder.decode([SlashCommandSetting].self, from: data)
    }
}

extension NSEvent.ModifierFlags {
    var normalizedShortcutModifiers: NSEvent.ModifierFlags {
        intersection([.command, .shift, .option, .control])
    }

    var displaySymbols: String {
        var result = ""
        if contains(.control) { result += "⌃" }
        if contains(.option) { result += "⌥" }
        if contains(.shift) { result += "⇧" }
        if contains(.command) { result += "⌘" }
        return result
    }
}

private extension UInt16 {
    var displayName: String {
        switch self {
        case UInt16(kVK_Return): return "↩"
        case UInt16(kVK_Tab): return "⇥"
        case UInt16(kVK_Space): return "Space"
        case UInt16(kVK_Delete): return "⌫"
        case UInt16(kVK_Escape): return "⎋"
        case UInt16(kVK_LeftArrow): return "←"
        case UInt16(kVK_RightArrow): return "→"
        case UInt16(kVK_UpArrow): return "↑"
        case UInt16(kVK_DownArrow): return "↓"
        default:
            if let value = keyCodeTable[self] {
                return value
            }
            return "Key \(self)"
        }
    }
}

private let keyCodeTable: [UInt16: String] = [
    UInt16(kVK_ANSI_A): "A", UInt16(kVK_ANSI_B): "B", UInt16(kVK_ANSI_C): "C",
    UInt16(kVK_ANSI_D): "D", UInt16(kVK_ANSI_E): "E", UInt16(kVK_ANSI_F): "F",
    UInt16(kVK_ANSI_G): "G", UInt16(kVK_ANSI_H): "H", UInt16(kVK_ANSI_I): "I",
    UInt16(kVK_ANSI_J): "J", UInt16(kVK_ANSI_K): "K", UInt16(kVK_ANSI_L): "L",
    UInt16(kVK_ANSI_M): "M", UInt16(kVK_ANSI_N): "N", UInt16(kVK_ANSI_O): "O",
    UInt16(kVK_ANSI_P): "P", UInt16(kVK_ANSI_Q): "Q", UInt16(kVK_ANSI_R): "R",
    UInt16(kVK_ANSI_S): "S", UInt16(kVK_ANSI_T): "T", UInt16(kVK_ANSI_U): "U",
    UInt16(kVK_ANSI_V): "V", UInt16(kVK_ANSI_W): "W", UInt16(kVK_ANSI_X): "X",
    UInt16(kVK_ANSI_Y): "Y", UInt16(kVK_ANSI_Z): "Z",
    UInt16(kVK_ANSI_0): "0", UInt16(kVK_ANSI_1): "1", UInt16(kVK_ANSI_2): "2",
    UInt16(kVK_ANSI_3): "3", UInt16(kVK_ANSI_4): "4", UInt16(kVK_ANSI_5): "5",
    UInt16(kVK_ANSI_6): "6", UInt16(kVK_ANSI_7): "7", UInt16(kVK_ANSI_8): "8",
    UInt16(kVK_ANSI_9): "9"
]

extension Notification.Name {
    static let appSettingsDidChange = Notification.Name("appSettingsDidChange")
}
