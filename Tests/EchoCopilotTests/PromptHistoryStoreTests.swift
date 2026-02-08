import Foundation
import Testing
@testable import EchoCopilot

@Test
@MainActor
func rememberCommandDeduplicatesAndKeepsNewestOrdering() throws {
    let suiteName = "EchoCopilotTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let store = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 3
    )

    store.rememberCommand("first")
    store.rememberCommand("second")
    store.rememberCommand("first")
    store.rememberCommand("third")
    store.rememberCommand("fourth")

    #expect(store.commands == ["first", "third", "fourth"])
}

@Test
@MainActor
func recordExecutionPersistsAndReloadsFromStorage() throws {
    let suiteName = "EchoCopilotTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let writer = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 10
    )

    writer.recordExecution(
        command: "rewrite this paragraph",
        action: .edit,
        usedSelectionContext: true,
        status: .succeeded,
        detail: "Generated 128 chars."
    )

    let reader = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 10
    )

    #expect(reader.entries.count == 1)
    #expect(reader.commands == ["rewrite this paragraph"])

    let firstEntry = try #require(reader.entries.first)
    #expect(firstEntry.command == "rewrite this paragraph")
    #expect(firstEntry.action == .edit)
    #expect(firstEntry.usedSelectionContext)
    #expect(firstEntry.status == .succeeded)
    #expect(firstEntry.detail == "Generated 128 chars.")
}

@Test
@MainActor
func clearRemovesEntriesAndCommands() throws {
    let suiteName = "EchoCopilotTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let store = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 10
    )

    store.recordExecution(
        command: "ask: summarize this text",
        action: .askQuestion,
        usedSelectionContext: false,
        status: .failed,
        detail: "codex exec failed"
    )

    store.clear()

    #expect(store.entries.isEmpty)
    #expect(store.commands.isEmpty)
}
