import AppKit

@MainActor
final class AppCoordinator {
    private let hotKeyManager = HotKeyManager()
    private let overlayPanelController = OverlayPanelController()
    private let settingsStore = AppSettingsStore.shared
    private var dashboardPromptObserver: NSObjectProtocol?
    private var settingsObserver: NSObjectProtocol?

    func start() {
        hotKeyManager.onHotKeyPressed = { [weak self] in
            self?.overlayPanelController.toggleNearMouse()
        }
        hotKeyManager.register(shortcut: settingsStore.openPanelShortcut)

        dashboardPromptObserver = NotificationCenter.default.addObserver(
            forName: .dashboardRequestOpenPrompt,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.overlayPanelController.toggleNearMouse()
            }
        }

        settingsObserver = NotificationCenter.default.addObserver(
            forName: .appSettingsDidChange,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                hotKeyManager.register(shortcut: settingsStore.openPanelShortcut)
            }
        }
    }

    func stop() {
        hotKeyManager.unregister()
        if let dashboardPromptObserver {
            NotificationCenter.default.removeObserver(dashboardPromptObserver)
            self.dashboardPromptObserver = nil
        }
        if let settingsObserver {
            NotificationCenter.default.removeObserver(settingsObserver)
            self.settingsObserver = nil
        }
    }
}

extension Notification.Name {
    static let dashboardRequestOpenPrompt = Notification.Name("dashboardRequestOpenPrompt")
}
