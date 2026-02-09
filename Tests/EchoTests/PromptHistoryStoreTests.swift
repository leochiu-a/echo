import Foundation
import Testing
@testable import Echo

@Test
@MainActor
func rememberCommandDeduplicatesAndKeepsNewestOrdering() throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
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
    let suiteName = "EchoTests.\(UUID().uuidString)"
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
        detail: "Generated 128 chars.",
        responseText: "updated paragraph result"
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
    #expect(firstEntry.responseText == "updated paragraph result")
}

@Test
@MainActor
func clearRemovesEntriesAndCommands() throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
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
        detail: "codex request failed"
    )

    store.clear()

    #expect(store.entries.isEmpty)
    #expect(store.commands.isEmpty)
}

@Test
@MainActor
func recordExecutionTruncatesLongResponseText() throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let store = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 10
    )

    let longResponse = String(repeating: "a", count: 8_100)
    store.recordExecution(
        command: "rewrite this paragraph",
        action: .edit,
        usedSelectionContext: true,
        status: .succeeded,
        detail: "ok",
        responseText: longResponse
    )

    let saved = try #require(store.entries.first?.responseText)
    #expect(saved.count == 8_000)
    #expect(saved.hasSuffix("..."))
}

@Test
@MainActor
func deleteEntryRemovesOnlySpecifiedRecord() throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let store = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 10
    )

    store.recordExecution(
        command: "first command",
        action: .edit,
        usedSelectionContext: false,
        status: .succeeded,
        detail: "ok",
        responseText: "first"
    )
    store.recordExecution(
        command: "second command",
        action: .askQuestion,
        usedSelectionContext: false,
        status: .succeeded,
        detail: "ok",
        responseText: "second"
    )

    let firstID = try #require(store.entries.last?.id)
    store.deleteEntry(id: firstID)

    #expect(store.entries.count == 1)
    #expect(store.entries.first?.command == "second command")
}

@Test
@MainActor
func retentionPolicyPrunesExpiredEntries() throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let store = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 10
    )

    let now = Date()
    store.recordExecution(
        command: "old command",
        action: .edit,
        usedSelectionContext: false,
        status: .succeeded,
        detail: "ok",
        responseText: "old",
        createdAt: now.addingTimeInterval(-(8 * 24 * 60 * 60))
    )
    store.recordExecution(
        command: "new command",
        action: .edit,
        usedSelectionContext: false,
        status: .succeeded,
        detail: "ok",
        responseText: "new",
        createdAt: now
    )

    store.retentionPolicy = .sevenDays

    #expect(store.entries.count == 1)
    #expect(store.entries.first?.command == "new command")
}

@Test
@MainActor
func retentionPolicyPersistsAcrossStoreReload() throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let writer = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 10
    )
    writer.retentionPolicy = .thirtyDays

    let reader = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 10
    )

    #expect(reader.retentionPolicy == .thirtyDays)
}

@Test
@MainActor
func recordExecutionStoresTokenUsageFields() throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let store = PromptHistoryStore(
        defaults: defaults,
        storageNamespace: suiteName,
        maxEntries: 10,
        maxCommands: 10
    )

    store.recordExecution(
        command: "token test",
        action: .edit,
        usedSelectionContext: false,
        status: .succeeded,
        detail: "ok",
        responseText: "done",
        inputTokens: 120,
        outputTokens: 80,
        totalTokens: 200
    )

    let entry = try #require(store.entries.first)
    #expect(entry.inputTokens == 120)
    #expect(entry.outputTokens == 80)
    #expect(entry.totalTokens == 200)
}

@Test
func tokenSummaryAggregatesRunsAndFallbackTotals() {
    let entries = [
        PromptHistoryEntry(
            command: "a",
            action: .edit,
            usedSelectionContext: false,
            status: .succeeded,
            detail: "ok",
            inputTokens: 100,
            outputTokens: 40,
            totalTokens: 140
        ),
        PromptHistoryEntry(
            command: "b",
            action: .askQuestion,
            usedSelectionContext: false,
            status: .failed,
            detail: "failed",
            inputTokens: 50,
            outputTokens: nil,
            totalTokens: nil
        ),
        PromptHistoryEntry(
            command: "c",
            action: .askQuestion,
            usedSelectionContext: false,
            status: .succeeded,
            detail: "ok",
            inputTokens: nil,
            outputTokens: 30,
            totalTokens: nil
        )
    ]

    let summary = PromptHistoryTokenSummary.summarize(entries: entries)
    #expect(summary.totalInputTokens == 150)
    #expect(summary.totalOutputTokens == 70)
    #expect(summary.totalTokens == 220)
    #expect(summary.inputTokenRunCount == 2)
    #expect(summary.outputTokenRunCount == 2)
    #expect(summary.tokenizedRunCount == 3)
}
