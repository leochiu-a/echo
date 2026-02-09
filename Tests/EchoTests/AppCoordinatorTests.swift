import AppKit
import Carbon
import Foundation
import Testing
@testable import Echo

@MainActor
@Test
func startRegistersShortcutAndHandlesNotifications() async {
    let hotKey = HotKeyManagerSpy()
    let overlay = OverlayPanelControllerSpy()
    let appServer = AppServerPrewarmerSpy()
    let settings = AppSettingsStoreSpy(
        openPanelShortcut: KeyboardShortcut(keyCode: UInt16(kVK_ANSI_K), modifiers: [.command])
    )
    let notificationCenter = NotificationCenter()

    let coordinator = AppCoordinator(
        hotKeyManager: hotKey,
        overlayPanelController: overlay,
        appServerRunner: appServer,
        settingsStore: settings,
        notificationCenter: notificationCenter
    )

    coordinator.start()
    #expect(hotKey.registeredShortcuts == [settings.openPanelShortcut])

    hotKey.onHotKeyPressed?()
    #expect(overlay.toggleCalls == 1)

    notificationCenter.post(name: .dashboardRequestOpenPrompt, object: nil)
    await Task.yield()
    #expect(overlay.toggleCalls == 2)

    let updatedShortcut = KeyboardShortcut(keyCode: UInt16(kVK_ANSI_J), modifiers: [.command, .shift])
    settings.openPanelShortcut = updatedShortcut
    notificationCenter.post(name: .appSettingsDidChange, object: nil)
    await Task.yield()
    #expect(hotKey.registeredShortcuts == [KeyboardShortcut(keyCode: UInt16(kVK_ANSI_K), modifiers: [.command]), updatedShortcut])

    await waitForPrewarm(appServer)
    #expect(await appServer.prewarmCalls == 1)
}

@MainActor
@Test
func stopUnregistersAndRemovesObservers() async {
    let hotKey = HotKeyManagerSpy()
    let overlay = OverlayPanelControllerSpy()
    let appServer = AppServerPrewarmerSpy()
    let settings = AppSettingsStoreSpy(
        openPanelShortcut: KeyboardShortcut(keyCode: UInt16(kVK_ANSI_K), modifiers: [.command])
    )
    let notificationCenter = NotificationCenter()

    let coordinator = AppCoordinator(
        hotKeyManager: hotKey,
        overlayPanelController: overlay,
        appServerRunner: appServer,
        settingsStore: settings,
        notificationCenter: notificationCenter
    )

    coordinator.start()
    coordinator.stop()

    #expect(hotKey.unregisterCalls == 1)
    #expect(hotKey.registeredShortcuts.count == 1)

    notificationCenter.post(name: .dashboardRequestOpenPrompt, object: nil)
    notificationCenter.post(name: .appSettingsDidChange, object: nil)
    await Task.yield()

    #expect(overlay.toggleCalls == 0)
    #expect(hotKey.registeredShortcuts.count == 1)
}

private func waitForPrewarm(_ spy: AppServerPrewarmerSpy) async {
    for _ in 0..<50 {
        if await spy.prewarmCalls > 0 {
            return
        }
        try? await Task.sleep(nanoseconds: 10_000_000)
    }
}

@MainActor
private final class HotKeyManagerSpy: HotKeyManaging {
    var onHotKeyPressed: (@MainActor () -> Void)?
    var registeredShortcuts: [KeyboardShortcut] = []
    var unregisterCalls = 0

    func register(shortcut: KeyboardShortcut) {
        registeredShortcuts.append(shortcut)
    }

    func unregister() {
        unregisterCalls += 1
    }
}

@MainActor
private final class OverlayPanelControllerSpy: OverlayPanelControlling {
    var toggleCalls = 0

    func toggleNearMouse() {
        toggleCalls += 1
    }
}

private actor AppServerPrewarmerSpy: AppServerPrewarming {
    private(set) var prewarmCalls = 0

    func prewarm() async {
        prewarmCalls += 1
    }
}

@MainActor
private final class AppSettingsStoreSpy: AppSettingsStoring {
    var openPanelShortcut: KeyboardShortcut

    init(openPanelShortcut: KeyboardShortcut) {
        self.openPanelShortcut = openPanelShortcut
    }
}
