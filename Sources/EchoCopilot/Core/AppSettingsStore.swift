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

@MainActor
final class AppSettingsStore: ObservableObject {
    static let shared = AppSettingsStore()

    @Published var codexModel: String {
        didSet { persistModelIfNeeded() }
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

    static let supportedCodexModels = [
        "GPT-5.2-Codex",
        "GPT-5.3-Codex",
        "GPT-5.1-Codex-Max",
        "GPT-5.2",
        "GPT-5.1-Codex-Mini"
    ]
    static let defaultCodexModel = "GPT-5.3-Codex"
    static let defaultOpenPanelShortcut = KeyboardShortcut(keyCode: UInt16(kVK_ANSI_K), modifiers: [.command])
    static let defaultReplaceShortcut = KeyboardShortcut(keyCode: UInt16(kVK_Return), modifiers: [.command])
    static let defaultInsertShortcut = KeyboardShortcut(keyCode: UInt16(kVK_Return), modifiers: [.command, .shift])

    private enum StorageKey {
        static let codexModel = "echo.settings.codexModel"
        static let openPanelShortcut = "echo.settings.openPanelShortcut"
        static let replaceShortcut = "echo.settings.replaceShortcut"
        static let insertShortcut = "echo.settings.insertShortcut"
    }

    private let defaults = UserDefaults.standard
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var isBootstrapping = true

    private init() {
        codexModel = Self.defaultCodexModel
        openPanelShortcut = Self.defaultOpenPanelShortcut
        replaceShortcut = Self.defaultReplaceShortcut
        insertShortcut = Self.defaultInsertShortcut

        if let storedModel = defaults.string(forKey: StorageKey.codexModel) {
            let trimmed = storedModel.trimmingCharacters(in: .whitespacesAndNewlines)
            if Self.supportedCodexModels.contains(trimmed) {
                codexModel = trimmed
            }
        }
        openPanelShortcut = decodeShortcut(forKey: StorageKey.openPanelShortcut) ?? Self.defaultOpenPanelShortcut
        replaceShortcut = decodeShortcut(forKey: StorageKey.replaceShortcut) ?? Self.defaultReplaceShortcut
        insertShortcut = decodeShortcut(forKey: StorageKey.insertShortcut) ?? Self.defaultInsertShortcut

        isBootstrapping = false
    }

    func resetToDefaults() {
        codexModel = Self.defaultCodexModel
        openPanelShortcut = Self.defaultOpenPanelShortcut
        replaceShortcut = Self.defaultReplaceShortcut
        insertShortcut = Self.defaultInsertShortcut
    }

    private func persistModelIfNeeded() {
        guard !isBootstrapping else { return }
        let trimmed = codexModel.trimmingCharacters(in: .whitespacesAndNewlines)
        guard Self.supportedCodexModels.contains(trimmed) else {
            codexModel = Self.defaultCodexModel
            defaults.set(Self.defaultCodexModel, forKey: StorageKey.codexModel)
            NotificationCenter.default.post(name: .appSettingsDidChange, object: nil)
            return
        }

        defaults.set(trimmed, forKey: StorageKey.codexModel)
        NotificationCenter.default.post(name: .appSettingsDidChange, object: nil)
    }

    private func persistShortcutIfNeeded(_ shortcut: KeyboardShortcut, key: String) {
        guard !isBootstrapping else { return }
        encode(shortcut, forKey: key)
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
