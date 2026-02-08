import Foundation
import Testing
@testable import Echo

@Test
@MainActor
func canonicalModelNormalizesCase() {
    #expect(AppSettingsStore.canonicalModel(for: " GPT-5.3-Codex ") == "gpt-5.3-codex")
    #expect(AppSettingsStore.canonicalModel(for: "GPT-5-CODEX") == "gpt-5-codex")
}

@Test
@MainActor
func canonicalModelRejectsUnsupportedValue() {
    #expect(AppSettingsStore.canonicalModel(for: "gpt-4") == nil)
    #expect(AppSettingsStore.canonicalModel(for: "   ") == nil)
}

@Test
@MainActor
func initMigratesLegacyModelValueInDefaults() throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    defaults.set("GPT-5.3-Codex", forKey: AppSettingsStore.StorageKey.codexModel)

    let store = AppSettingsStore(defaults: defaults)

    #expect(store.codexModel == "gpt-5.3-codex")
    #expect(defaults.string(forKey: AppSettingsStore.StorageKey.codexModel) == "gpt-5.3-codex")
}

@Test
@MainActor
func settingInvalidModelFallsBackToDefault() throws {
    let suiteName = "EchoTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }

    let store = AppSettingsStore(defaults: defaults)
    store.codexModel = "not-a-real-model"

    #expect(store.codexModel == AppSettingsStore.defaultCodexModel)
    #expect(defaults.string(forKey: AppSettingsStore.StorageKey.codexModel) == AppSettingsStore.defaultCodexModel)
}
